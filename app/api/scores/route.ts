import { NextResponse } from "next/server";
import GURU from "./gurufocus-snapshot";
import { findCompany } from "@/data/companies";
import type {
  AltmanOutcome,
  BeneishOutcome,
  ConfidenceLevel,
  ErrorCode,
  GuruFocusScoreEntry,
  ScoresError,
  ScoresResponse,
  TrendPoint,
} from "@/lib/types";

const SUCCESS_HEADERS: HeadersInit = {
  "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400",
  "Content-Type": "application/json",
};
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
    const message = e instanceof Error ? e.message : String(e);
    console.error("[scores] uncaught", message, e);
    return NextResponse.json(
      { ok: false, errorCode: "ROUTE_FAILED", message: `Edge route threw: ${message}` },
      { status: 500, headers: ERROR_HEADERS }
    );
  }
}

async function handle(req: Request) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") ?? url.searchParams.get("ticker"))?.trim();
  const yearParam = url.searchParams.get("year")?.replace(/^FY/i, "").trim();
  const debug = url.searchParams.get("debug") === "1";

  console.log("[scores] request", { slug, yearParam, debug });

  if (!slug) {
    return err({ ok: false, errorCode: "MISSING_SLUG", message: "Missing company slug." }, 400);
  }
  const master = findCompany(slug.toUpperCase());
  if (!master) {
    return err(
      { ok: false, errorCode: "UNKNOWN_TICKER", message: "Company not found in master." },
      404
    );
  }

  // Snapshot must be from the verified GuruFocus source.
  if (GURU.source !== "gurufocus_github_actions") {
    return err(
      {
        ok: false,
        errorCode: "UNVERIFIED_SOURCE",
        message: `Snapshot source "${GURU.source}" is not allowed.`,
        master,
      },
      503
    );
  }
  if (!GURU.generatedAt) {
    return err(
      {
        ok: false,
        errorCode: "NO_SNAPSHOT",
        message:
          "Verified data not available. Run the GitHub Actions GuruFocus ingestion workflow.",
        master,
      },
      503
    );
  }

  const entry = GURU.companies[master.ticker];
  if (!entry || entry.status !== "ok") {
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

  // Combine the two GuruFocus score entries to drive the unified
  // ScoresResponse the dashboards already consume.  No component-level
  // data is available from GuruFocus, so beneish.variables / altman.variables
  // stay empty and the dashboards switch off their per-component panels.
  const allFiscalYears = collectFiscalYears(entry.mScore, entry.zScore);

  // Resolve the requested year against what GuruFocus actually exposes.
  const availableAsc = [...allFiscalYears].sort((a, b) => a.localeCompare(b));
  let fiscalYear: string;
  if (yearParam) {
    if (!availableAsc.includes(yearParam) && yearParam !== "current") {
      return err(
        {
          ok: false,
          errorCode: "YEAR_NOT_FOUND",
          message: `FY${yearParam} is not available for this company on GuruFocus.`,
          master,
          ...(debug ? { debug: { slug: master.ticker, year: yearParam } } : {}),
        },
        404
      );
    }
    fiscalYear = yearParam === "current" ? "current" : yearParam;
  } else {
    fiscalYear = availableAsc[availableAsc.length - 1] ?? "current";
  }

  const beneish = buildBeneish(entry.mScore, fiscalYear);
  const altman = buildAltman(entry.zScore, fiscalYear);

  const trend = buildTrend(entry.mScore, entry.zScore, availableAsc);

  // Quality grade.  GuruFocus is third-party published data → "Medium"
  // by default; "Not Available" when the score itself was blocked.
  const mConf: ConfidenceLevel =
    entry.mScore.status === "ok" ? "Medium" : "Not Available";
  const zConf: ConfidenceLevel =
    entry.zScore.status === "ok" ? "Medium" : "Not Available";

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
    source: "screener", // legacy field; UI no longer reads it
    fetchedAt: GURU.generatedAt ?? new Date().toISOString(),
    dataQuality: {
      // Reuse the existing UI field; tag honestly with the new source.
      snapshotSource: GURU.source as unknown as ScoresResponse["dataQuality"]["snapshotSource"],
      lastUpdated: GURU.generatedAt,
      beneishConfidence: mConf,
      altmanConfidence: zConf,
    },
  };

  console.log("[scores] returning", {
    ticker: master.ticker,
    fiscalYear,
    mScore: entry.mScore.currentValue,
    zScore: entry.zScore.currentValue,
    mStatus: entry.mScore.status,
    zStatus: entry.zScore.status,
  });

  // Unused but accepted (kept for future debug payloads).
  void debug;

  return NextResponse.json(payload, { status: 200, headers: SUCCESS_HEADERS });
}

// ---------- helpers --------------------------------------------------------

function collectFiscalYears(
  m: GuruFocusScoreEntry,
  z: GuruFocusScoreEntry
): string[] {
  const set = new Set<string>();
  for (const a of m.annual) set.add(a.fiscalYear);
  for (const a of z.annual) set.add(a.fiscalYear);
  return [...set];
}

function buildBeneish(
  m: GuruFocusScoreEntry,
  fiscalYear: string
): BeneishOutcome {
  if (m.status !== "ok" || m.currentValue == null) {
    return {
      status: "not_calculable",
      fiscalYear,
      missingVariables:
        m.status === "premium_only"
          ? ["M-Score is premium-only on this GuruFocus page"]
          : m.status === "blocked"
            ? ["GuruFocus blocked the request"]
            : ["GuruFocus did not return a current M-Score"],
    };
  }
  // GuruFocus exposes the headline score, not the 8 component values.
  return {
    status: "calculated",
    fiscalYear,
    constant: -4.84,
    variables: [], // empty → dashboards hide the component panels
    mScore: m.currentValue,
    interpretation: m.currentValue > -1.78 ? "high" : "low",
  };
}

function buildAltman(
  z: GuruFocusScoreEntry,
  fiscalYear: string
): AltmanOutcome {
  if (z.status !== "ok" || z.currentValue == null) {
    return {
      status: "not_calculable",
      fiscalYear,
      missingVariables:
        z.status === "premium_only"
          ? ["Z-Score is premium-only on this GuruFocus page"]
          : z.status === "blocked"
            ? ["GuruFocus blocked the request"]
            : ["GuruFocus did not return a current Z-Score"],
    };
  }
  const zone = z.currentValue < 1.8 ? "distress" : z.currentValue > 3.0 ? "safe" : "grey";
  return {
    status: "calculated",
    fiscalYear,
    variables: [], // empty → AltmanDashboard hides per-variable detail
    zScore: z.currentValue,
    interpretation: zone,
  };
}

function buildTrend(
  m: GuruFocusScoreEntry,
  z: GuruFocusScoreEntry,
  yearsAsc: string[]
): TrendPoint[] {
  // If GuruFocus exposed historical annual values, plot them.  If only
  // the current score is available, plot a single "current" point.
  if (yearsAsc.length === 0) {
    return [
      {
        fiscalYear: "current",
        mScore: m.status === "ok" ? m.currentValue : null,
        zScore: z.status === "ok" ? z.currentValue : null,
      },
    ];
  }
  const mByYear = new Map(m.annual.map((p) => [p.fiscalYear, p.value]));
  const zByYear = new Map(z.annual.map((p) => [p.fiscalYear, p.value]));
  return yearsAsc.map((fy) => ({
    fiscalYear: fy,
    mScore: mByYear.get(fy) ?? null,
    zScore: zByYear.get(fy) ?? null,
  }));
}

// Re-export the legacy ErrorCode union to avoid breakage in error consumers.
export type { ErrorCode };
