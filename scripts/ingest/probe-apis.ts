#!/usr/bin/env tsx
/**
 * Probe the upstream financial-data APIs and persist raw JSON responses
 * to data/api-samples/.  Run this once per ticker so the field-mapper
 * can be written against the real response shape (no speculative schema).
 *
 * Required env:
 *   DASH_TOOLS_KEY        — auth header value for get_annual_reports
 *   MUNSHOT_ACCESS_TOKEN  — bearer token for filings/combined_financials
 *
 * Usage:
 *   npx tsx scripts/ingest/probe-apis.ts --ticker=RELIANCE
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

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

async function postJson(
  url: string,
  body: unknown,
  authHeader: string
): Promise<{ status: number; data: unknown }> {
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
    data = { _rawText: text.slice(0, 4000) };
  }
  return { status: res.status, data };
}

function parseTicker(): string {
  const arg = process.argv.find((a) => a.startsWith("--ticker="));
  return (arg?.split("=")[1] ?? "RELIANCE").toUpperCase();
}

async function main() {
  const ticker = parseTicker();
  const dashKey = process.env.DASH_TOOLS_KEY;
  const munshotKey = process.env.MUNSHOT_ACCESS_TOKEN;
  if (!dashKey) throw new Error("DASH_TOOLS_KEY env var is not set");
  if (!munshotKey) throw new Error("MUNSHOT_ACCESS_TOKEN env var is not set");

  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`[probe] ticker=${ticker}`);

  // 1. get_annual_reports — raw token in Authorization (no Bearer prefix per curl)
  console.log(`[probe] -> get_annual_reports`);
  const arBody = { ticker };
  const ar = await postJson(GET_ANNUAL_REPORTS_URL, arBody, dashKey);
  console.log(`[probe]    status=${ar.status}`);
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
  console.log(`[probe] -> filings/combined_financials`);
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
  console.log(`[probe]    status=${cf.status}`);
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

  console.log(`[probe] done. samples written to data/api-samples/`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
