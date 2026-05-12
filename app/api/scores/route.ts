import { NextResponse } from "next/server";
import { findCompany } from "@/data/companies";
import { devMockYearsFor } from "@/data/devMockFinancials";
import { calculateAltman, calculateBeneish } from "@/lib/calculations";
import { fetchFromScreener } from "@/lib/screener/fetch";
import type {
  ErrorCode,
  FinancialYearData,
  ScoresError,
  ScoresResponse,
  TrendPoint,
} from "@/lib/types";

export const runtime = "edge";

const RESPONSE_HEADERS: HeadersInit = {
  "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400",
  "Content-Type": "application/json",
};

function err(payload: ScoresError, status: number) {
  return NextResponse.json(payload, { status, headers: RESPONSE_HEADERS });
}

// Server-side env-gated test mode.  Reads USE_FIXTURE_DATA (server-side
// only, not exposed to the browser).  Falsey by default; must be set
// explicitly to "true" to enable.  Production deploys leave it unset.
function fixtureFlagEnabled(): boolean {
  // Cloudflare Workers expose env via the request context; OpenNext
  // proxies it to process.env at runtime.
  const v = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.USE_FIXTURE_DATA;
  return v === "true" || v === "1";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") ?? url.searchParams.get("ticker"))?.trim();
  const yearParam = url.searchParams.get("year")?.replace(/^FY/i, "").trim();
  // ?dev=1 forces the fixture for this request; USE_FIXTURE_DATA enables it globally.
  const dev = url.searchParams.get("dev") === "1" || fixtureFlagEnabled();
  const debug = url.searchParams.get("debug") === "1";

  // Server-side log — Cloudflare captures these under Workers
  // observability and they show up in `wrangler tail` / dashboard.
  console.log("[scores] request", { slug, yearParam, dev, debug });

  if (!slug) {
    return err(
      { ok: false, errorCode: "MISSING_SLUG", message: "Missing company slug." },
      400
    );
  }
  const master = findCompany(slug.toUpperCase());
  if (!master) {
    console.warn("[scores] unknown ticker", slug);
    return err(
      {
        ok: false,
        errorCode: "UNKNOWN_TICKER",
        message: "Company not found in master.",
        ...(debug ? { debug: { slug } } : {}),
      },
      404
    );
  }

  // 1. Try real Screener first.
  let years: FinancialYearData[] = [];
  let source: ScoresResponse["source"] = "screener";
  const result = await fetchFromScreener(master);

  console.log("[scores] screener fetch", {
    ticker: master.ticker,
    ok: result.ok,
    failureKind: result.failureKind,
    httpStatus: result._diagnostics?.httpStatus,
    url: result._diagnostics?.url,
    columnsExtracted: result._diagnostics?.columnsExtracted,
    yearsParsed: result.years.length,
    bodySnippet: result._diagnostics?.bodySnippet?.slice(0, 100),
  });

  if (result.ok && result.years.length > 0) {
    years = result.years;
  }

  // 2. Dev fixture — only when explicitly requested via ?dev=1 or the
  //    USE_FIXTURE_DATA env var.  Default is OFF in production.
  if (years.length === 0 && dev) {
    const mock = devMockYearsFor(master.ticker);
    if (mock) {
      console.log("[scores] using dev fixture for", master.ticker);
      years = mock;
      source = "dev_mock";
    }
  }

  // 3. Honest failure — never substitute mock silently.
  if (years.length === 0) {
    const errorCode: ErrorCode =
      result.failureKind === "blocked"
        ? "SCREENER_FETCH_BLOCKED"
        : result.failureKind === "parser"
          ? "PARSER_FAILED"
          : "SCREENER_FETCH_FAILED";
    const message =
      errorCode === "SCREENER_FETCH_BLOCKED"
        ? `Screener blocked the request (HTTP ${result._diagnostics?.httpStatus ?? "?"}). Live data is not reachable from this environment.`
        : errorCode === "PARSER_FAILED"
          ? "Screener returned a page we couldn't parse financial tables from."
          : `Network failure while fetching Screener: ${result.error ?? "unknown error"}.`;
    console.warn("[scores] returning error", { errorCode, message });
    return err(
      {
        ok: false,
        errorCode,
        message,
        master,
        ...(debug
          ? {
              debug: {
                slug: master.screenerSlug,
                year: yearParam,
                screenerUrl: result._diagnostics?.url,
                status: result._diagnostics?.httpStatus,
                bodySnippet: result._diagnostics?.bodySnippet,
                columnsExtracted: result._diagnostics?.columnsExtracted,
              },
            }
          : {}),
      },
      502
    );
  }

  // Strip internal-only fieldStatus before doing anything else.
  years = years.map((y) => {
    const { fieldStatus: _drop, ...rest } = y;
    void _drop;
    return rest as FinancialYearData;
  });

  const sortedAsc = [...years].sort((a, b) =>
    a.fiscalYear.localeCompare(b.fiscalYear)
  );
  const availableAsc = sortedAsc.map((y) => y.fiscalYear);

  // 4. Resolve selected year.  If the requested year isn't available
  //    for this company, that's a YEAR_NOT_FOUND error per the contract.
  let fiscalYear: string;
  if (yearParam) {
    if (!availableAsc.includes(yearParam)) {
      return err(
        {
          ok: false,
          errorCode: "YEAR_NOT_FOUND",
          message: `Fiscal year FY${yearParam} is not available for this company.`,
          master,
          ...(debug ? { debug: { slug: master.screenerSlug, year: yearParam, columnsExtracted: availableAsc } } : {}),
        },
        404
      );
    }
    fiscalYear = yearParam;
  } else {
    fiscalYear = availableAsc[availableAsc.length - 1];
  }

  const idx = sortedAsc.findIndex((y) => y.fiscalYear === fiscalYear);
  const current = sortedAsc[idx];
  const prior = idx > 0 ? sortedAsc[idx - 1] : undefined;

  const beneish = calculateBeneish(current, prior);
  const altman = calculateAltman(master, current);

  console.log("[scores] calc done", {
    fiscalYear,
    beneishStatus: beneish.status,
    beneishMissing: beneish.status === "not_calculable" ? beneish.missingVariables.length : 0,
    altmanStatus: altman.status,
    altmanMissing: altman.status === "not_calculable" ? altman.missingVariables.length : 0,
  });

  // 5. Trend — every year, gaps where inputs missing.
  const trend: TrendPoint[] = sortedAsc.map((y, i) => {
    const b = calculateBeneish(y, i > 0 ? sortedAsc[i - 1] : undefined);
    const a = calculateAltman(master, y);
    return {
      fiscalYear: y.fiscalYear,
      mScore: b.status === "calculated" ? +b.mScore.toFixed(3) : null,
      zScore: a.status === "calculated" ? +a.zScore.toFixed(3) : null,
    };
  });

  const payload: ScoresResponse = {
    ok: true,
    company: {
      name: master.companyName,
      ticker: master.ticker,
      fiscalYear,
      sector: master.sector,
      isFinancialCompany: master.isFinancialCompany,
    },
    master,
    fiscalYear,
    availableYears: [...availableAsc].reverse(),
    beneish,
    altman,
    trend,
    source,
    fetchedAt: new Date().toISOString(),
  };

  return NextResponse.json(payload, { status: 200, headers: RESPONSE_HEADERS });
}
