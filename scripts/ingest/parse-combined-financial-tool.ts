/**
 * Parser for the "combined_financial_tool.txt" markdown format.
 *
 * Format reference: a single .txt per company with sections like
 *   ## Stock details
 *   ## Balance Sheet         (year columns: Mar 2015 .. Mar 2026)
 *   ## Profit & Loss         (year columns: Mar 2015 .. Mar 2026)
 *   ## Quarterly Results     (ignored for annual mapping)
 *   ## Peer Comparison       (ignored)
 *
 * Maps to FinancialYearData per fiscal year, populating only the
 * fields the format actually provides.  Six fields are intentionally
 * left null (receivables, grossProfit, currentAssets, sgaExpense,
 * currentLiabilities, operatingCashFlow) — they require annual-report
 * ingestion and are tagged `annual_report_required` in fieldStatus.
 */

import type {
  CompanyFinancialSnapshot,
  CompanyMaster,
  FinancialYearData,
} from "@/lib/types";

const AVAILABLE: NonNullable<FinancialYearData["fieldStatus"]>[string] = "available";
const AR_REQUIRED: NonNullable<FinancialYearData["fieldStatus"]>[string] =
  "annual_report_required";

interface TableRow {
  label: string;
  values: Record<string, number | null>;
}

interface ParsedTable {
  columns: string[]; // fiscal year labels (e.g. ["2015", "2016", ...])
  rows: TableRow[];
}

function stripCommas(s: string): string {
  return s.replace(/,/g, "");
}

function parseNumber(cell: string): number | null {
  const t = stripCommas(cell.trim());
  if (!t || t === "-") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function normaliseYear(col: string): string {
  // "Mar 2024" -> "2024"; "Sep 2023" -> "2023" (callers should not pass
  // quarterly columns to year-keyed callers).
  const m = col.match(/(\d{4})/);
  return m ? m[1] : col.trim();
}

function extractSection(markdown: string, heading: string): string | null {
  // Returns the body of a `## <heading>` section up to the next `## ` or EOF.
  const re = new RegExp(
    `^##\\s+${heading}\\s*$([\\s\\S]*?)(?=^##\\s+|\\Z)`,
    "m"
  );
  const m = markdown.match(re);
  return m ? m[1] : null;
}

function parseMarkdownTable(section: string): ParsedTable | null {
  const lines = section.split("\n").map((l) => l.trim()).filter(Boolean);
  // Find the header row (first line starting with `|`).
  const headerIdx = lines.findIndex((l) => l.startsWith("|"));
  if (headerIdx === -1) return null;
  const header = lines[headerIdx];
  const cells = header.split("|").slice(1, -1).map((c) => c.trim());
  // First column is the row label; rest are period columns.
  const columns = cells.slice(1).map(normaliseYear);

  const rows: TableRow[] = [];
  // Skip header and separator line.
  for (let i = headerIdx + 2; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.startsWith("|")) continue;
    const parts = line.split("|").slice(1, -1).map((c) => c.trim());
    if (parts.length < 2) continue;
    const label = parts[0];
    const values: Record<string, number | null> = {};
    parts.slice(1).forEach((cell, idx) => {
      const yr = columns[idx];
      if (yr) values[yr] = parseNumber(cell);
    });
    rows.push({ label, values });
  }
  return { columns, rows };
}

function findRow(table: ParsedTable, ...needles: string[]): TableRow | null {
  for (const r of table.rows) {
    const lbl = r.label.replace(/\s*\+\s*$/, "").toLowerCase().trim();
    if (needles.some((n) => lbl === n.toLowerCase())) return r;
  }
  return null;
}

function getMarketCapCrore(markdown: string): number | null {
  // Stock details section: "- **Market Cap**: ₹ 18,08,554 Cr."
  const sec = extractSection(markdown, "Stock details");
  if (!sec) return null;
  const m = sec.match(/Market Cap[^:]*:\s*₹?\s*([0-9,]+)\s*Cr/i);
  if (!m) return null;
  return parseNumber(m[1]);
}

function findLatestYear(years: string[]): string | null {
  if (!years.length) return null;
  return years.slice().sort().at(-1) ?? null;
}

function blankYear(fiscalYear: string): FinancialYearData {
  return {
    fiscalYear,
    sales: null,
    receivables: null,
    grossProfit: null,
    currentAssets: null,
    ppe: null,
    totalAssets: null,
    depreciation: null,
    sgaExpense: null,
    totalDebt: null,
    currentLiabilities: null,
    retainedEarnings: null,
    ebit: null,
    marketValueEquity: null,
    totalLiabilities: null,
    operatingCashFlow: null,
    netIncome: null,
    fieldStatus: {},
  };
}

const AR_REQUIRED_FIELDS: (keyof FinancialYearData)[] = [
  "receivables",
  "grossProfit",
  "currentAssets",
  "sgaExpense",
  "currentLiabilities",
  "operatingCashFlow",
];

export function parseCombinedFinancialTool(
  markdown: string,
  master: CompanyMaster
): CompanyFinancialSnapshot {
  const bsSection = extractSection(markdown, "Balance Sheet");
  const plSection = extractSection(markdown, "Profit & Loss");
  if (!bsSection || !plSection) {
    return {
      companyName: master.companyName,
      ticker: master.ticker,
      screenerSlug: master.screenerSlug,
      sector: master.sector,
      isFinancialCompany: master.isFinancialCompany,
      status: "parser_failed",
      years: {},
      errors: ["Missing Balance Sheet or Profit & Loss section."],
    };
  }
  const bs = parseMarkdownTable(bsSection);
  const pl = parseMarkdownTable(plSection);
  if (!bs || !pl) {
    return {
      companyName: master.companyName,
      ticker: master.ticker,
      screenerSlug: master.screenerSlug,
      sector: master.sector,
      isFinancialCompany: master.isFinancialCompany,
      status: "parser_failed",
      years: {},
      errors: ["Failed to parse Balance Sheet or P&L table."],
    };
  }

  const equity = findRow(bs, "Equity Capital");
  const reserves = findRow(bs, "Reserves");
  const borrowings = findRow(bs, "Borrowings");
  const otherLiab = findRow(bs, "Other Liabilities");
  const totalLiabRow = findRow(bs, "Total Liabilities");
  const fixedAssets = findRow(bs, "Fixed Assets");
  const totalAssetsRow = findRow(bs, "Total Assets");

  const sales = findRow(pl, "Sales");
  const depreciation = findRow(pl, "Depreciation");
  const interest = findRow(pl, "Interest");
  const pbt = findRow(pl, "Profit before tax");
  const netProfit = findRow(pl, "Net Profit");

  const years: Record<string, FinancialYearData> = {};
  const yearList = bs.columns;
  const latestYear = findLatestYear(yearList);
  const marketCap = getMarketCapCrore(markdown);

  for (const yr of yearList) {
    if (!/^\d{4}$/.test(yr)) continue;
    const row = blankYear(yr);
    const set = (k: keyof FinancialYearData, v: number | null) => {
      if (v === null) return;
      (row as unknown as Record<string, number>)[k as string] = v;
      row.fieldStatus![k as string] = AVAILABLE;
    };

    set("sales", sales?.values[yr] ?? null);
    set("ppe", fixedAssets?.values[yr] ?? null);
    set("totalAssets", totalAssetsRow?.values[yr] ?? null);
    set("depreciation", depreciation?.values[yr] ?? null);
    set("totalDebt", borrowings?.values[yr] ?? null);
    set("retainedEarnings", reserves?.values[yr] ?? null);
    set("netIncome", netProfit?.values[yr] ?? null);

    // ebit = PBT + Interest
    const pbtV = pbt?.values[yr] ?? null;
    const intV = interest?.values[yr] ?? null;
    if (pbtV !== null && intV !== null) {
      set("ebit", pbtV + intV);
    }

    // totalLiabilities = Borrowings + Other Liabilities (excludes equity).
    // The file's "Total Liabilities" row is Total Assets = Equity + Reserves + Borr + OL.
    const borrV = borrowings?.values[yr] ?? null;
    const olV = otherLiab?.values[yr] ?? null;
    if (borrV !== null && olV !== null) {
      set("totalLiabilities", borrV + olV);
    } else if (totalLiabRow?.values[yr] && equity?.values[yr] && reserves?.values[yr]) {
      // Fallback: total balance sheet size minus equity.
      const total = totalLiabRow.values[yr]!;
      const eq = equity.values[yr]!;
      const res = reserves.values[yr]!;
      set("totalLiabilities", total - eq - res);
    }

    // marketValueEquity: only attach to the latest year (current market
    // cap is a point-in-time value, not a per-year series).
    if (yr === latestYear && marketCap !== null) {
      set("marketValueEquity", marketCap);
    }

    // Mark the six fields the format cannot supply.
    for (const f of AR_REQUIRED_FIELDS) {
      row.fieldStatus![f as string] = AR_REQUIRED;
    }
    // marketValueEquity is missing for non-latest years.
    if (row.fieldStatus!["marketValueEquity"] !== AVAILABLE) {
      row.fieldStatus!["marketValueEquity"] = AR_REQUIRED;
    }

    years[yr] = row;
  }

  return {
    companyName: master.companyName,
    ticker: master.ticker,
    screenerSlug: master.screenerSlug,
    sector: master.sector,
    isFinancialCompany: master.isFinancialCompany,
    status: Object.keys(years).length > 0 ? "ok" : "no_data",
    years,
  };
}
