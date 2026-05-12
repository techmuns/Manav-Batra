import type { CompanyMaster, FinancialYearData } from "@/lib/types";
import {
  BS_ROW_MAP,
  CF_ROW_MAP,
  PL_ROW_MAP,
  parseScreenerHtml,
  type ParsedTable,
} from "./parser";

export interface FetchOutcome {
  ok: boolean;
  years: FinancialYearData[];
  error?: string;
  // Internal-only diagnostics — never shipped to the UI.
  _diagnostics?: {
    url: string;
    columnsExtracted?: string[];
    httpStatus?: number;
  };
}

const STATUS = {
  available: "available" as const,
  missing: "missing" as const,
  arr: "annual_report_required" as const,
};

function pick(table: ParsedTable | undefined, aliasMap: Record<string, string>, key: string) {
  if (!table) return undefined;
  for (const [label, canonical] of Object.entries(aliasMap)) {
    if (canonical !== key) continue;
    const row = table.rows[label];
    if (row) return row;
  }
  return undefined;
}

function normalizeFiscalYear(header: string): string {
  // "Mar 2025" -> "2025"; "FY25" -> "2025"; "TTM" -> "TTM"
  const m = header.match(/(20\d{2})/);
  if (m) return m[1];
  if (/ttm/i.test(header)) return "TTM";
  return header;
}

// Map parsed Screener tables to our normalized FinancialYearData[] array.
// Honest about what Screener exposes vs. what truly needs annual-report
// fallback.  Year-by-year alignment is by column index since Screener
// already aligns P&L / BS / CF columns to the same fiscal years.
export function normalize(
  parsed: ReturnType<typeof parseScreenerHtml>
): FinancialYearData[] {
  const { profitLoss, balanceSheet, cashFlow, marketCapCrore } = parsed;
  if (!profitLoss || !balanceSheet) return [];

  // Use the P&L columns as the canonical year axis (BS may add an extra trailing column).
  const cols = profitLoss.columns;

  // Row pickers from each table.
  const pl = (k: string) => pick(profitLoss, PL_ROW_MAP, k);
  const bs = (k: string) => pick(balanceSheet, BS_ROW_MAP, k);
  const cf = (k: string) => pick(cashFlow, CF_ROW_MAP, k);

  const sales = pl("sales");
  const expenses = pl("expenses");
  const otherIncome = pl("otherIncome");
  const interest = pl("interest");
  const depreciation = pl("depreciation");
  const pbt = pl("pbt");
  const netIncome = pl("netIncome");
  const operatingProfit = pl("operatingProfit");

  const fixedAssets = bs("fixedAssets");
  const cwip = bs("cwip");
  const totalAssets = bs("totalAssets");
  const borrowings = bs("borrowings");
  const otherLiabilities = bs("otherLiabilities");
  const receivables = bs("receivables");

  const operatingCashFlow = cf("operatingCashFlow");

  const out: FinancialYearData[] = [];

  for (let i = 0; i < cols.length; i += 1) {
    const fiscalYear = normalizeFiscalYear(cols[i]);
    // Skip TTM column — not a fiscal year.
    if (fiscalYear === "TTM") continue;

    const get = (arr: Array<number | null> | undefined) =>
      arr && i < arr.length ? arr[i] : null;

    // Derived but exact:
    //   PPE = Fixed Assets + CWIP
    //   EBIT = PBT + Interest (book-definition, not a proxy)
    //   Total Liabilities = Borrowings + Other Liabilities
    const ppeVal =
      get(fixedAssets) != null || get(cwip) != null
        ? (get(fixedAssets) ?? 0) + (get(cwip) ?? 0)
        : null;
    const ebitVal =
      get(pbt) != null && get(interest) != null
        ? (get(pbt) as number) + (get(interest) as number)
        : null;
    const totalLiabilitiesVal =
      get(borrowings) != null && get(otherLiabilities) != null
        ? (get(borrowings) as number) + (get(otherLiabilities) as number)
        : null;

    const fieldStatus: FinancialYearData["fieldStatus"] = {};
    const mark = (k: string, v: number | null, src: keyof typeof STATUS) => {
      fieldStatus[k] = v != null ? STATUS.available : STATUS[src];
      return v;
    };

    const year: FinancialYearData = {
      fiscalYear,
      sales: mark("sales", get(sales), "missing"),
      receivables: mark("receivables", get(receivables), "missing"),
      // grossProfit is NOT shown by Screener (no COGS line); needs annual report.
      grossProfit: ((): number | null => {
        fieldStatus.grossProfit = STATUS.arr;
        return null;
      })(),
      // currentAssets is NOT a clean line on Screener's free page.
      currentAssets: ((): number | null => {
        fieldStatus.currentAssets = STATUS.arr;
        return null;
      })(),
      ppe: mark("ppe", ppeVal, "missing"),
      totalAssets: mark("totalAssets", get(totalAssets), "missing"),
      depreciation: mark("depreciation", get(depreciation), "missing"),
      // sgaExpense is NOT broken out by Screener (bundled into Expenses).
      sgaExpense: ((): number | null => {
        fieldStatus.sgaExpense = STATUS.arr;
        return null;
      })(),
      totalDebt: mark("totalDebt", get(borrowings), "missing"),
      // currentLiabilities is NOT a clean line on Screener's free page.
      currentLiabilities: ((): number | null => {
        fieldStatus.currentLiabilities = STATUS.arr;
        return null;
      })(),
      // retainedEarnings ≠ Reserves; mark as annual-report required by default.
      retainedEarnings: ((): number | null => {
        fieldStatus.retainedEarnings = STATUS.arr;
        return null;
      })(),
      ebit: mark("ebit", ebitVal, "missing"),
      // Historical market cap is not provided by Screener for non-current years.
      // Mark every year as annual-report required; the API route attaches the
      // *current* market cap separately so the latest-year card can still use it.
      marketValueEquity: ((): number | null => {
        fieldStatus.marketValueEquity = STATUS.arr;
        return null;
      })(),
      totalLiabilities: mark("totalLiabilities", totalLiabilitiesVal, "missing"),
      operatingCashFlow: mark("operatingCashFlow", get(operatingCashFlow), "missing"),
      netIncome: mark("netIncome", get(netIncome), "missing"),
      fieldStatus,
    };
    out.push(year);
  }

  // Attach current market cap to the most recent fiscal year (where it is the
  // *current* market cap as of today, which is the only honest mapping).
  if (out.length > 0 && marketCapCrore != null && Number.isFinite(marketCapCrore)) {
    const last = out[out.length - 1];
    last.marketValueEquity = marketCapCrore;
    if (last.fieldStatus) last.fieldStatus.marketValueEquity = STATUS.available;
  }
  // Suppress otherIncome / operatingProfit lint warnings — they're not currently used.
  void otherIncome;
  void operatingProfit;
  return out;
}

export async function fetchFromScreener(
  master: CompanyMaster,
  signal?: AbortSignal
): Promise<FetchOutcome> {
  const url = `https://www.screener.in/company/${encodeURIComponent(master.screenerSlug)}/consolidated/`;
  try {
    const res = await fetch(url, {
      signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    } as RequestInit);
    if (!res.ok) {
      return {
        ok: false,
        years: [],
        error: `Upstream returned HTTP ${res.status}`,
        _diagnostics: { url, httpStatus: res.status },
      };
    }
    const html = await res.text();
    const parsed = parseScreenerHtml(html);
    const years = normalize(parsed);
    if (years.length === 0) {
      // Try the standalone page as a fallback (some smaller listings only have one).
      const standaloneUrl = `https://www.screener.in/company/${encodeURIComponent(master.screenerSlug)}/`;
      const res2 = await fetch(standaloneUrl, {
        signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        },
      });
      if (res2.ok) {
        const html2 = await res2.text();
        const parsed2 = parseScreenerHtml(html2);
        const years2 = normalize(parsed2);
        if (years2.length > 0)
          return { ok: true, years: years2, _diagnostics: { url: standaloneUrl } };
      }
      return {
        ok: false,
        years: [],
        error: "Financial tables not found on the upstream page",
        _diagnostics: { url, columnsExtracted: parsed.profitLoss?.columns },
      };
    }
    return { ok: true, years, _diagnostics: { url, columnsExtracted: parsed.profitLoss?.columns } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "fetch failed";
    return { ok: false, years: [], error: msg, _diagnostics: { url } };
  }
}
