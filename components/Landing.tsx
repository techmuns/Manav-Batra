"use client";

import { useEffect, useMemo, useState } from "react";
import type { EligibleCompany, EligibleScoreUniverse } from "@/lib/types";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; universe: EligibleScoreUniverse }
  | { kind: "error"; message: string };

export function Landing({
  onCalculate,
}: {
  onCalculate: (ticker: string, year: string) => void;
}) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("All");
  const [ticker, setTicker] = useState<string | null>(null);
  const [year, setYear] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/eligible-universe")
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        if (!body || body.ok === false) {
          setState({ kind: "error", message: body?.message ?? "Failed to load universe" });
          return;
        }
        setState({ kind: "ready", universe: body as EligibleScoreUniverse });
      })
      .catch((e) => {
        if (!cancelled) setState({ kind: "error", message: e instanceof Error ? e.message : "Network error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const companies = state.kind === "ready" ? state.universe.companies : [];

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
      return c.companyName.toLowerCase().includes(q) || c.ticker.toLowerCase().includes(q);
    });
  }, [companies, query, sector]);

  const selected: EligibleCompany | undefined = companies.find((c) => c.ticker === ticker);

  // Re-pick a valid year whenever the company changes.
  useEffect(() => {
    if (!selected) return;
    if (!year || !selected.availableFiscalYears.includes(year)) {
      setYear(selected.availableFiscalYears[0] ?? null);
    }
  }, [selected, year]);

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
          Calculate Beneish M-Score and Altman Z-Score using company financials. No
          assumptions — only companies and years with complete verified inputs are shown.
        </p>
      </div>

      {state.kind === "loading" && (
        <div className="mt-10 w-full rounded-3xl border border-line bg-white p-8 text-center text-sm text-ink-muted shadow-card">
          Loading available companies…
        </div>
      )}

      {state.kind === "error" && (
        <div className="mt-10 w-full rounded-3xl border border-line bg-white p-8 shadow-card">
          <p className="text-sm font-semibold text-ink">Couldn&apos;t load the company list.</p>
          <p className="mt-1 text-xs text-ink-muted">{state.message}</p>
        </div>
      )}

      {state.kind === "ready" && companies.length === 0 && (
        <EmptyAdminState />
      )}

      {state.kind === "ready" && companies.length > 0 && (
        <div className="mt-10 w-full rounded-3xl border border-line bg-white p-6 shadow-card sm:p-8">
          <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search company or ticker"
              className="w-full rounded-xl border border-line bg-white px-4 py-3 text-[15px] outline-none transition focus:border-ink focus:ring-4 focus:ring-ink/10"
            />
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
                  <span className="text-[11px] text-ink-subtle">
                    {c.sector} · {c.availableFiscalYears.length} year
                    {c.availableFiscalYears.length === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="text-xs font-medium text-ink-subtle">{c.ticker}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">
                Fiscal year {selected ? `· ${selected.companyName}` : ""}
              </label>
              <select
                value={year ?? ""}
                onChange={(e) => setYear(e.target.value)}
                disabled={!selected}
                className="mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none focus:border-ink disabled:opacity-50"
              >
                {!selected && <option value="">Choose a company above</option>}
                {selected?.availableFiscalYears.map((y) => (
                  <option key={y} value={y}>
                    FY {y}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={!selected || !year}
              onClick={() => selected && year && onCalculate(selected.ticker, year)}
              className="rounded-xl bg-ink px-7 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Calculate
            </button>
          </div>

          <p className="mt-4 text-[11px] text-ink-subtle">
            Only companies and years with complete verified inputs are shown.
          </p>
        </div>
      )}

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

function EmptyAdminState() {
  return (
    <div className="mt-10 w-full rounded-3xl border border-line bg-white p-8 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
        No eligible companies
      </p>
      <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-ink">
        No fully calculable company-year combinations are available yet.
      </h2>
      <p className="mt-3 text-sm text-ink-muted">
        Verified Screener data is loaded, but Beneish and Altman require fields
        Screener doesn&apos;t publish — gross profit, current assets, current
        liabilities, retained earnings, SG&amp;A and historical market cap.
        Until those gaps are filled by the annual-report enrichment pipeline,
        no company-year passes the eligibility check.
      </p>
      <p className="mt-3 text-xs text-ink-subtle">
        Next step for the operator: run annual-report ingestion to unlock
        scores. No estimated values will be substituted.
      </p>
    </div>
  );
}
