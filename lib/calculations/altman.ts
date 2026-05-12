import type {
  AltmanOutcome,
  AltmanVariable,
  CompanyMaster,
  FinancialYearData,
} from "@/lib/types";

export const ALTMAN_WEIGHTS = {
  X1: 1.2,
  X2: 1.4,
  X3: 3.3,
  X4: 0.6,
  X5: 1.0,
} as const;

export const ALTMAN_DISTRESS = 1.8;
export const ALTMAN_SAFE = 3.0;

export const ALTMAN_FORMULAS = {
  X1: "Working Capital / Total Assets",
  X2: "Retained Earnings / Total Assets",
  X3: "EBIT / Total Assets",
  X4: "Market Value of Equity / Total Liabilities",
  X5: "Sales / Total Assets",
} as const;

const REQUIRED: Array<[keyof FinancialYearData, string]> = [
  ["currentAssets", "Current Assets"],
  ["currentLiabilities", "Current Liabilities"],
  ["totalAssets", "Total Assets"],
  ["retainedEarnings", "Retained Earnings"],
  ["ebit", "EBIT"],
  ["marketValueEquity", "Market Value of Equity"],
  ["totalLiabilities", "Total Liabilities"],
  ["sales", "Sales"],
];

function ok(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function calculateAltman(
  master: CompanyMaster,
  year: FinancialYearData | undefined
): AltmanOutcome {
  const fiscalYear = year?.fiscalYear ?? "—";

  if (master.isFinancialCompany) {
    return {
      status: "not_comparable",
      fiscalYear,
      reason: "Not Comparable / Sector Model Needed",
    };
  }

  if (!year) {
    return {
      status: "not_calculable",
      fiscalYear,
      missingVariables: ["Selected year financials"],
    };
  }

  const missing: string[] = [];
  for (const [field, label] of REQUIRED) {
    if (!ok(year[field] as number | null)) missing.push(label);
  }
  if (!ok(year.totalAssets) || (year.totalAssets ?? 0) === 0) {
    if (!missing.includes("Total Assets")) missing.push("Total Assets");
  }
  if (!ok(year.totalLiabilities) || (year.totalLiabilities ?? 0) === 0) {
    if (!missing.includes("Total Liabilities")) missing.push("Total Liabilities");
  }
  if (missing.length > 0)
    return { status: "not_calculable", fiscalYear, missingVariables: missing };

  const g = (k: keyof FinancialYearData): number => year[k] as number;
  const ca = g("currentAssets");
  const cl = g("currentLiabilities");
  const ta = g("totalAssets");
  const re = g("retainedEarnings");
  const ebit_ = g("ebit");
  const mve = g("marketValueEquity");
  const tl = g("totalLiabilities");
  const sales = g("sales");
  const workingCapital = ca - cl;

  const values = {
    X1: workingCapital / ta,
    X2: re / ta,
    X3: ebit_ / ta,
    X4: mve / tl,
    X5: sales / ta,
  };

  const variables: AltmanVariable[] = (
    Object.keys(ALTMAN_WEIGHTS) as Array<keyof typeof ALTMAN_WEIGHTS>
  ).map((key) => ({
    key,
    formula: ALTMAN_FORMULAS[key],
    value: values[key],
    weight: ALTMAN_WEIGHTS[key],
    contribution: values[key] * ALTMAN_WEIGHTS[key],
  }));

  const zScore = variables.reduce((sum, v) => sum + v.contribution, 0);
  const interpretation =
    zScore < ALTMAN_DISTRESS ? "distress" : zScore > ALTMAN_SAFE ? "safe" : "grey";

  return { status: "calculated", fiscalYear, variables, zScore, interpretation };
}
