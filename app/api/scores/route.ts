import { NextResponse } from "next/server";
import { findCompany } from "@/data/companies";
import { devMockYearsFor } from "@/data/devMockFinancials";
import { calculateAltman, calculateBeneish } from "@/lib/calculations";
import { fetchFromScreener } from "@/lib/screener/fetch";
import type {
  FinancialYearData,
  ScoresError,
  ScoresResponse,
  TrendPoint,
} from "@/lib/types";

export const runtime = "edge";

const NO_STORE: HeadersInit = {
  "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400",
};

function err(payload: ScoresError, status: number) {
  return NextResponse.json(payload, { status });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  // Accept both ?slug=INFY and ?ticker=INFY for convenience.
  const slug = (url.searchParams.get("slug") ?? url.searchParams.get("ticker"))?.trim();
  // Accept either "2025" or "FY2025".
  const yearParam = url.searchParams.get("year")?.replace(/^FY/i, "").trim();
  const dev = url.searchParams.get("dev") === "1";

  if (!slug) {
    return err({ error: "missing_slug", message: "Missing company slug." }, 400);
  }
  const master = findCompany(slug.toUpperCase());
  if (!master) {
    return err({ error: "unknown_ticker", message: "Company not found in master." }, 404);
  }

  // 1. Try real Screener first.
  let years: FinancialYearData[] = [];
  let source: ScoresResponse["source"] = "screener";
  let fetchError: string | undefined;

  const result = await fetchFromScreener(master);
  if (result.ok && result.years.length > 0) {
    years = result.years;
  } else {
    fetchError = result.error;
  }

  // 2. Dev mock — ONLY when explicitly requested via ?dev=1.
  if (years.length === 0 && dev) {
    const mock = devMockYearsFor(master.ticker);
    if (mock) {
      years = mock;
      source = "dev_mock";
    }
  }

  // 3. Honest failure — never substitute mock silently.
  if (years.length === 0) {
    return err(
      {
        error: "fetch_failed",
        message:
          "Unable to fetch company financials right now. Please try again.",
        master,
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

  // 4. Resolve selected year — fall back to latest if missing/unknown.
  const fiscalYear =
    yearParam && availableAsc.includes(yearParam)
      ? yearParam
      : availableAsc[availableAsc.length - 1];

  const idx = sortedAsc.findIndex((y) => y.fiscalYear === fiscalYear);
  if (idx < 0) {
    return err(
      {
        error: "year_unavailable",
        message: "Selected fiscal year is not available for this company.",
        master,
      },
      404
    );
  }

  // 5. Per-year score calc against the prior year.
  const current = sortedAsc[idx];
  const prior = idx > 0 ? sortedAsc[idx - 1] : undefined;

  const beneish = calculateBeneish(current, prior);
  const altman = calculateAltman(master, current);

  // 6. Full trend — every year, gaps where inputs missing.
  const trend: TrendPoint[] = sortedAsc.map((y, i) => {
    const b = calculateBeneish(y, i > 0 ? sortedAsc[i - 1] : undefined);
    const a = calculateAltman(master, y);
    return {
      fiscalYear: y.fiscalYear,
      mScore: b.status === "ok" ? +b.mScore.toFixed(3) : null,
      zScore: a.status === "ok" ? +a.zScore.toFixed(3) : null,
    };
  });

  const payload: ScoresResponse = {
    master,
    fiscalYear,
    availableYears: [...availableAsc].reverse(),
    beneish,
    altman,
    trend,
    source,
    fetchedAt: new Date().toISOString(),
  };

  // Suppress unused — kept available for future debug headers if needed.
  void fetchError;

  return NextResponse.json(payload, { status: 200, headers: NO_STORE });
}
