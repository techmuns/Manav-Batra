"use client";

import { useMemo, useState } from "react";
import type { CompanyMaster } from "@/lib/types";

// Static range of fiscal years available for selection at landing time —
// we don't yet know which years a given company actually has.  The API
// re-resolves the selected year against `availableYears` from Screener
// and falls back to the latest available if the requested year isn't
// present.
const SELECTABLE_YEARS = [
  "2025",
  "2024",
  "2023",
  "2022",
  "2021",
  "2020",
  "2019",
  "2018",
  "2017",
  "2016",
];

export function Landing({
  companies,
  onCalculate,
}: {
  companies: CompanyMaster[];
  onCalculate: (ticker: string, year: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("All");
  const [ticker, setTicker] = useState<string | null>(null);
  const [year, setYear] = useState("2025");

  const sectors = useMemo(() => {
    const s = new Set<string>(["All"]);
    for (const c of companies) s.add(c.sector);
    return [...s];
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

  const selected = companies.find((c) => c.ticker === ticker);

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-16 sm:py-24">
      <div className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-subtle">
          Financial Risk
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          Financial Risk Score Dashboard
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-ink-muted">
          Calculate Beneish M-Score and Altman Z-Score using company
          financials. No assumptions — when a required variable is missing,
          the score is blocked.
        </p>
      </div>

      <div className="mt-10 w-full rounded-3xl border border-line bg-white p-6 shadow-card sm:p-8">
        <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search company or ticker"
              className="w-full rounded-xl border border-line bg-white px-4 py-3 text-[15px] outline-none transition focus:border-ink focus:ring-4 focus:ring-ink/10"
            />
          </div>
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="rounded-xl border border-line bg-white px-4 py-3 text-[15px] outline-none focus:border-ink"
          >
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s === "All" ? "All sectors" : s}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-line bg-paper/50">
          {filtered.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-ink-muted">No matches.</p>
          )}
          {filtered.map((c) => (
            <button
              key={c.ticker}
              type="button"
              onClick={() => setTicker(c.ticker)}
              className={`flex w-full items-center justify-between border-b border-line/60 px-4 py-3 text-left text-sm transition last:border-b-0 hover:bg-white ${
                ticker === c.ticker ? "bg-white" : ""
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

        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">
              Selected
            </label>
            <div className="mt-1.5 rounded-xl border border-line bg-paper/50 px-4 py-3 text-sm">
              {selected ? (
                <span className="font-medium text-ink">{selected.companyName}</span>
              ) : (
                <span className="text-ink-subtle">Choose a company above</span>
              )}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">
              Fiscal year
            </label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none focus:border-ink"
            >
              {SELECTABLE_YEARS.map((y) => (
                <option key={y} value={y}>
                  FY {y}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={!ticker}
            onClick={() => ticker && onCalculate(ticker, year)}
            className="rounded-xl bg-ink px-7 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Calculate
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {["Beneish M-Score", "Altman Z-Score", "No assumptions"].map((chip) => (
          <span
            key={chip}
            className="rounded-full border border-line bg-white px-3 py-1 text-[11px] font-medium text-ink-muted"
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}
