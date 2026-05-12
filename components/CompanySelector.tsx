"use client";

import { useMemo, useState } from "react";
import type { CompanyMaster } from "@/lib/types";

export function CompanySelector({
  companies,
  selectedTicker,
  selectedYear,
  availableYears,
  onSelectCompany,
  onSelectYear,
  onCalculate,
  loading,
}: {
  companies: CompanyMaster[];
  selectedTicker: string | null;
  selectedYear: string | null;
  availableYears: string[];
  onSelectCompany: (ticker: string) => void;
  onSelectYear: (year: string) => void;
  onCalculate: () => void;
  loading: boolean;
}) {
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState<string>("All");

  const sectors = useMemo(() => {
    const set = new Set<string>(["All"]);
    for (const c of companies) set.add(c.sector);
    return [...set];
  }, [companies]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return companies.filter((c) => {
      if (sector !== "All" && c.sector !== sector) return false;
      if (!q) return true;
      return (
        c.companyName.toLowerCase().includes(q) ||
        c.ticker.toLowerCase().includes(q)
      );
    });
  }, [companies, query, sector]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search company or ticker"
          className="rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
        />
        <select
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          className="rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-ink"
        >
          {sectors.map((s) => (
            <option key={s} value={s}>
              {s === "All" ? "All sectors" : s}
            </option>
          ))}
        </select>
      </div>

      <div className="max-h-56 overflow-auto rounded-xl border border-line bg-white">
        {filtered.length === 0 && (
          <p className="px-4 py-3 text-sm text-ink-muted">No matches.</p>
        )}
        {filtered.map((c) => (
          <button
            key={c.ticker}
            type="button"
            onClick={() => onSelectCompany(c.ticker)}
            className={`flex w-full items-center justify-between border-b border-line/60 px-4 py-2.5 text-left text-sm transition last:border-b-0 hover:bg-paper ${
              selectedTicker === c.ticker ? "bg-paper" : ""
            }`}
          >
            <span className="flex flex-col">
              <span className="font-medium text-ink">{c.companyName}</span>
              <span className="text-[11px] text-ink-subtle">{c.sector}</span>
            </span>
            <span className="text-xs font-medium text-ink-subtle">{c.ticker}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <label className="block text-xs font-medium text-ink-muted">
            Fiscal year
          </label>
          <select
            value={selectedYear ?? ""}
            onChange={(e) => onSelectYear(e.target.value)}
            disabled={availableYears.length === 0}
            className="mt-1 w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-ink disabled:opacity-50"
          >
            {availableYears.length === 0 && <option value="">—</option>}
            {availableYears.map((y) => (
              <option key={y} value={y}>
                FY {y}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          disabled={!selectedTicker || loading}
          onClick={onCalculate}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Fetching…
            </>
          ) : (
            "Calculate"
          )}
        </button>
      </div>

      <p className="text-[11px] text-ink-subtle">
        Scores are calculated only when all required variables are available.
      </p>
    </div>
  );
}
