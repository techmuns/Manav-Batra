/**
 * Annual-report PDF ingestion stub.
 *
 * Status: NOT YET IMPLEMENTED.
 *
 * The full implementation needs to:
 *   1. For each (ticker, fiscalYear) in company-source-map, fetch the
 *      annual-report PDF URL from `annualReportUrls`.
 *   2. Extract the Consolidated Balance Sheet, P&L, and Cash Flow
 *      tables.  Two practical paths:
 *        a. `pdf-parse` for text-based PDFs; table reconstruction
 *           via line-position heuristics.
 *        b. A dedicated table extractor (e.g. Camelot via a sidecar
 *           Python step, or `pdf-table-extractor`).
 *   3. Map each extracted row to a FinancialYearData field, preserving
 *      reported sign and unit.
 *   4. Return `{ field, value, fieldSource: "annual_report" }` records.
 *
 * For now this returns an empty result so the build pipeline can run
 * end-to-end without fabricating values.  No estimates are produced.
 */

import type { CompanySourceMapItem, FinancialYearData } from "@/lib/types";

export interface AnnualReportField {
  field: keyof FinancialYearData;
  value: number;
  fieldSource: "annual_report";
}

export interface AnnualReportYearResult {
  fiscalYear: string;
  fields: AnnualReportField[];
  sourceDocument: string;
  pageOrSection?: string;
}

export async function fetchAnnualReportsForCompany(
  _company: CompanySourceMapItem
): Promise<AnnualReportYearResult[]> {
  return [];
}
