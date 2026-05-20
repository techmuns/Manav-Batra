import type {
  EligibleCompany,
  EligibleScoreUniverse,
  GuruFocusSnapshot,
} from "@/lib/types";

const VERIFIED_SOURCES = new Set<string>(["gurufocus_github_actions"]);

export type ScoreTypeFilter = "altman" | "beneish" | "both";

/**
 * Build the set of company-year pairs the dashboard is willing to surface,
 * based on the bundled GuruFocus snapshot.
 *
 * Eligibility rules:
 *   - snapshot.source must be on the verified list
 *   - company.status === "ok"
 *   - for "altman": zScore.status === "ok" and currentValue != null
 *   - for "beneish": mScore.status === "ok" and currentValue != null
 *   - for "both": both conditions above
 *
 * No financial-company exclusion here — GuruFocus reports M-Score / Z-Score
 * for financial companies too, and the user explicitly asked to reflect
 * what's on the GuruFocus page rather than apply our own sector overrides.
 */
export function buildEligibleUniverse(
  snapshot: GuruFocusSnapshot,
  scoreType: ScoreTypeFilter = "both"
): EligibleScoreUniverse {
  if (!VERIFIED_SOURCES.has(snapshot.source)) {
    return {
      generatedAt: snapshot.generatedAt ?? new Date(0).toISOString(),
      source: "derived_from_verified_snapshot",
      companies: [],
    };
  }

  const companies: EligibleCompany[] = [];
  for (const [ticker, entry] of Object.entries(snapshot.companies)) {
    if (entry.status !== "ok") continue;

    const mOk =
      entry.mScore.status === "ok" && entry.mScore.currentValue != null;
    const zOk =
      entry.zScore.status === "ok" && entry.zScore.currentValue != null;

    if (scoreType === "altman" && !zOk) continue;
    if (scoreType === "beneish" && !mOk) continue;
    if (scoreType === "both" && !(mOk && zOk)) continue;

    // Available years are whatever GuruFocus exposed; if only the current
    // score is visible, expose "current" so the selector has something to
    // show.  The runtime gracefully handles "current".
    const annual = scoreType === "altman" ? entry.zScore.annual : entry.mScore.annual;
    const years = annual.length > 0 ? annual.map((a) => a.fiscalYear) : ["current"];

    companies.push({
      companyName: entry.companyName,
      ticker,
      screenerSlug: ticker,
      sector: entry.sector,
      availableFiscalYears: years.slice().reverse(),
    });
  }

  companies.sort((a, b) => a.companyName.localeCompare(b.companyName));

  return {
    generatedAt: snapshot.generatedAt ?? new Date(0).toISOString(),
    source: "derived_from_verified_snapshot",
    companies,
  };
}
