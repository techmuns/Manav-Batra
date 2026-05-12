import type {
  AltmanOutcome,
  AltmanVariable,
  CompanyFinancials,
  YearFinancials,
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

function num(v: number | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function calculateAltman(
  company: CompanyFinancials,
  year: YearFinancials | undefined
): AltmanOutcome {
  if (company.sector === "financial") {
    return {
      status: "not_applicable",
      reason: "Not Comparable / Sector Model Needed",
    };
  }

  const missing: string[] = [];
  if (!year) {
    missing.push("Current year financials");
    return { status: "not_calculable", missing };
  }

  const required: Array<[keyof YearFinancials, string]> = [
    ["currentAssets", "Current Assets"],
    ["currentLiabilities", "Current Liabilities"],
    ["totalAssets", "Total Assets"],
    ["retainedEarnings", "Retained Earnings"],
    ["ebit", "EBIT"],
    ["marketCap", "Market Value of Equity"],
    ["totalLiabilities", "Total Liabilities"],
    ["sales", "Sales"],
  ];
  for (const [field, label] of required) {
    if (!num(year[field] as number | undefined)) missing.push(label);
  }
  if (missing.length > 0) return { status: "not_calculable", missing };

  const y = year as Required<YearFinancials>;
  const workingCapital = y.currentAssets - y.currentLiabilities;

  const values = {
    X1: workingCapital / y.totalAssets,
    X2: y.retainedEarnings / y.totalAssets,
    X3: y.ebit / y.totalAssets,
    X4: y.marketCap / y.totalLiabilities,
    X5: y.sales / y.totalAssets,
  };

  const variables: AltmanVariable[] = (
    Object.keys(ALTMAN_WEIGHTS) as Array<keyof typeof ALTMAN_WEIGHTS>
  ).map((key) => {
    const value = values[key];
    const weight = ALTMAN_WEIGHTS[key];
    return {
      key,
      formula: ALTMAN_FORMULAS[key],
      value,
      weight,
      contribution: value * weight,
    };
  });

  const zScore = variables.reduce((sum, v) => sum + v.contribution, 0);
  const interpretation =
    zScore < ALTMAN_DISTRESS ? "distress" : zScore > ALTMAN_SAFE ? "safe" : "grey";

  return { status: "ok", variables, zScore, interpretation };
}
