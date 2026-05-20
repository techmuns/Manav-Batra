#!/usr/bin/env tsx
/**
 * Hard-purge any snapshot entry whose year rows do NOT carry the
 * `fieldStatus` provenance markers produced by the markdown parser.
 * Those entries are leftover hand-crafted illustrative data from
 * before this PR; without provenance we can't tell them apart from
 * real numbers, so we clear them entirely so the dashboard shows
 * "no data" instead of mock numbers.
 *
 * Run this AFTER an ingest pass so anything the API successfully
 * populated (which always writes fieldStatus) is preserved.
 *
 * Usage:
 *   npm run purge:illustrative
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SNAPSHOT_FILE = resolve(
  __dirname,
  "..",
  "..",
  "app",
  "api",
  "scores",
  "snapshot.ts"
);

interface Year {
  fiscalYear: string;
  fieldStatus?: Record<string, string>;
  [k: string]: unknown;
}

interface CompanySnap {
  companyName: string;
  ticker: string;
  screenerSlug: string;
  sector: string;
  isFinancialCompany: boolean;
  status: string;
  years: Record<string, Year>;
  errors?: string[];
}

function entryHasProvenance(snap: CompanySnap): boolean {
  const years = Object.values(snap.years);
  if (!years.length) return true; // empty entry: nothing to purge
  // True if at least one year carries fieldStatus markers.  Real ingest
  // always writes them per year; illustrative hand-crafted entries do
  // not have fieldStatus at all.
  return years.some(
    (y) => y.fieldStatus && Object.keys(y.fieldStatus).length > 0
  );
}

function main() {
  const current = readFileSync(SNAPSHOT_FILE, "utf-8");
  const startMarker = "const snapshot: GeneratedFinancialSnapshot = ";
  const startIdx = current.indexOf(startMarker);
  if (startIdx === -1) throw new Error(`marker not found in ${SNAPSHOT_FILE}`);
  const jsonStart = current.indexOf("{", startIdx);
  let depth = 0;
  let jsonEnd = -1;
  for (let i = jsonStart; i < current.length; i += 1) {
    if (current[i] === "{") depth += 1;
    else if (current[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        jsonEnd = i + 1;
        break;
      }
    }
  }
  if (jsonEnd === -1) throw new Error("could not find end of literal");
  const parsed = JSON.parse(current.slice(jsonStart, jsonEnd)) as {
    generatedAt: string | null;
    source: string;
    companies: Record<string, CompanySnap>;
  };

  const purged: string[] = [];
  const kept: string[] = [];
  for (const [ticker, snap] of Object.entries(parsed.companies)) {
    if (entryHasProvenance(snap)) {
      kept.push(ticker);
      continue;
    }
    // Strip the years; keep the master metadata so the company still
    // appears in the eligibility universe (the route will return
    // not_calculable / no_data for it).
    parsed.companies[ticker] = {
      ...snap,
      status: "no_data",
      years: {},
    };
    purged.push(ticker);
  }
  parsed.generatedAt = new Date().toISOString();
  const newLiteral = JSON.stringify(parsed, null, 2);
  const newFile =
    current.slice(0, jsonStart) + newLiteral + current.slice(jsonEnd);
  writeFileSync(SNAPSHOT_FILE, newFile);

  console.log(`[purge] kept ${kept.length} entries with provenance`);
  console.log(`[purge] purged ${purged.length} illustrative entries:`);
  for (const t of purged) console.log(`        - ${t}`);
}

main();
