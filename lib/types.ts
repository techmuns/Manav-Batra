// Normalized financial data shape.  Every field is `number | null`.
// `null` means: not present for this year — either Screener didn't expose
// it or it needs annual-report fallback (see `fieldStatus`).  The calc
// engine treats null/missing as blocking, never as zero.

export interface FinancialYearData {
  fiscalYear: string;

  // Income statement
  sales: number | null;
  receivables: number | null;
  grossProfit: number | null;
  currentAssets: number | null;
  ppe: number | null;
  totalAssets: number | null;
  depreciation: number | null;
  sgaExpense: number | null;
  totalDebt: number | null;
  currentLiabilities: number | null;
  retainedEarnings: number | null;
  ebit: number | null;
  marketValueEquity: number | null;
  totalLiabilities: number | null;
  operatingCashFlow: number | null;
  netIncome: number | null;

  // Internal-only provenance.  Never read by any UI component.
  fieldStatus?: Record<
    string,
    "available" | "missing" | "annual_report_required"
  >;
}

export interface CompanyMaster {
  companyName: string;
  ticker: string;
  screenerSlug: string;
  sector: string;
  isFinancialCompany: boolean;
}

export interface CompanyFinancials {
  master: CompanyMaster;
  years: FinancialYearData[]; // sorted ascending by fiscalYear
  // Internal-only — never read by the UI.
  _fetchError?: string;
}

// ----- Beneish ----------------------------------------------------------

export type BeneishVariableKey =
  | "DSRI"
  | "GMI"
  | "AQI"
  | "SGI"
  | "DEPI"
  | "SGAI"
  | "TATA"
  | "LVGI";

export interface BeneishVariable {
  key: BeneishVariableKey;
  value: number;
  weight: number;
  contribution: number;
}

export interface BeneishResult {
  status: "ok";
  fiscalYear: string;
  constant: number;
  variables: BeneishVariable[];
  mScore: number;
  interpretation: "low" | "high";
}

// ----- Altman -----------------------------------------------------------

export type AltmanVariableKey = "X1" | "X2" | "X3" | "X4" | "X5";

export interface AltmanVariable {
  key: AltmanVariableKey;
  formula: string;
  value: number;
  weight: number;
  contribution: number;
}

export interface AltmanResult {
  status: "ok";
  fiscalYear: string;
  variables: AltmanVariable[];
  zScore: number;
  interpretation: "distress" | "grey" | "safe";
}

// ----- Shared -----------------------------------------------------------

export interface NotCalculable {
  status: "not_calculable";
  fiscalYear: string;
  missing: string[];
}

export interface NotApplicable {
  status: "not_applicable";
  fiscalYear: string;
  reason: string;
}

export type BeneishOutcome = BeneishResult | NotCalculable;
export type AltmanOutcome = AltmanResult | NotCalculable | NotApplicable;

// ----- API contract -----------------------------------------------------

export interface TrendPoint {
  fiscalYear: string;
  mScore: number | null;
  zScore: number | null;
}

export interface ScoresResponse {
  master: CompanyMaster;
  fiscalYear: string;
  availableYears: string[]; // newest first, for the year selector
  beneish: BeneishOutcome;
  altman: AltmanOutcome;
  trend: TrendPoint[]; // ascending order for the chart
  /** Internal: which path produced the data. UI may use to render a
   * sample-data banner when source === "dev_mock". */
  source: "screener" | "dev_mock";
  fetchedAt: string;
}

export interface ScoresError {
  error: "fetch_failed" | "unknown_ticker" | "no_data" | "year_unavailable" | "missing_slug";
  message: string;
  master?: CompanyMaster;
}
