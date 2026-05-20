#!/usr/bin/env tsx
/**
 * Seed app/api/scores/snapshot.ts from one or more combined_financial_tool.txt
 * files.  Replaces (only) the named ticker's entry inside snapshot.ts; other
 * companies' entries are preserved verbatim.
 *
 * Convention:
 *   data/tool-outputs/<TICKER>.txt   — preferred location
 *   <repo>/combined_financial_tool.txt  — fallback for the single-file
 *                                         bootstrap case (treated as RELIANCE)
 *
 * Usage:
 *   npm run ingest:tool-output             # seeds every TICKER.txt found
 *   npm run ingest:tool-output -- RELIANCE # seeds just one ticker
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, basename, extname } from "node:path";

import { COMPANY_MASTER } from "../../data/companies";
import { parseCombinedFinancialTool } from "./parse-combined-financial-tool";
import type { CompanyFinancialSnapshot, CompanyMaster } from "../../lib/types";

const REPO_ROOT = resolve(__dirname, "..", "..");
const SNAPSHOT_FILE = resolve(REPO_ROOT, "app", "api", "scores", "snapshot.ts");
const TOOL_OUTPUTS_DIR = resolve(REPO_ROOT, "data", "tool-outputs");
const LEGACY_FALLBACK = resolve(REPO_ROOT, "combined_financial_tool.txt");

interface SeedTask {
  ticker: string;
  filePath: string;
}

function discoverTasks(filter: string | null): SeedTask[] {
  const tasks: SeedTask[] = [];
  if (existsSync(TOOL_OUTPUTS_DIR)) {
    for (const entry of readdirSync(TOOL_OUTPUTS_DIR)) {
      if (extname(entry) !== ".txt") continue;
      const ticker = basename(entry, ".txt").toUpperCase();
      tasks.push({ ticker, filePath: resolve(TOOL_OUTPUTS_DIR, entry) });
    }
  }
  // Legacy single-file bootstrap.  Only used when no per-ticker file exists.
  if (existsSync(LEGACY_FALLBACK) && !tasks.some((t) => t.ticker === "RELIANCE")) {
    tasks.push({ ticker: "RELIANCE", filePath: LEGACY_FALLBACK });
  }
  if (filter) {
    const f = filter.toUpperCase();
    return tasks.filter((t) => t.ticker === f);
  }
  return tasks;
}

function findMaster(ticker: string): CompanyMaster | null {
  return COMPANY_MASTER.find((c) => c.ticker === ticker) ?? null;
}

function rebuildSnapshot(updated: Record<string, CompanyFinancialSnapshot>) {
  const current = readFileSync(SNAPSHOT_FILE, "utf-8");
  // Extract the existing JSON literal between the first `{` after `= ` and the
  // last `}` before `;`.  The file is auto-generated so this is safe.
  const startMarker = "const snapshot: GeneratedFinancialSnapshot = ";
  const startIdx = current.indexOf(startMarker);
  if (startIdx === -1) {
    throw new Error(`Cannot find '${startMarker}' in ${SNAPSHOT_FILE}`);
  }
  const jsonStart = current.indexOf("{", startIdx);
  // Find matching closing brace by simple depth scan.
  let depth = 0;
  let jsonEnd = -1;
  for (let i = jsonStart; i < current.length; i += 1) {
    const ch = current[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        jsonEnd = i + 1;
        break;
      }
    }
  }
  if (jsonEnd === -1) {
    throw new Error(`Could not locate end of snapshot literal in ${SNAPSHOT_FILE}`);
  }
  const literal = current.slice(jsonStart, jsonEnd);
  const parsed = JSON.parse(literal) as {
    generatedAt: string | null;
    source: string;
    companies: Record<string, CompanyFinancialSnapshot>;
  };
  for (const [ticker, snap] of Object.entries(updated)) {
    parsed.companies[ticker] = snap;
  }
  parsed.generatedAt = new Date().toISOString();
  const newLiteral = JSON.stringify(parsed, null, 2);
  const newFile = current.slice(0, jsonStart) + newLiteral + current.slice(jsonEnd);
  writeFileSync(SNAPSHOT_FILE, newFile);
}

function summariseSnap(snap: CompanyFinancialSnapshot): string {
  const yrs = Object.keys(snap.years).sort();
  if (!yrs.length) return `${snap.ticker}: no years`;
  const sample = snap.years[yrs.at(-1)!];
  const nonNull = Object.entries(sample)
    .filter(([k, v]) => k !== "fiscalYear" && k !== "fieldStatus" && v !== null)
    .length;
  return `${snap.ticker}: ${yrs.length} years (${yrs[0]}-${yrs.at(-1)}), ${nonNull}/16 fields populated in ${sample.fiscalYear}`;
}

async function main() {
  const filter = process.argv[2]?.toUpperCase() ?? null;
  const tasks = discoverTasks(filter);
  if (!tasks.length) {
    console.error("No tool-output files found. Drop a file at data/tool-outputs/<TICKER>.txt");
    process.exit(1);
  }

  const updated: Record<string, CompanyFinancialSnapshot> = {};
  for (const task of tasks) {
    const master = findMaster(task.ticker);
    if (!master) {
      console.warn(`[seed] ${task.ticker}: not in COMPANY_MASTER — skipping`);
      continue;
    }
    const text = readFileSync(task.filePath, "utf-8");
    const snap = parseCombinedFinancialTool(text, master);
    updated[task.ticker] = snap;
    console.log(`[seed] ${summariseSnap(snap)}`);
  }

  if (!Object.keys(updated).length) {
    console.error("[seed] no tickers produced output — snapshot not modified");
    process.exit(1);
  }
  rebuildSnapshot(updated);
  console.log(`[seed] snapshot.ts updated.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exit(1);
});
