#!/usr/bin/env tsx
/**
 * GuruFocus ingestion (GitHub Actions only — not run from Cloudflare).
 *
 * For each company in the master we hit two GuruFocus term pages:
 *
 *   https://www.gurufocus.com/term/mscore/NSE:<nseTicker>
 *   https://www.gurufocus.com/term/zscore/NSE:<nseTicker>
 *
 * The current value is parsed off the HTML.  Annual values are recorded
 * only when GuruFocus actually exposes them (often premium-only).  No
 * historical values are invented.  Per-company failures are stored as
 * { status, url } stubs so the runtime route can render a clean message
 * instead of an error.
 *
 * Output: data/generated/gurufocus-scores.json
 * Also writes the TS-bundle copy app/api/scores/gurufocus-snapshot.ts so
 * the Worker has access at build time.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { COMPANY_MASTER } from "../data/companies";
import type {
  CompanyMaster,
  GuruFocusAnnualPoint,
  GuruFocusScoreEntry,
  GuruFocusCompanyEntry,
  GuruFocusFetchStatus,
  GuruFocusSnapshot,
} from "../lib/types";

const OUT_DIR = resolve(__dirname, "..", "data", "generated");
const OUT_JSON = resolve(OUT_DIR, "gurufocus-scores.json");
const ROUTE_SNAPSHOT = resolve(
  __dirname,
  "..",
  "app",
  "api",
  "scores",
  "gurufocus-snapshot.ts"
);

const DELAY_MS = 800; // be polite — ~80s for 100 companies, 2x for both scores
const REQUEST_TIMEOUT_MS = 15_000;

const BROWSER_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function fetchHtml(url: string): Promise<{ status: number; body: string } | { error: string }> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS, signal: ac.signal, redirect: "follow" });
    const body = await res.text();
    clearTimeout(timer);
    return { status: res.status, body };
  } catch (err) {
    clearTimeout(timer);
    return { error: err instanceof Error ? err.message : "fetch threw" };
  }
}

// ----- HTML parsing helpers ---------------------------------------------

function stripTags(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findCurrentValue(html: string, scoreType: "mscore" | "zscore"): number | null {
  const text = stripTags(html);
  // 1. "X's M-Score is 1.23" or "Z-Score is -2.34"
  const namePart = scoreType === "mscore" ? "M-Score" : "Z-Score";
  const patterns: RegExp[] = [
    new RegExp(`${namePart}\\s+is\\s+(-?\\d+\\.\\d+)`, "i"),
    new RegExp(`${namePart}\\s*[:=]\\s*(-?\\d+\\.\\d+)`, "i"),
    new RegExp(`current\\s+${namePart}[^\\d-]*(-?\\d+\\.\\d+)`, "i"),
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const n = parseFloat(m[1]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function findAsOf(html: string): string | null {
  const text = stripTags(html);
  const m = text.match(/As\s+of\s+today\s*\(?([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})\)?/i);
  return m ? m[1] : null;
}

function findInterpretation(html: string, scoreType: "mscore" | "zscore"): string | null {
  const text = stripTags(html);
  if (scoreType === "mscore") {
    if (/likely\s+manipulator/i.test(text)) return "Likely manipulator";
    if (/unlikely\s+manipulator/i.test(text)) return "Unlikely manipulator";
  } else {
    if (/distress\s+zone/i.test(text)) return "Distress Zone";
    if (/grey\s+zone|gray\s+zone/i.test(text)) return "Grey Zone";
    if (/safe\s+zone/i.test(text)) return "Safe Zone";
  }
  return null;
}

function findPremiumGate(html: string): boolean {
  return /premium\s*member|premium\s*subscription|sign\s*up\s*for\s*premium/i.test(
    stripTags(html)
  );
}

/**
 * Try to extract a historical "Annual Data" table.  GuruFocus often shows
 * a table with headers like "Sep24 Dec24 Mar25 ..." or "Mar20 Mar21 Mar22 Mar23 Mar24"
 * followed by numbers.  We only return rows where every cell is a finite
 * number.  Premium-blocked tables have asterisks or "Premium Member Only"
 * placeholders, which we drop.
 */
function findAnnualPoints(html: string): GuruFocusAnnualPoint[] {
  const points: GuruFocusAnnualPoint[] = [];
  // Look for a table containing month-year column headers and a row of numbers.
  // Grab every <table> and scan it.
  const tables = html.match(/<table[\s\S]*?<\/table>/g) ?? [];
  for (const table of tables) {
    const headerCells = [...table.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) =>
      stripTags(m[1])
    );
    if (headerCells.length === 0) continue;
    const yearMatches = headerCells
      .map((h) => {
        const m = h.match(/(20\d{2})/);
        return m ? m[1] : null;
      })
      .map((y, i) => ({ year: y, idx: i }));
    if (!yearMatches.some((y) => y.year)) continue;

    // First numeric row.  Skip rows where most cells are "—" / "*" / "Premium".
    const trs = [...table.matchAll(/<tr[\s\S]*?<\/tr>/g)].map((m) => m[0]);
    for (const tr of trs) {
      const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) =>
        stripTags(m[1])
      );
      if (cells.length === 0) continue;
      const numeric = cells.map((c) => {
        const t = c.replace(/,/g, "").trim();
        if (!t || /premium|member|^\*+$|^-+$|^—+$/i.test(t)) return null;
        const n = parseFloat(t.match(/-?\d+(\.\d+)?/)?.[0] ?? "");
        return Number.isFinite(n) ? n : null;
      });
      const usable = numeric.filter((n): n is number => n != null);
      if (usable.length < 2) continue;
      // Align numeric cells with the year header positions.
      for (const ym of yearMatches) {
        if (!ym.year) continue;
        const v = numeric[ym.idx];
        if (v == null) continue;
        if (points.some((p) => p.fiscalYear === ym.year)) continue;
        points.push({ fiscalYear: ym.year, value: v });
      }
      if (points.length > 0) break;
    }
    if (points.length > 0) break;
  }
  return points.sort((a, b) => a.fiscalYear.localeCompare(b.fiscalYear));
}

// ----- Per-company / per-score ingestion --------------------------------

async function ingestScore(
  master: CompanyMaster,
  scoreType: "mscore" | "zscore"
): Promise<GuruFocusScoreEntry> {
  const nse = master.nseTicker ?? master.ticker;
  const url = `https://www.gurufocus.com/term/${scoreType}/NSE:${encodeURIComponent(nse)}`;
  const res = await fetchHtml(url);
  if ("error" in res) {
    return {
      status: "fetch_failed" as GuruFocusFetchStatus,
      url,
      currentValue: null,
      asOf: null,
      interpretation: null,
      annual: [],
      rawExtract: `network: ${res.error}`,
    };
  }
  if (res.status === 403 || res.status === 429) {
    return {
      status: "blocked",
      url,
      currentValue: null,
      asOf: null,
      interpretation: null,
      annual: [],
      rawExtract: `HTTP ${res.status}`,
    };
  }
  if (res.status < 200 || res.status >= 300) {
    return {
      status: "not_available",
      url,
      currentValue: null,
      asOf: null,
      interpretation: null,
      annual: [],
      rawExtract: `HTTP ${res.status}`,
    };
  }

  const currentValue = findCurrentValue(res.body, scoreType);
  const asOf = findAsOf(res.body);
  const interpretation = findInterpretation(res.body, scoreType);
  const annual = findAnnualPoints(res.body);
  const premium = findPremiumGate(res.body);

  if (currentValue == null) {
    return {
      status: premium ? "premium_only" : "parse_failed",
      url,
      currentValue: null,
      asOf,
      interpretation,
      annual,
      rawExtract: stripTags(res.body).slice(0, 240),
    };
  }
  return {
    status: "ok",
    url,
    currentValue,
    asOf,
    interpretation,
    annual,
    rawExtract: null,
  };
}

async function ingestOne(master: CompanyMaster): Promise<GuruFocusCompanyEntry> {
  const mScore = await ingestScore(master, "mscore");
  await sleep(DELAY_MS);
  const zScore = await ingestScore(master, "zscore");
  return {
    companyName: master.companyName,
    ticker: master.ticker,
    nseTicker: master.nseTicker ?? master.ticker,
    sector: master.sector,
    status: mScore.status === "ok" || zScore.status === "ok" ? "ok" : "no_data",
    mScore,
    zScore,
  };
}

async function main() {
  console.log(`[gurufocus] starting — ${COMPANY_MASTER.length} companies`);
  const companies: Record<string, GuruFocusCompanyEntry> = {};
  let mOk = 0;
  let zOk = 0;
  let mFail = 0;
  let zFail = 0;

  for (const master of COMPANY_MASTER) {
    try {
      const c = await ingestOne(master);
      companies[master.ticker] = c;
      if (c.mScore.status === "ok") mOk += 1;
      else mFail += 1;
      if (c.zScore.status === "ok") zOk += 1;
      else zFail += 1;
      console.log(
        `[gurufocus] ${master.ticker.padEnd(14)} m=${c.mScore.status} z=${c.zScore.status} M=${c.mScore.currentValue ?? "—"} Z=${c.zScore.currentValue ?? "—"}`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[gurufocus] ${master.ticker} crashed: ${msg}`);
      companies[master.ticker] = {
        companyName: master.companyName,
        ticker: master.ticker,
        nseTicker: master.nseTicker ?? master.ticker,
        sector: master.sector,
        status: "no_data",
        mScore: {
          status: "fetch_failed",
          url: "",
          currentValue: null,
          asOf: null,
          interpretation: null,
          annual: [],
          rawExtract: msg,
        },
        zScore: {
          status: "fetch_failed",
          url: "",
          currentValue: null,
          asOf: null,
          interpretation: null,
          annual: [],
          rawExtract: msg,
        },
      };
      mFail += 1;
      zFail += 1;
    }
    await sleep(DELAY_MS);
  }

  const snapshot: GuruFocusSnapshot = {
    generatedAt: new Date().toISOString(),
    source: "gurufocus_github_actions",
    companies,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const body = JSON.stringify(snapshot, null, 2);
  writeFileSync(OUT_JSON, body + "\n", "utf8");

  // Mirror as a TS module the Worker can bundle.
  const ts = `// Auto-generated from data/generated/gurufocus-scores.json.\nimport type { GuruFocusSnapshot } from "@/lib/types";\nconst snapshot: GuruFocusSnapshot = ${body};\nexport default snapshot;\n`;
  writeFileSync(ROUTE_SNAPSHOT, ts, "utf8");

  console.log(`[gurufocus] wrote ${OUT_JSON} and ${ROUTE_SNAPSHOT}`);
  console.log(
    `[gurufocus] M-Score: ok=${mOk} fail=${mFail} | Z-Score: ok=${zOk} fail=${zFail} | total=${COMPANY_MASTER.length}`
  );
}

main().catch((err) => {
  console.error("[gurufocus] fatal:", err);
  process.exit(1);
});
