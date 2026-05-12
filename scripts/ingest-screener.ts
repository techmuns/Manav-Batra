#!/usr/bin/env tsx
/**
 * Screener ingestion script.
 *
 * Runs OFF the runtime path — invoked by GitHub Actions on a schedule.
 * Fetches Screener pages for every company in the master, parses them
 * with the same logic the runtime parser used, and writes the
 * normalized data to data/generated/screener-financials.json.
 *
 * The script tolerates per-company failures: it records the failure
 * mode on that company and continues with the rest.  The runtime API
 * never calls Screener — it only reads the JSON this script produces.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { COMPANY_MASTER } from "../data/companies";
import { normalize } from "../lib/screener/fetch";
import { parseScreenerHtml } from "../lib/screener/parser";
import type {
  CompanyFinancialSnapshot,
  CompanyMaster,
  FinancialYearData,
  GeneratedFinancialSnapshot,
} from "../lib/types";

const OUTPUT_PATH = resolve(__dirname, "..", "data", "generated", "screener-financials.json");

// Stagger requests so we don't hammer Screener.  At ~50 companies the
// total wall-clock is around 50 * (700ms + ~1s fetch) ~= 85s.
const DELAY_MS = 700;

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface FetchResult {
  status: number;
  body: string;
  url: string;
}

async function fetchOne(slug: string): Promise<FetchResult | { error: string; url: string }> {
  const urls = [
    `https://www.screener.in/company/${encodeURIComponent(slug)}/consolidated/`,
    `https://www.screener.in/company/${encodeURIComponent(slug)}/`,
  ];
  let lastError = "no attempt";
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: "follow" });
      const body = await res.text();
      if (res.status === 404) continue; // try the next URL form
      return { status: res.status, body, url };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "fetch threw";
    }
  }
  return { error: lastError, url: urls[0] };
}

async function ingestOne(master: CompanyMaster): Promise<CompanyFinancialSnapshot> {
  const base: CompanyFinancialSnapshot = {
    companyName: master.companyName,
    ticker: master.ticker,
    screenerSlug: master.screenerSlug,
    sector: master.sector,
    isFinancialCompany: master.isFinancialCompany,
    status: "no_data",
    years: {},
  };

  const fetched = await fetchOne(master.screenerSlug);
  if ("error" in fetched) {
    return { ...base, status: "fetch_failed", errors: [fetched.error] };
  }
  if (fetched.status < 200 || fetched.status >= 300) {
    return {
      ...base,
      status: "fetch_failed",
      errors: [`HTTP ${fetched.status} from ${fetched.url}`],
    };
  }

  let parsedYears: FinancialYearData[];
  try {
    const parsed = parseScreenerHtml(fetched.body);
    parsedYears = normalize(parsed);
  } catch (err) {
    return {
      ...base,
      status: "parser_failed",
      errors: [err instanceof Error ? err.message : "parser threw"],
    };
  }

  if (parsedYears.length === 0) {
    return { ...base, status: "no_data", errors: ["no fiscal-year columns in upstream page"] };
  }

  const years: Record<string, FinancialYearData> = {};
  for (const y of parsedYears) years[y.fiscalYear] = y;

  return { ...base, status: "ok", years };
}

async function main() {
  console.log(`[ingest] starting — ${COMPANY_MASTER.length} companies`);
  const companies: Record<string, CompanyFinancialSnapshot> = {};

  let ok = 0;
  let failed = 0;
  for (const master of COMPANY_MASTER) {
    try {
      const snap = await ingestOne(master);
      companies[master.ticker] = snap;
      if (snap.status === "ok") {
        ok += 1;
        console.log(`[ingest] ${master.ticker.padEnd(14)} ok   (${Object.keys(snap.years).length} yrs)`);
      } else {
        failed += 1;
        console.warn(
          `[ingest] ${master.ticker.padEnd(14)} ${snap.status.padEnd(13)} ${snap.errors?.[0] ?? ""}`
        );
      }
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      companies[master.ticker] = {
        companyName: master.companyName,
        ticker: master.ticker,
        screenerSlug: master.screenerSlug,
        sector: master.sector,
        isFinancialCompany: master.isFinancialCompany,
        status: "fetch_failed",
        years: {},
        errors: [msg],
      };
      console.warn(`[ingest] ${master.ticker.padEnd(14)} crash ${msg}`);
    }
    await sleep(DELAY_MS);
  }

  const snapshot: GeneratedFinancialSnapshot = {
    generatedAt: new Date().toISOString(),
    source: "screener_github_actions",
    companies,
  };

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  console.log(`[ingest] wrote ${OUTPUT_PATH}`);
  console.log(`[ingest] summary: ok=${ok} failed=${failed} total=${COMPANY_MASTER.length}`);
}

main().catch((err) => {
  console.error("[ingest] fatal:", err);
  process.exit(1);
});
