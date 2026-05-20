#!/usr/bin/env tsx
/**
 * Run this from your local machine (Windows cmd / PowerShell / mac /
 * linux — all the same).  No GitHub Actions, no Cloudflare in the loop.
 *
 *   set MUNSHOT_ACCESS_TOKEN=<your token>
 *   npx tsx scripts/ingest-munshot.ts
 *
 * What it does:
 *   1. Walks every company in data/companies.ts.
 *   2. POSTs to https://devde.muns.io/filings/combined_financials
 *      with your bearer token to fetch consolidated annual financials.
 *   3. Maps the response into the FinancialYearData[] shape using a
 *      defensive set of field-name candidates (revenue / sales / net_sales,
 *      total_assets / totalAssets, etc.) so it works against minor
 *      naming variation in the API.
 *   4. Writes the snapshot to BOTH:
 *        - data/generated/verified-financials.json   (human-readable)
 *        - app/api/scores/snapshot.ts                (bundled into Worker)
 *
 *   After it finishes, commit + push and Cloudflare redeploys.
 *
 * No fake values are ever written — fields that can't be mapped stay
 * null, which the calc engine treats as "Not Calculable".
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { COMPANY_MASTER } from "../data/companies";
import type {
  CompanyFinancialSnapshot,
  FinancialYearData,
  GeneratedFinancialSnapshot,
} from "../lib/types";

const ENDPOINT = "https://devde.muns.io/filings/combined_financials";
const OUT_JSON = resolve(__dirname, "..", "data", "generated", "verified-financials.json");
const OUT_TS = resolve(__dirname, "..", "data", "generated", "verified-financials.ts");
const ROUTE_SNAPSHOT = resolve(
  __dirname,
  "..",
  "app",
  "api",
  "scores",
  "snapshot.ts"
);
const DELAY_MS = 400;
const TIMEOUT_MS = 25_000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ---- Field-name mapper (defensive) ---------------------------------------
// Each FinancialYearData field can come from one of several plausible
// keys.  We try them in order, lowercase-insensitive, and take the first
// numeric match.

const FIELD_CANDIDATES: Record<keyof Omit<FinancialYearData, "fiscalYear" | "fieldStatus">, string[]> = {
  sales: [
    "revenue", "sales", "total_revenue", "totalRevenue",
    "net_sales", "netSales", "revenue_from_operations",
    "revenueFromOperations", "operating_revenue",
  ],
  receivables: [
    "trade_receivables", "tradeReceivables", "receivables",
    "accounts_receivable", "trade_debtors",
  ],
  grossProfit: [
    "gross_profit", "grossProfit", "gross_margin",
  ],
  currentAssets: [
    "total_current_assets", "current_assets", "totalCurrentAssets",
    "currentAssets",
  ],
  ppe: [
    "ppe", "property_plant_and_equipment", "propertyPlantAndEquipment",
    "fixed_assets", "fixedAssets", "net_ppe", "netPPE",
    "tangible_assets", "tangibleAssets",
  ],
  totalAssets: [
    "total_assets", "totalAssets", "assets",
  ],
  depreciation: [
    "depreciation", "depreciation_and_amortization",
    "depreciationAndAmortization", "depreciation_amortization",
    "depreciation_amortisation",
  ],
  sgaExpense: [
    "sga", "sg_and_a", "sga_expense", "selling_general_admin",
    "sellingGeneralAdministrative", "other_expenses", "otherExpenses",
    "operating_expenses",
  ],
  totalDebt: [
    "total_debt", "totalDebt", "borrowings", "long_term_debt",
    "long_term_borrowings", "longTermBorrowings",
  ],
  currentLiabilities: [
    "total_current_liabilities", "current_liabilities",
    "totalCurrentLiabilities", "currentLiabilities",
  ],
  retainedEarnings: [
    "retained_earnings", "retainedEarnings", "reserves_and_surplus",
    "reservesAndSurplus", "reserves",
  ],
  ebit: [
    "ebit", "operating_income", "operatingIncome",
    "profit_before_interest_and_tax", "operating_profit", "operatingProfit",
  ],
  marketValueEquity: [
    "market_cap", "marketCap", "market_capitalization",
    "marketCapitalization", "market_value_of_equity",
  ],
  totalLiabilities: [
    "total_liabilities", "totalLiabilities", "liabilities",
  ],
  operatingCashFlow: [
    "operating_cash_flow", "operatingCashFlow",
    "cash_from_operating_activities", "cashFromOperatingActivities",
    "cfo", "operating_activities_cash_flow",
  ],
  netIncome: [
    "net_income", "netIncome", "net_profit", "netProfit",
    "profit_after_tax", "profitAfterTax", "pat", "earnings",
  ],
};

function pickNumber(yearObj: Record<string, unknown>, candidates: string[]): number | null {
  const lowered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(yearObj)) lowered[k.toLowerCase()] = v;
  for (const cand of candidates) {
    const v = lowered[cand.toLowerCase()];
    if (v == null) continue;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const cleaned = v.replace(/,/g, "").trim();
      const n = parseFloat(cleaned);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

/** Try to find the "annual rows" array inside whatever shape Munshot returns. */
function locateYearArray(data: unknown): Array<Record<string, unknown>> | null {
  if (Array.isArray(data) && data.every((d) => typeof d === "object")) {
    return data as Array<Record<string, unknown>>;
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    // Common containers: { data: [...] }, { rows: [...] }, { annual: [...] }, etc.
    for (const key of [
      "data", "rows", "annual", "financials", "results", "yearly",
      "filings", "items", "records",
    ]) {
      const v = obj[key];
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object") {
        return v as Array<Record<string, unknown>>;
      }
    }
    // Sometimes the payload is keyed by year: { "2024": {...}, "2023": {...} }
    const yearKeys = Object.keys(obj).filter((k) => /^(20\d{2}|FY\s*20\d{2})$/i.test(k));
    if (yearKeys.length > 0) {
      return yearKeys.map((y) => {
        const inner = obj[y] as Record<string, unknown>;
        return { ...inner, fiscal_year: y };
      });
    }
  }
  return null;
}

function extractFiscalYear(row: Record<string, unknown>): string | null {
  for (const key of [
    "fiscal_year", "fiscalYear", "year", "fy", "period", "period_end",
    "period_end_date", "reporting_period", "as_of", "asOf",
  ]) {
    const v = row[key];
    if (typeof v === "string") {
      const m = v.match(/20\d{2}/);
      if (m) return m[0];
    }
    if (typeof v === "number" && v >= 2000 && v <= 2099) return String(v);
  }
  return null;
}

function buildYear(row: Record<string, unknown>, fiscalYear: string): FinancialYearData {
  const out: FinancialYearData = {
    fiscalYear,
    sales: null, receivables: null, grossProfit: null, currentAssets: null,
    ppe: null, totalAssets: null, depreciation: null, sgaExpense: null,
    totalDebt: null, currentLiabilities: null, retainedEarnings: null,
    ebit: null, marketValueEquity: null, totalLiabilities: null,
    operatingCashFlow: null, netIncome: null,
    fieldStatus: {},
  };
  for (const [field, candidates] of Object.entries(FIELD_CANDIDATES) as Array<
    [keyof typeof FIELD_CANDIDATES, string[]]
  >) {
    const v = pickNumber(row, candidates);
    if (v != null) {
      (out as unknown as Record<string, number>)[field] = v;
      (out.fieldStatus as Record<string, string>)[field] = "annual_report";
    } else {
      (out.fieldStatus as Record<string, string>)[field] = "missing";
    }
  }
  return out;
}

async function fetchOne(ticker: string, token: string): Promise<{
  status: number;
  data: unknown;
  error?: string;
}> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ticker,
        country: "India",
        q: "consolidated",
        period: "annual",
      }),
      signal: ac.signal,
    });
    const text = await res.text();
    clearTimeout(timer);
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { _rawText: text.slice(0, 4000) }; }
    return { status: res.status, data };
  } catch (err) {
    clearTimeout(timer);
    return { status: 0, data: null, error: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  const token = process.env.MUNSHOT_ACCESS_TOKEN;
  if (!token) {
    console.error("MUNSHOT_ACCESS_TOKEN env var is not set.");
    console.error("Windows cmd:  set MUNSHOT_ACCESS_TOKEN=<your token>");
    console.error("PowerShell:   $env:MUNSHOT_ACCESS_TOKEN=\"<your token>\"");
    process.exit(1);
  }

  const companies: Record<string, CompanyFinancialSnapshot> = {};
  let ok = 0, failed = 0;

  for (const master of COMPANY_MASTER) {
    const ticker = master.ticker;
    process.stdout.write(`[munshot] ${ticker.padEnd(14)} … `);
    const res = await fetchOne(ticker, token);
    if (res.error || res.status < 200 || res.status >= 300) {
      console.log(`fail (HTTP ${res.status}${res.error ? `: ${res.error}` : ""})`);
      companies[ticker] = {
        companyName: master.companyName, ticker, screenerSlug: master.screenerSlug,
        sector: master.sector, isFinancialCompany: master.isFinancialCompany,
        status: "fetch_failed", years: {},
        errors: [res.error ?? `HTTP ${res.status}`],
      };
      failed += 1;
      await sleep(DELAY_MS);
      continue;
    }
    const rows = locateYearArray(res.data);
    if (!rows || rows.length === 0) {
      console.log("parser_failed (no year rows)");
      companies[ticker] = {
        companyName: master.companyName, ticker, screenerSlug: master.screenerSlug,
        sector: master.sector, isFinancialCompany: master.isFinancialCompany,
        status: "parser_failed", years: {},
        errors: ["could not locate annual rows in response"],
      };
      failed += 1;
      await sleep(DELAY_MS);
      continue;
    }
    const years: Record<string, FinancialYearData> = {};
    for (const row of rows) {
      const fy = extractFiscalYear(row);
      if (!fy) continue;
      years[fy] = buildYear(row, fy);
    }
    const yearCount = Object.keys(years).length;
    const fieldCount = Object.values(years).reduce((sum, y) => {
      const fs = y.fieldStatus ?? {};
      return sum + Object.values(fs).filter((v) => v === "annual_report").length;
    }, 0);
    if (yearCount === 0 || fieldCount === 0) {
      console.log(`no_data (rows=${rows.length} years=${yearCount} fields=${fieldCount})`);
      companies[ticker] = {
        companyName: master.companyName, ticker, screenerSlug: master.screenerSlug,
        sector: master.sector, isFinancialCompany: master.isFinancialCompany,
        status: "no_data", years,
      };
      failed += 1;
    } else {
      console.log(`ok (${yearCount} yrs, ${fieldCount} fields)`);
      companies[ticker] = {
        companyName: master.companyName, ticker, screenerSlug: master.screenerSlug,
        sector: master.sector, isFinancialCompany: master.isFinancialCompany,
        status: "ok", years,
      };
      ok += 1;
    }
    await sleep(DELAY_MS);
  }

  const snapshot: GeneratedFinancialSnapshot = {
    generatedAt: new Date().toISOString(),
    source: "official_filings_pipeline",
    companies,
  };
  const body = JSON.stringify(snapshot, null, 2);
  mkdirSync(resolve(__dirname, "..", "data", "generated"), { recursive: true });
  writeFileSync(OUT_JSON, body + "\n", "utf8");
  const ts = `// Auto-generated by scripts/ingest-munshot.ts.\nimport type { GeneratedFinancialSnapshot } from "@/lib/types";\nconst snapshot: GeneratedFinancialSnapshot = ${body};\nexport default snapshot;\n`;
  writeFileSync(OUT_TS, ts, "utf8");
  writeFileSync(ROUTE_SNAPSHOT, ts, "utf8");

  console.log("\n[munshot] done.");
  console.log(`[munshot] ok=${ok} failed=${failed} total=${COMPANY_MASTER.length}`);
  console.log(`[munshot] wrote ${OUT_JSON}`);
  console.log(`[munshot] wrote ${ROUTE_SNAPSHOT}`);
  console.log("\nNext steps:");
  console.log("  git add data/generated/verified-financials.json data/generated/verified-financials.ts app/api/scores/snapshot.ts");
  console.log("  git commit -m \"chore(data): refresh verified financials from Munshot\"");
  console.log("  git push");
}

main().catch((e) => {
  console.error("fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
