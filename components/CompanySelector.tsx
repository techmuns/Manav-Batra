"use client";

import { useMemo, useState } from "react";
import type { CompanyFinancials } from "@/lib/types";

export function CompanySelector({
  companies,
  initialTicker,
  initialYear,
  onCalculate,
  loading,
}: {
  companies: CompanyFinancials[];
  initialTicker: string;
  initialYear: number;
  onCalculate: (ticker: string, year: number) => void;
  loading: boolean;
}) {
  const [ticker, setTicker] = useState(initialTicker);
  const [query, setQuery] = useState("");
  const [year, setYear] = useState(initialYear);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.ticker.toLowerCase().includes(q)
    );
  }, [query, companies]);

  const selected = companies.find((c) => c.ticker === ticker);
  const years = selected ? selected.years.map((y) => y.year).sort((a, b) => b - a) : [];

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_220px_auto] md:items-end">
      <div>
        <label className="block text-xs font-medium text-ink-muted">
          Company
        </label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search companies..."
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink"
        />
        <div className="mt-2 max-h-44 overflow-auto rounded-lg border border-line bg-white">
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-sm text-ink-muted">No matches.</p>
          )}
          {filtered.map((c) => (
            <button
              key={c.ticker}
              type="button"
              onClick={() => {
                setTicker(c.ticker);
                const latest = c.years[c.years.length - 1]?.year;
                if (latest) setYear(latest);
              }}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-paper ${
                ticker === c.ticker ? "bg-paper" : ""
              }`}
            >
              <span className="font-medium">{c.name}</span>
              <span className="text-xs text-ink-subtle">{c.ticker}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-muted">
          Year
        </label>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          disabled={!selected}
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink disabled:opacity-50"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              FY {y}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        disabled={!selected || loading}
        onClick={() => onCalculate(ticker, year)}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <>
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Calculating
          </>
        ) : (
          "Calculate"
        )}
      </button>
    </div>
  );
}
