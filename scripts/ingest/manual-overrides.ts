/**
 * Reads and validates `data/manual-overrides.json`.
 *
 * Manual overrides are the only path that produces values without going
 * through XBRL or annual-report parsers.  Each override MUST cite a
 * source document and section, and is tagged "manual_verified" at the
 * field-status level (the snapshot's overall `source` stays
 * "official_filings_pipeline" or "annual_report_verified").
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ManualOverride } from "@/lib/types";

const PATH = resolve(__dirname, "..", "..", "data", "manual-overrides.json");

export function loadManualOverrides(): ManualOverride[] {
  if (!existsSync(PATH)) return [];
  const raw = JSON.parse(readFileSync(PATH, "utf8")) as {
    overrides?: ManualOverride[];
  };
  const list = Array.isArray(raw.overrides) ? raw.overrides : [];

  // Hard validation — anything malformed is dropped with a warning.
  // No partial values, no missing source citations.
  const valid: ManualOverride[] = [];
  for (const o of list) {
    if (
      o &&
      typeof o.ticker === "string" &&
      typeof o.fiscalYear === "string" &&
      typeof o.field === "string" &&
      typeof o.value === "number" &&
      Number.isFinite(o.value) &&
      typeof o.sourceDocument === "string" &&
      o.sourceDocument.length > 0 &&
      typeof o.pageOrSection === "string" &&
      o.pageOrSection.length > 0 &&
      o.source === "annual_report_verified" &&
      o.verifiedBy === "manual"
    ) {
      valid.push(o);
    } else {
      console.warn("[manual-overrides] dropping malformed entry:", o);
    }
  }
  return valid;
}
