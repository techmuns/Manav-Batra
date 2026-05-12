import { NextResponse } from "next/server";
import SNAPSHOT from "@/data/generated/screener-financials";
import { findCompany } from "@/data/companies";
import { calculateAltman, calculateBeneish } from "@/lib/calculations";
import type {
  ErrorCode,
  FinancialYearData,
  ScoresError,
  ScoresResponse,
  TrendPoint,
} from "@/lib/types";

export const runtime = "edge";

// The snapshot is bundled with the Worker at build time.  It's authored
// in TypeScript (not JSON) so Turbopack reliably inlines it into the
// edge bundle — raw JSON imports can fail to bundle silently.

const SUCCESS_HEADERS: HeadersInit = {
  "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400",
  "Content-Type": "application/json",
};
// Errors must NEVER be cached — a previously-cached 500 would otherwise
// poison the dashboard for the full s-maxage window.
const ERROR_HEADERS: HeadersInit = {
  "Cache-Control": "no-store, must-revalidate",
  "Content-Type": "application/json",
};

function err(payload: ScoresError, status: number) {
  return NextResponse.json(payload, { status, headers: ERROR_HEADERS });
}

export async function GET(req: Request) {
  try {
    return await handle(req);
  } catch (e) {
    // Last-resort guard: never let Cloudflare serve an HTML error page.
    const message = e instanceof Error ? e.message : String(e);
    console.error("[scores] uncaught", message, e);
    const payload: ScoresError = {
      ok: false,
      errorCode: "ROUTE_FAILED",
      message: `Edge route threw: ${message}`,
    };
    return NextResponse.json(payload, { status: 500, headers: ERROR_HEADERS });
  }
}

async function handle(req: Request) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") ?? url.searchParams.get("ticker"))?.trim();
  const yearParam = url.searchParams.get("year")?.replace(/^FY/i, "").trim();
  const debug = url.searchParams.get("debug") === "1";

  console.log("[scores] request", { slug, yearParam, debug });

  if (!slug) {
    return err(
      { ok: false, errorCode: "MISSING_SLUG", message: "Missing company slug." },
      400
    );
  }
  const master = findCompany(slug.toUpperCase());
  if (!master) {
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

  // 0. Has ingestion ever run?
  if (!SNAPSHOT.generatedAt) {
    return err(
      {
        ok: false,
        errorCode: "NO_SNAPSHOT",
        message:
          "Data has not been ingested yet. The GitHub Actions snapshot pipeline must run before scores can be calculated.",
        master,
      },
      503
    );
  }

  // 1. Pull this company's snapshot.
  const companyEntry = SNAPSHOT.companies[master.ticker];
  if (!companyEntry) {
    return err(
      {
        ok: false,
        errorCode: "SNAPSHOT_NOT_INGESTED",
        message: `${master.companyName} hasn't been ingested yet.`,
        master,
      },
      404
    );
  }
  if (companyEntry.status === "fetch_failed") {
    const code: ErrorCode = "SCREENER_FETCH_FAILED";
    return err(
      {
        ok: false,
        errorCode: code,
        message:
          companyEntry.errors?.[0] ??
          "The last ingestion run failed for this company.",
        master,
        ...(debug ? { debug: { slug: master.screenerSlug } } : {}),
      },
      502
    );
  }
  if (companyEntry.status === "parser_failed") {
    return err(
      {
        ok: false,
        errorCode: "PARSER_FAILED",
        message:
          companyEntry.errors?.[0] ??
          "Could not parse this company's last ingested page.",
        master,
      },
      502
    );
  }

  // 2. Resolve fiscal year against the company's available years.
  const yearMap = companyEntry.years ?? {};
  const availableAsc = Object.keys(yearMap).sort((a, b) => a.localeCompare(b));
  if (availableAsc.length === 0) {
    return err(
      {
        ok: false,
        errorCode: "SNAPSHOT_NOT_INGESTED",
        message: `${master.companyName} has no fiscal-year data in the snapshot.`,
        master,
      },
      404
    );
  }

  let fiscalYear: string;
  if (yearParam) {
    if (!availableAsc.includes(yearParam)) {
      return err(
        {
          ok: false,
          errorCode: "YEAR_NOT_FOUND",
          message: `Fiscal year FY${yearParam} is not available for this company.`,
          master,
          ...(debug ? { debug: { slug: master.screenerSlug, year: yearParam } } : {}),
        },
        404
      );
    }
    fiscalYear = yearParam;
  } else {
    fiscalYear = availableAsc[availableAsc.length - 1];
  }

  const idx = availableAsc.indexOf(fiscalYear);
  const current = yearMap[availableAsc[idx]];
  const prior = idx > 0 ? yearMap[availableAsc[idx - 1]] : undefined;

  // Strip internal-only fieldStatus before passing into the engine — it
  // should never leak into the response.
  const stripStatus = (y: FinancialYearData | undefined): FinancialYearData | undefined => {
    if (!y) return undefined;
    const { fieldStatus: _drop, ...rest } = y;
    void _drop;
    return rest as FinancialYearData;
  };

  const beneish = calculateBeneish(stripStatus(current), stripStatus(prior));
  const altman = calculateAltman(master, stripStatus(current));

  console.log("[scores] calc done", {
    ticker: master.ticker,
    fiscalYear,
    beneishStatus: beneish.status,
    altmanStatus: altman.status,
  });

  // 3. Per-year trend across the company's whole snapshot.
  const trend: TrendPoint[] = availableAsc.map((fy, i) => {
    const cur = stripStatus(yearMap[fy]);
    const pri = i > 0 ? stripStatus(yearMap[availableAsc[i - 1]]) : undefined;
    const b = calculateBeneish(cur, pri);
    const a = calculateAltman(master, cur);
    return {
      fiscalYear: fy,
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
    source: "screener",
    fetchedAt: SNAPSHOT.generatedAt ?? new Date().toISOString(),
  };

  return NextResponse.json(payload, { status: 200, headers: SUCCESS_HEADERS });
}
