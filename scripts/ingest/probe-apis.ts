#!/usr/bin/env tsx
/**
 * Probe the upstream financial-data APIs and persist raw JSON responses
 * to data/api-samples/.  Supports single-ticker mode and "ALL" mode that
 * iterates every entry in data/companies.ts (COMPANY_MASTER).
 *
 * Required env:
 *   DASH_TOOLS_KEY        — auth header value for get_annual_reports
 *   MUNSHOT_ACCESS_TOKEN  — bearer token for filings/combined_financials
 *
 * Usage:
 *   npx tsx scripts/ingest/probe-apis.ts --ticker=RELIANCE
 *   npx tsx scripts/ingest/probe-apis.ts --ticker=ALL
 *   npx tsx scripts/ingest/probe-apis.ts --ticker=ALL --concurrency=4 --delay-ms=200
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { COMPANY_MASTER } from "../../data/companies";

const GET_ANNUAL_REPORTS_URL =
  "https://screeer-tools.amazon-review-radar-489675.workers.dev/get_annual_reports";

const COMBINED_FINANCIALS_URL =
  "https://devde.muns.io/filings/combined_financials";

const OUT_DIR = resolve(__dirname, "..", "..", "data", "api-samples");

interface ProbeResult {
  endpoint: string;
  url: string;
  requestBody: unknown;
  status: number;
  fetchedAt: string;
  data: unknown;
}

interface TickerSummary {
  ticker: string;
  annualReports: { status: number; ok: boolean };
  combinedFinancials: { status: number; ok: boolean };
}

function getArg(flag: string): string | null {
  const arg = process.argv.find((a) => a.startsWith(`--${flag}=`));
  return arg ? arg.split("=").slice(1).join("=") : null;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (v) return v;
  console.error(
    `[probe] FATAL: ${name} is empty or unset.\n` +
      `[probe] Add it under Settings -> Secrets and variables -> Actions (repository-level).\n` +
      `[probe] If you added it under an Environment, either move it to repo-level or bind the job with 'environment:' in the workflow.\n` +
      `[probe] Setup walkthrough: data/api-samples/README.md`
  );
  process.exit(1);
}

async function postJson(
  url: string,
  body: unknown,
  authHeader: string
): Promise<{ status: number; data: unknown }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      // Upstream returned text (e.g. markdown) — keep the full body, never
      // truncate.  The combined_financials endpoint returns markdown that
      // the existing parse-combined-financial-tool.ts consumes directly.
      data = { _rawText: text };
    }
    return { status: res.status, data };
  } catch (e) {
    return {
      status: 0,
      data: { _fetchError: e instanceof Error ? e.message : String(e) },
    };
  }
}

async function probeTicker(
  ticker: string,
  dashKey: string,
  munshotKey: string
): Promise<TickerSummary> {
  // 1. get_annual_reports — Bearer-prefixed (upstream 401 response confirmed
  // it expects "Authorization: Bearer <token>" or x-api-key).  The original
  // curl was ambiguous about the prefix; raw-token attempts came back 401.
  const arBody = { ticker };
  const ar = await postJson(
    GET_ANNUAL_REPORTS_URL,
    arBody,
    `Bearer ${dashKey}`
  );
  const arResult: ProbeResult = {
    endpoint: "get_annual_reports",
    url: GET_ANNUAL_REPORTS_URL,
    requestBody: arBody,
    status: ar.status,
    fetchedAt: new Date().toISOString(),
    data: ar.data,
  };
  writeFileSync(
    resolve(OUT_DIR, `${ticker}__get_annual_reports.json`),
    JSON.stringify(arResult, null, 2)
  );

  // 2. filings/combined_financials — Bearer-prefixed
  const cfBody = {
    ticker,
    country: "India",
    q: "consolidated",
    period: "annual",
  };
  const cf = await postJson(
    COMBINED_FINANCIALS_URL,
    cfBody,
    `Bearer ${munshotKey}`
  );
  const cfResult: ProbeResult = {
    endpoint: "filings/combined_financials",
    url: COMBINED_FINANCIALS_URL,
    requestBody: cfBody,
    status: cf.status,
    fetchedAt: new Date().toISOString(),
    data: cf.data,
  };
  writeFileSync(
    resolve(OUT_DIR, `${ticker}__combined_financials.json`),
    JSON.stringify(cfResult, null, 2)
  );

  return {
    ticker,
    annualReports: { status: ar.status, ok: ar.status >= 200 && ar.status < 300 },
    combinedFinancials: { status: cf.status, ok: cf.status >= 200 && cf.status < 300 },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  delayMs: number,
  fn: (item: T) => Promise<TickerSummary>
): Promise<TickerSummary[]> {
  const results: TickerSummary[] = [];
  let nextIdx = 0;
  async function worker() {
    while (true) {
      const idx = nextIdx;
      nextIdx += 1;
      if (idx >= items.length) return;
      const summary = await fn(items[idx]);
      results.push(summary);
      console.log(
        `[probe] ${summary.ticker.padEnd(14)} ar=${summary.annualReports.status} cf=${summary.combinedFinancials.status} (${results.length}/${items.length})`
      );
      if (delayMs > 0) await sleep(delayMs);
    }
  }
  const workers = Array.from({ length: Math.max(1, concurrency) }, worker);
  await Promise.all(workers);
  return results;
}

async function main() {
  const tickerArg = (getArg("ticker") ?? "RELIANCE").toUpperCase();
  const concurrency = Number(getArg("concurrency") ?? "3");
  const delayMs = Number(getArg("delay-ms") ?? "150");

  const dashKey = requireEnv("DASH_TOOLS_KEY");
  const munshotKey = requireEnv("MUNSHOT_ACCESS_TOKEN");

  mkdirSync(OUT_DIR, { recursive: true });

  const tickers =
    tickerArg === "ALL" ? COMPANY_MASTER.map((c) => c.ticker) : [tickerArg];
  console.log(
    `[probe] tickers=${tickers.length} concurrency=${concurrency} delay=${delayMs}ms`
  );

  const summaries = await runWithConcurrency(tickers, concurrency, delayMs, (t) =>
    probeTicker(t, dashKey, munshotKey)
  );

  const arFails = summaries.filter((s) => !s.annualReports.ok);
  const cfFails = summaries.filter((s) => !s.combinedFinancials.ok);
  const summaryFile = resolve(OUT_DIR, "_summary.json");
  writeFileSync(
    summaryFile,
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        total: summaries.length,
        annualReports: { ok: summaries.length - arFails.length, failed: arFails.length },
        combinedFinancials: { ok: summaries.length - cfFails.length, failed: cfFails.length },
        summaries,
      },
      null,
      2
    )
  );
  console.log(`[probe] done. ${summaries.length} tickers, ${arFails.length} ar failures, ${cfFails.length} cf failures.`);
  console.log(`[probe] summary at data/api-samples/_summary.json`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
