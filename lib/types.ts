// Financial data shape. The structure mirrors what we expect to ingest
// from Screener.com first (with annual-report fallback later). All
// numeric fields are optional so missing values can be detected by
// the calculation engine without making assumptions.

export type SectorKind = "non_financial" | "financial";

export interface YearFinancials {
  year: number;

  // Income statement
  sales?: number;
  cogs?: number;
  sga?: number;
  depreciation?: number;
  ebit?: number;
  netIncomeBeforeExtraordinary?: number;

  // Balance sheet
  receivables?: number;
  currentAssets?: number;
  currentLiabilities?: number;
  ppe?: number; // property, plant & equipment (net)
  totalAssets?: number;
  totalLiabilities?: number;
  longTermDebt?: number;
  retainedEarnings?: number;

  // Cash flow
  cfo?: number; // cash flow from operations

  // Market data
  marketCap?: number; // proxy for market value of equity

  // Internal-only provenance (never shown in UI)
  _sources?: Record<string, "screener" | "annual_report" | "manual">;
}

export interface CompanyFinancials {
  ticker: string;
  name: string;
  sector: SectorKind;
  sectorLabel?: string; // e.g. "IT Services", "Bank" — used only for internal flagging
  years: YearFinancials[];
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
  variables: AltmanVariable[];
  zScore: number;
  interpretation: "distress" | "grey" | "safe";
}

// ----- Shared not-calculable / not-applicable shapes --------------------

export interface NotCalculable {
  status: "not_calculable";
  missing: string[];
}

export interface NotApplicable {
  status: "not_applicable";
  reason: string;
}

export type BeneishOutcome = BeneishResult | NotCalculable;
export type AltmanOutcome = AltmanResult | NotCalculable | NotApplicable;
