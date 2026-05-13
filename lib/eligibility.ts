import { COMPANY_MASTER } from "@/data/companies";
import { calculateAltman, calculateBeneish } from "@/lib/calculations";
import type {
  EligibleCompany,
  EligibleScoreUniverse,
  GeneratedFinancialSnapshot,
} from "@/lib/types";

const VERIFIED_SOURCES = new Set<string>([
  "official_filings_pipeline",
  "annual_report_verified",
  "screener_github_actions",
]);

/**
 * Derive the set of (company, fiscalYear) pairs the dashboard is willing to
 * surface in its selector.  A pair is eligible only if:
 *
 *   - snapshot.source is on the verified list
 *   - the company entry has status === "ok"
 *   - the company is non-financial (Altman is not applicable to banks/NBFCs/insurers)
 *   - BOTH calculateBeneish and calculateAltman return status === "calculated"
 *     for that year against this snapshot's data
 *
 * No assumption, no estimation: we run the real calculators.  If either
 * one would render "Not Calculable", the year is dropped.  Companies with
 * zero eligible years are dropped entirely.
 */
export function buildEligibleUniverse(
  snapshot: GeneratedFinancialSnapshot
): EligibleScoreUniverse {
  const companies: EligibleCompany[] = [];

  // Hard guard: anything other than a verified source produces an empty universe.
  if (!VERIFIED_SOURCES.has(snapshot.source)) {
    return {
      generatedAt: snapshot.generatedAt ?? new Date(0).toISOString(),
      source: "derived_from_verified_snapshot",
      companies: [],
    };
  }

  for (const master of COMPANY_MASTER) {
    if (master.isFinancialCompany) continue;

    const entry = snapshot.companies[master.ticker];
    if (!entry || entry.status !== "ok") continue;

    const years = Object.keys(entry.years).sort((a, b) => a.localeCompare(b));
    const okYears: string[] = [];
    for (let i = 0; i < years.length; i += 1) {
      const fy = years[i];
      const cur = entry.years[fy];
      const pri = i > 0 ? entry.years[years[i - 1]] : undefined;
      const b = calculateBeneish(cur, pri);
      const a = calculateAltman(master, cur);
      if (b.status === "calculated" && a.status === "calculated") {
        okYears.push(fy);
      }
    }
    if (okYears.length === 0) continue;

    companies.push({
      companyName: master.companyName,
      ticker: master.ticker,
      screenerSlug: master.screenerSlug,
      sector: master.sector,
      // Newest first for selector convenience.
      availableFiscalYears: okYears.slice().reverse(),
    });
  }

  // Sort by company name for a stable selector order.
  companies.sort((a, b) => a.companyName.localeCompare(b.companyName));

  return {
    generatedAt: snapshot.generatedAt ?? new Date(0).toISOString(),
    source: "derived_from_verified_snapshot",
    companies,
  };
}
