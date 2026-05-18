import type {
  BeneishOutcome,
  BeneishVariable,
  FinancialYearData,
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

const LABELS: Record<keyof FinancialYearData, string> = {
  fiscalYear: "Fiscal Year",
  sales: "Sales",
  receivables: "Receivables",
  grossProfit: "Gross Profit",
  currentAssets: "Current Assets",
  ppe: "PP&E",
  totalAssets: "Total Assets",
  depreciation: "Depreciation",
  sgaExpense: "SG&A Expense",
  totalDebt: "Total Debt",
  currentLiabilities: "Current Liabilities",
  retainedEarnings: "Retained Earnings",
  ebit: "EBIT",
  marketValueEquity: "Market Value of Equity",
  totalLiabilities: "Total Liabilities",
  operatingCashFlow: "Operating Cash Flow",
  netIncome: "Net Income",
  fieldStatus: "",
};

// Variable -> [(field, period)] dependencies. Period "t" = current year, "p" = prior.
const DEPS: Record<keyof typeof BENEISH_WEIGHTS, Array<[keyof FinancialYearData, "t" | "p"]>> = {
  DSRI: [["receivables", "t"], ["sales", "t"], ["receivables", "p"], ["sales", "p"]],
  GMI: [["grossProfit", "t"], ["sales", "t"], ["grossProfit", "p"], ["sales", "p"]],
  AQI: [
    ["currentAssets", "t"], ["ppe", "t"], ["totalAssets", "t"],
    ["currentAssets", "p"], ["ppe", "p"], ["totalAssets", "p"],
  ],
  SGI: [["sales", "t"], ["sales", "p"]],
  DEPI: [["depreciation", "t"], ["ppe", "t"], ["depreciation", "p"], ["ppe", "p"]],
  SGAI: [["sgaExpense", "t"], ["sales", "t"], ["sgaExpense", "p"], ["sales", "p"]],
  TATA: [["netIncome", "t"], ["operatingCashFlow", "t"], ["totalAssets", "t"]],
  LVGI: [
    ["totalDebt", "t"], ["currentLiabilities", "t"], ["totalAssets", "t"],
    ["totalDebt", "p"], ["currentLiabilities", "p"], ["totalAssets", "p"],
  ],
};

function ok(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function nonzero(n: number | null | undefined): n is number {
  return ok(n) && n !== 0;
}

export function calculateBeneish(
  current: FinancialYearData | undefined,
  prior: FinancialYearData | undefined
): BeneishOutcome {
  const fiscalYear = current?.fiscalYear ?? prior?.fiscalYear ?? "—";
  const missing: string[] = [];

  if (!current) {
    return { status: "not_calculable", fiscalYear, missingVariables: ["Current year financials"] };
  }
  if (!prior) {
    return {
      status: "not_calculable",
      fiscalYear,
      missingVariables: ["Prior year financials (required for year-over-year ratios)"],
    };
  }

  // Collect every missing input across all variables.
  for (const key of Object.keys(DEPS) as Array<keyof typeof DEPS>) {
    for (const [field, period] of DEPS[key]) {
      const src = period === "t" ? current : prior;
      const label = `${LABELS[field]} (${period === "t" ? "FY" + fiscalYear : "FY prev"})`;
      if (!ok(src[field] as number | null)) {
        if (!missing.includes(label)) missing.push(label);
      }
    }
  }

  // Denominator guards — these are domain-required non-zeros for the ratios.
  const denomChecks: Array<[unknown, string]> = [
    [current.sales, `Sales (FY${fiscalYear}) must be non-zero`],
    [prior.sales, "Sales (FY prev) must be non-zero"],
    [current.totalAssets, `Total Assets (FY${fiscalYear}) must be non-zero`],
    [prior.totalAssets, "Total Assets (FY prev) must be non-zero"],
    [prior.receivables, "Receivables (FY prev) must be non-zero"],
    [prior.grossProfit, "Gross Profit (FY prev) must be non-zero"],
  ];
  for (const [v, label] of denomChecks) {
    if (!nonzero(v as number | null) && !missing.includes(label)) missing.push(label);
  }

  if (missing.length > 0)
    return { status: "not_calculable", fiscalYear, missingVariables: missing };

  // Every input is verified non-null above; pull into a non-null view.
  const g = (y: FinancialYearData, k: keyof FinancialYearData): number =>
    y[k] as number;

  const c_recv = g(current, "receivables");
  const c_sales = g(current, "sales");
  const p_recv = g(prior, "receivables");
  const p_sales = g(prior, "sales");
  const c_gp = g(current, "grossProfit");
  const p_gp = g(prior, "grossProfit");
  const c_ca = g(current, "currentAssets");
  const c_ppe = g(current, "ppe");
  const c_ta = g(current, "totalAssets");
  const p_ca = g(prior, "currentAssets");
  const p_ppe = g(prior, "ppe");
  const p_ta = g(prior, "totalAssets");
  const c_dep = g(current, "depreciation");
  const p_dep = g(prior, "depreciation");
  const c_sga = g(current, "sgaExpense");
  const p_sga = g(prior, "sgaExpense");
  const c_ni = g(current, "netIncome");
  const c_ocf = g(current, "operatingCashFlow");
  const c_debt = g(current, "totalDebt");
  const c_cl = g(current, "currentLiabilities");
  const p_debt = g(prior, "totalDebt");
  const p_cl = g(prior, "currentLiabilities");

  const DSRI = (c_recv / c_sales) / (p_recv / p_sales);

  const grossMarginPrior = p_gp / p_sales;
  const grossMarginCurrent = c_gp / c_sales;
  if (grossMarginCurrent === 0) {
    return { status: "not_calculable", fiscalYear, missingVariables: ["Current Gross Margin is zero"] };
  }
  const GMI = grossMarginPrior / grossMarginCurrent;

  const AQI = (1 - (c_ca + c_ppe) / c_ta) / (1 - (p_ca + p_ppe) / p_ta);
  const SGI = c_sales / p_sales;

  const depPriorDenom = p_dep + p_ppe;
  const depCurrentDenom = c_dep + c_ppe;
  if (depPriorDenom === 0 || depCurrentDenom === 0) {
    return {
      status: "not_calculable",
      fiscalYear,
      missingVariables: ["Depreciation + PPE is zero in current or prior year"],
    };
  }
  const DEPI = (p_dep / depPriorDenom) / (c_dep / depCurrentDenom);

  const SGAI = (c_sga / c_sales) / (p_sga / p_sales);
  const TATA = (c_ni - c_ocf) / c_ta;
  const LVGI = ((c_debt + c_cl) / c_ta) / ((p_debt + p_cl) / p_ta);

  const raw = { DSRI, GMI, AQI, SGI, DEPI, SGAI, TATA, LVGI };
  for (const key of Object.keys(raw) as Array<keyof typeof raw>) {
    if (!Number.isFinite(raw[key])) {
      return {
        status: "not_calculable",
        fiscalYear,
        missingVariables: [`${key} could not be computed (division-by-zero or invalid input)`],
      };
    }
  }

  // Per-variable formula + input-field metadata so the API can return
  // each component with its own provenance and confidence grading.
  const BENEISH_META: Record<keyof typeof BENEISH_WEIGHTS, { formula: string; inputFields: string[] }> = {
    DSRI: {
      formula: "(Receivables_t / Sales_t) ÷ (Receivables_t-1 / Sales_t-1)",
      inputFields: ["receivables (t)", "sales (t)", "receivables (t-1)", "sales (t-1)"],
    },
    GMI: {
      formula:
        "(GrossProfit_t-1 / Sales_t-1) ÷ (GrossProfit_t / Sales_t)",
      inputFields: ["grossProfit (t)", "sales (t)", "grossProfit (t-1)", "sales (t-1)"],
    },
    AQI: {
      formula:
        "[1 − (CurrentAssets_t + PPE_t)/TotalAssets_t] ÷ [1 − (CurrentAssets_t-1 + PPE_t-1)/TotalAssets_t-1]",
      inputFields: [
        "currentAssets (t)", "ppe (t)", "totalAssets (t)",
        "currentAssets (t-1)", "ppe (t-1)", "totalAssets (t-1)",
      ],
    },
    SGI: { formula: "Sales_t ÷ Sales_t-1", inputFields: ["sales (t)", "sales (t-1)"] },
    DEPI: {
      formula:
        "[Dep_t-1 / (Dep_t-1 + PPE_t-1)] ÷ [Dep_t / (Dep_t + PPE_t)]",
      inputFields: ["depreciation (t)", "ppe (t)", "depreciation (t-1)", "ppe (t-1)"],
    },
    SGAI: {
      formula: "(SGA_t / Sales_t) ÷ (SGA_t-1 / Sales_t-1)",
      inputFields: ["sgaExpense (t)", "sales (t)", "sgaExpense (t-1)", "sales (t-1)"],
    },
    TATA: {
      formula: "(NetIncome_t − OperatingCashFlow_t) ÷ TotalAssets_t",
      inputFields: ["netIncome (t)", "operatingCashFlow (t)", "totalAssets (t)"],
    },
    LVGI: {
      formula:
        "[(TotalDebt_t + CurrentLiabilities_t)/TotalAssets_t] ÷ [(TotalDebt_t-1 + CurrentLiabilities_t-1)/TotalAssets_t-1]",
      inputFields: [
        "totalDebt (t)", "currentLiabilities (t)", "totalAssets (t)",
        "totalDebt (t-1)", "currentLiabilities (t-1)", "totalAssets (t-1)",
      ],
    },
  };

  // All inputs were verified non-null before this point — every per-variable
  // entry below is therefore "calculated".  Confidence is graded by the
  // route layer from snapshot/field-level provenance; default to "Medium"
  // when no provenance is supplied.
  const variables: BeneishVariable[] = (
    Object.keys(BENEISH_WEIGHTS) as Array<keyof typeof BENEISH_WEIGHTS>
  ).map((key) => {
    const value = raw[key];
    const weight = BENEISH_WEIGHTS[key];
    return {
      key,
      value,
      weight,
      contribution: value * weight,
      formula: BENEISH_META[key].formula,
      inputFields: BENEISH_META[key].inputFields,
      missingFields: [],
      confidence: "Medium",
    };
  });

  const mScore =
    BENEISH_CONSTANT + variables.reduce((sum, v) => sum + v.contribution, 0);

  return {
    status: "calculated",
    fiscalYear,
    constant: BENEISH_CONSTANT,
    variables,
    mScore,
    interpretation: mScore > BENEISH_CUTOFF ? "high" : "low",
  };
}
