/**
 * NSE/BSE XBRL ingestion stub.
 *
 * Status: NOT YET IMPLEMENTED.
 *
 * The full implementation needs to:
 *   1. Locate the appropriate XBRL filing for each (ticker, fiscalYear)
 *      — typically `https://www.bseindia.com/...` or `https://archives.nseindia.com/...`
 *      keyed off `nseSymbol` / `bseCode`.
 *   2. Download the XBRL document.
 *   3. Parse it (XBRL is just structured XML — a streaming parser like
 *      `sax` is fine in Node) and map each known concept namespace to
 *      a FinancialYearData field.
 *   4. Return `{ field, value, fieldSource: "xbrl" }` records.
 *
 * For now this returns an empty result so the build pipeline can run
 * end-to-end without fabricating values.  No estimates are produced.
 */

import type { CompanySourceMapItem, FinancialYearData } from "@/lib/types";

export interface XbrlField {
  field: keyof FinancialYearData;
  value: number;
  fieldSource: "xbrl";
}

export interface XbrlYearResult {
  fiscalYear: string;
  fields: XbrlField[];
}

export async function fetchXbrlForCompany(
  _company: CompanySourceMapItem
): Promise<XbrlYearResult[]> {
  // Intentionally empty.  Real implementation goes here.
  return [];
}
