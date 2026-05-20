/**
 * Sector-default ratios used to estimate the six fields that the
 * combined_financial_tool markdown does not provide:
 *   receivables, grossProfit, currentAssets, sgaExpense,
 *   currentLiabilities, operatingCashFlow.
 *
 * These are approximate Indian large-cap benchmarks intended as a
 * stop-gap until annual-report ingestion fills them with audited
 * numbers.  Values are marked `fieldStatus: "estimated"` so consumers
 * can tell they were not measured.
 *
 * Each ratio is applied to a real value already in FinancialYearData:
 *   receivables       = sales        * receivables_to_sales
 *   grossProfit       = sales        * gross_margin
 *   currentAssets     = totalAssets  * ca_to_assets
 *   sgaExpense        = sales        * sga_to_sales
 *   currentLiabilities= totalAssets  * cl_to_assets
 *   operatingCashFlow = netIncome    * ocf_to_ni       (when NI > 0)
 *
 * Banks / NBFCs / Insurance are intentionally excluded — Altman/Beneish
 * do not apply to financial companies and the calc engine already
 * returns `not_comparable` for them.
 */

export interface SectorRatios {
  receivables_to_sales: number;
  gross_margin: number;
  ca_to_assets: number;
  sga_to_sales: number;
  cl_to_assets: number;
  ocf_to_ni: number;
}

export const SECTOR_RATIOS: Record<string, SectorRatios> = {
  "IT Services": {
    receivables_to_sales: 0.18,
    gross_margin: 0.35,
    ca_to_assets: 0.55,
    sga_to_sales: 0.10,
    cl_to_assets: 0.20,
    ocf_to_ni: 1.15,
  },
  "Oil & Gas": {
    receivables_to_sales: 0.04,
    gross_margin: 0.15,
    ca_to_assets: 0.15,
    sga_to_sales: 0.04,
    cl_to_assets: 0.18,
    ocf_to_ni: 1.8,
  },
  Diversified: {
    receivables_to_sales: 0.032,
    gross_margin: 0.19,
    ca_to_assets: 0.18,
    sga_to_sales: 0.06,
    cl_to_assets: 0.17,
    ocf_to_ni: 2.0,
  },
  Auto: {
    receivables_to_sales: 0.10,
    gross_margin: 0.18,
    ca_to_assets: 0.30,
    sga_to_sales: 0.07,
    cl_to_assets: 0.25,
    ocf_to_ni: 1.3,
  },
  Pharma: {
    receivables_to_sales: 0.20,
    gross_margin: 0.55,
    ca_to_assets: 0.45,
    sga_to_sales: 0.15,
    cl_to_assets: 0.20,
    ocf_to_ni: 1.2,
  },
  FMCG: {
    receivables_to_sales: 0.08,
    gross_margin: 0.50,
    ca_to_assets: 0.35,
    sga_to_sales: 0.18,
    cl_to_assets: 0.30,
    ocf_to_ni: 1.3,
  },
  Cement: {
    receivables_to_sales: 0.05,
    gross_margin: 0.25,
    ca_to_assets: 0.20,
    sga_to_sales: 0.06,
    cl_to_assets: 0.20,
    ocf_to_ni: 1.6,
  },
  Metals: {
    receivables_to_sales: 0.10,
    gross_margin: 0.20,
    ca_to_assets: 0.25,
    sga_to_sales: 0.05,
    cl_to_assets: 0.20,
    ocf_to_ni: 1.5,
  },
  Power: {
    receivables_to_sales: 0.20,
    gross_margin: 0.30,
    ca_to_assets: 0.20,
    sga_to_sales: 0.04,
    cl_to_assets: 0.20,
    ocf_to_ni: 1.7,
  },
  Telecom: {
    receivables_to_sales: 0.05,
    gross_margin: 0.45,
    ca_to_assets: 0.15,
    sga_to_sales: 0.10,
    cl_to_assets: 0.30,
    ocf_to_ni: 2.0,
  },
  "Real Estate": {
    receivables_to_sales: 0.10,
    gross_margin: 0.30,
    ca_to_assets: 0.50,
    sga_to_sales: 0.08,
    cl_to_assets: 0.30,
    ocf_to_ni: 0.8,
  },
  "Capital Goods": {
    receivables_to_sales: 0.25,
    gross_margin: 0.25,
    ca_to_assets: 0.40,
    sga_to_sales: 0.10,
    cl_to_assets: 0.30,
    ocf_to_ni: 1.0,
  },
  Chemicals: {
    receivables_to_sales: 0.18,
    gross_margin: 0.25,
    ca_to_assets: 0.35,
    sga_to_sales: 0.08,
    cl_to_assets: 0.25,
    ocf_to_ni: 1.3,
  },
  "Consumer Goods": {
    receivables_to_sales: 0.10,
    gross_margin: 0.40,
    ca_to_assets: 0.30,
    sga_to_sales: 0.15,
    cl_to_assets: 0.25,
    ocf_to_ni: 1.3,
  },
  Retail: {
    receivables_to_sales: 0.05,
    gross_margin: 0.25,
    ca_to_assets: 0.30,
    sga_to_sales: 0.18,
    cl_to_assets: 0.35,
    ocf_to_ni: 1.4,
  },
  Construction: {
    receivables_to_sales: 0.30,
    gross_margin: 0.15,
    ca_to_assets: 0.45,
    sga_to_sales: 0.05,
    cl_to_assets: 0.40,
    ocf_to_ni: 0.9,
  },
  Aviation: {
    receivables_to_sales: 0.08,
    gross_margin: 0.10,
    ca_to_assets: 0.20,
    sga_to_sales: 0.05,
    cl_to_assets: 0.40,
    ocf_to_ni: 1.5,
  },
  Logistics: {
    receivables_to_sales: 0.15,
    gross_margin: 0.20,
    ca_to_assets: 0.35,
    sga_to_sales: 0.08,
    cl_to_assets: 0.30,
    ocf_to_ni: 1.4,
  },
  Media: {
    receivables_to_sales: 0.25,
    gross_margin: 0.35,
    ca_to_assets: 0.45,
    sga_to_sales: 0.18,
    cl_to_assets: 0.30,
    ocf_to_ni: 1.2,
  },
  Textiles: {
    receivables_to_sales: 0.12,
    gross_margin: 0.20,
    ca_to_assets: 0.40,
    sga_to_sales: 0.07,
    cl_to_assets: 0.30,
    ocf_to_ni: 1.1,
  },
};

export const DEFAULT_RATIOS: SectorRatios = {
  receivables_to_sales: 0.10,
  gross_margin: 0.25,
  ca_to_assets: 0.25,
  sga_to_sales: 0.08,
  cl_to_assets: 0.22,
  ocf_to_ni: 1.3,
};

export function ratiosForSector(sector: string): SectorRatios {
  return SECTOR_RATIOS[sector] ?? DEFAULT_RATIOS;
}
