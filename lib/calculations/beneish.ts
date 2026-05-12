import type {
  BeneishOutcome,
  BeneishVariable,
  YearFinancials,
} from "@/lib/types";

export const BENEISH_WEIGHTS = {
  DSRI: 0.92,
  GMI: 0.528,
  AQI: 0.404,
  SGI: 0.892,
  DEPI: 0.115,
  SGAI: -0.172,
  TATA: 4.679,
  LVGI: -0.327,
} as const;

export const BENEISH_CONSTANT = -4.84;
export const BENEISH_CUTOFF = -1.78;

interface RequiredVar {
  field: keyof YearFinancials;
  period: "current" | "prior";
}

// Variable -> raw fields the variable depends on.
const REQUIRED: Record<keyof typeof BENEISH_WEIGHTS, RequiredVar[]> = {
  DSRI: [
    { field: "receivables", period: "current" },
    { field: "sales", period: "current" },
    { field: "receivables", period: "prior" },
    { field: "sales", period: "prior" },
  ],
  GMI: [
    { field: "sales", period: "current" },
    { field: "cogs", period: "current" },
    { field: "sales", period: "prior" },
    { field: "cogs", period: "prior" },
  ],
  AQI: [
    { field: "currentAssets", period: "current" },
    { field: "ppe", period: "current" },
    { field: "totalAssets", period: "current" },
    { field: "currentAssets", period: "prior" },
    { field: "ppe", period: "prior" },
    { field: "totalAssets", period: "prior" },
  ],
  SGI: [
    { field: "sales", period: "current" },
    { field: "sales", period: "prior" },
  ],
  DEPI: [
    { field: "depreciation", period: "current" },
    { field: "ppe", period: "current" },
    { field: "depreciation", period: "prior" },
    { field: "ppe", period: "prior" },
  ],
  SGAI: [
    { field: "sga", period: "current" },
    { field: "sales", period: "current" },
    { field: "sga", period: "prior" },
    { field: "sales", period: "prior" },
  ],
  TATA: [
    { field: "netIncomeBeforeExtraordinary", period: "current" },
    { field: "cfo", period: "current" },
    { field: "totalAssets", period: "current" },
  ],
  LVGI: [
    { field: "currentLiabilities", period: "current" },
    { field: "longTermDebt", period: "current" },
    { field: "totalAssets", period: "current" },
    { field: "currentLiabilities", period: "prior" },
    { field: "longTermDebt", period: "prior" },
    { field: "totalAssets", period: "prior" },
  ],
};

function fieldLabel(field: keyof YearFinancials, period: "current" | "prior") {
  const labels: Record<string, string> = {
    sales: "Sales",
    cogs: "COGS",
    sga: "SG&A",
    depreciation: "Depreciation",
    ebit: "EBIT",
    netIncomeBeforeExtraordinary: "Net Income (before extraordinary items)",
    receivables: "Receivables",
    currentAssets: "Current Assets",
    currentLiabilities: "Current Liabilities",
    ppe: "PP&E",
    totalAssets: "Total Assets",
    totalLiabilities: "Total Liabilities",
    longTermDebt: "Long-Term Debt",
    retainedEarnings: "Retained Earnings",
    cfo: "Cash Flow from Operations",
    marketCap: "Market Cap",
  };
  const suffix = period === "current" ? "(t)" : "(t-1)";
  return `${labels[field] ?? field} ${suffix}`;
}

function num(v: number | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function calculateBeneish(
  current: YearFinancials | undefined,
  prior: YearFinancials | undefined
): BeneishOutcome {
  const missing: string[] = [];
  if (!current) missing.push("Current year financials");
  if (!prior) missing.push("Prior year financials");

  if (current && prior) {
    for (const key of Object.keys(REQUIRED) as Array<keyof typeof REQUIRED>) {
      for (const req of REQUIRED[key]) {
        const src = req.period === "current" ? current : prior;
        if (!num(src[req.field] as number | undefined)) {
          const label = fieldLabel(req.field, req.period);
          if (!missing.includes(label)) missing.push(label);
        }
      }
    }
  }

  if (missing.length > 0 || !current || !prior) {
    return { status: "not_calculable", missing };
  }

  // Type-narrowed pulls — we just verified each input above.
  const c = current as Required<YearFinancials>;
  const p = prior as Required<YearFinancials>;

  const DSRI = (c.receivables / c.sales) / (p.receivables / p.sales);

  const grossMarginPrior = (p.sales - p.cogs) / p.sales;
  const grossMarginCurrent = (c.sales - c.cogs) / c.sales;
  const GMI = grossMarginPrior / grossMarginCurrent;

  const AQI =
    (1 - (c.currentAssets + c.ppe) / c.totalAssets) /
    (1 - (p.currentAssets + p.ppe) / p.totalAssets);

  const SGI = c.sales / p.sales;

  const DEPI =
    (p.depreciation / (p.depreciation + p.ppe)) /
    (c.depreciation / (c.depreciation + c.ppe));

  const SGAI = (c.sga / c.sales) / (p.sga / p.sales);

  const TATA =
    (c.netIncomeBeforeExtraordinary - c.cfo) / c.totalAssets;

  const LVGI =
    ((c.currentLiabilities + c.longTermDebt) / c.totalAssets) /
    ((p.currentLiabilities + p.longTermDebt) / p.totalAssets);

  const raw = { DSRI, GMI, AQI, SGI, DEPI, SGAI, TATA, LVGI };
  const variables: BeneishVariable[] = (
    Object.keys(BENEISH_WEIGHTS) as Array<keyof typeof BENEISH_WEIGHTS>
  ).map((key) => {
    const value = raw[key];
    const weight = BENEISH_WEIGHTS[key];
    return { key, value, weight, contribution: value * weight };
  });

  const mScore =
    BENEISH_CONSTANT +
    variables.reduce((sum, v) => sum + v.contribution, 0);

  return {
    status: "ok",
    constant: BENEISH_CONSTANT,
    variables,
    mScore,
    interpretation: mScore > BENEISH_CUTOFF ? "high" : "low",
  };
}
