// Minimal HTML parser for screener.in company pages.  We extract three
// tables — Profit & Loss, Balance Sheet, Cash Flow — plus the
// working-capital sub-section, then map their rows into our normalized
// FinancialYearData shape.  No JSDOM/cheerio: we run on edge runtimes so
// we stay on plain regex + string operations.

export interface ParsedTable {
  // Column headers (in original order), e.g. ["Mar 2016", ..., "Mar 2025", "TTM"]
  columns: string[];
  // rowLabel (lowercased, trimmed) -> array of values aligned to `columns`.
  rows: Record<string, Array<number | null>>;
}

export interface ParsedScreenerData {
  profitLoss?: ParsedTable;
  balanceSheet?: ParsedTable;
  cashFlow?: ParsedTable;
  marketCapCrore?: number | null;
}

// ---- Helpers -----------------------------------------------------------

function stripTags(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(raw: string): number | null {
  if (!raw) return null;
  const t = raw.replace(/,/g, "").trim();
  if (!t || t === "-" || t === "—") return null;
  const neg = /^\(.*\)$/.test(t);
  const cleaned = neg ? t.slice(1, -1) : t;
  // Drop trailing % or other unit characters but keep leading minus / digits.
  const m = cleaned.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

function extractSection(html: string, id: string): string | undefined {
  const i = html.indexOf(`id="${id}"`);
  if (i < 0) return undefined;
  // From there grab up to next `<section ` or end of `</section>`.
  const tail = html.slice(i);
  const end = tail.indexOf("</section>");
  return end >= 0 ? tail.slice(0, end) : tail;
}

function extractTable(sectionHtml: string): ParsedTable | undefined {
  const tStart = sectionHtml.indexOf("<table");
  if (tStart < 0) return undefined;
  const tEnd = sectionHtml.indexOf("</table>", tStart);
  if (tEnd < 0) return undefined;
  const table = sectionHtml.slice(tStart, tEnd);

  // Headers: first <tr> in <thead>, or first <tr> overall.
  const theadMatch = table.match(/<thead[\s\S]*?<\/thead>/);
  const headerHtml = theadMatch ? theadMatch[0] : table;
  const firstTr = headerHtml.match(/<tr[\s\S]*?<\/tr>/);
  if (!firstTr) return undefined;
  const headerCells = [...firstTr[0].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) =>
    stripTags(m[1])
  );
  const columns = headerCells.slice(1); // first column is the row label

  // Rows: every <tr> in <tbody>.
  const tbodyMatch = table.match(/<tbody[\s\S]*?<\/tbody>/);
  const body = tbodyMatch ? tbodyMatch[0] : table.slice(theadMatch ? theadMatch[0].length : 0);
  const rows: Record<string, Array<number | null>> = {};
  const trMatches = body.matchAll(/<tr[\s\S]*?<\/tr>/g);
  for (const tr of trMatches) {
    const cells = [...tr[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => stripTags(m[1]));
    if (cells.length === 0) continue;
    const label = cells[0].replace(/[+%›]/g, "").trim().toLowerCase();
    if (!label) continue;
    const values = cells.slice(1, columns.length + 1).map(parseNumber);
    rows[label] = values;
  }
  return { columns, rows };
}

// ---- Top-level entry ---------------------------------------------------

export function parseScreenerHtml(html: string): ParsedScreenerData {
  const result: ParsedScreenerData = {};

  const pl = extractSection(html, "profit-loss");
  if (pl) result.profitLoss = extractTable(pl);

  const bs = extractSection(html, "balance-sheet");
  if (bs) result.balanceSheet = extractTable(bs);

  const cf = extractSection(html, "cash-flow");
  if (cf) result.cashFlow = extractTable(cf);

  // Top "Market Cap" appears in the company header card.
  // Pattern looks like:  Market Cap <span>₹</span> 1,73,452 Cr.
  const mcap = html.match(/Market Cap[\s\S]{0,80}?₹\s*<\/span>\s*([0-9,.]+)\s*Cr/i);
  result.marketCapCrore = mcap ? parseNumber(mcap[1]) : null;

  return result;
}

// ---- Public alias map: row label -> canonical key ----------------------

export const PL_ROW_MAP: Record<string, string> = {
  sales: "sales",
  revenue: "sales",
  "total revenue": "sales",
  expenses: "expenses",
  "operating profit": "operatingProfit",
  "other income": "otherIncome",
  interest: "interest",
  depreciation: "depreciation",
  "profit before tax": "pbt",
  "profit before extraordinary items": "pbt",
  "profit after tax": "netIncome",
  "net profit": "netIncome",
  "net profit +": "netIncome",
};

export const BS_ROW_MAP: Record<string, string> = {
  "equity capital": "equity",
  reserves: "reserves",
  borrowings: "borrowings",
  "other liabilities": "otherLiabilities",
  "total liabilities": "totalEquityAndLiabilities",
  "fixed assets": "fixedAssets",
  "fixed assets +": "fixedAssets",
  cwip: "cwip",
  investments: "investments",
  "other assets": "otherAssets",
  "other assets +": "otherAssets",
  "total assets": "totalAssets",
  receivables: "receivables",
  inventory: "inventory",
  "cash & bank": "cashAndBank",
  "cash and bank": "cashAndBank",
};

export const CF_ROW_MAP: Record<string, string> = {
  "cash from operating activity": "operatingCashFlow",
  "cash from operating activity +": "operatingCashFlow",
  "cash from operating activity -": "operatingCashFlow",
  "cash from investing activity": "investingCashFlow",
  "cash from financing activity": "financingCashFlow",
  "net cash flow": "netCashFlow",
};
