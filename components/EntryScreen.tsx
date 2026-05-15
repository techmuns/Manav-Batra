"use client";

import { useEffect, useMemo, useState } from "react";
import type { EligibleCompany, EligibleScoreUniverse } from "@/lib/types";

export type ScoreType = "altman" | "beneish";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; universe: EligibleScoreUniverse }
  | { kind: "error"; message: string };

export function EntryScreen({
  onContinue,
  initialTicker,
  initialScoreType,
}: {
  onContinue: (args: { ticker: string; year: string; scoreType: ScoreType }) => void;
  initialTicker?: string | null;
  initialScoreType?: ScoreType | null;
}) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("All");
  const [ticker, setTicker] = useState<string | null>(initialTicker ?? null);
  const [scoreType, setScoreType] = useState<ScoreType | null>(initialScoreType ?? null);

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
        if (!cancelled)
          setState({ kind: "error", message: e instanceof Error ? e.message : "Network error" });
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
  const ready = !!selected && !!scoreType;

  return (
    <div className="relative isolate min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu blur-3xl">
        <div
          className="mx-auto aspect-[1155/678] w-[80rem] bg-gradient-to-tr from-indigo-300 via-rose-200 to-amber-200 opacity-30"
          style={{ clipPath: "polygon(74% 44%, 100% 61%, 87% 100%, 0 80%, 14% 0)" }}
        />
      </div>

      <div className="mx-auto flex max-w-5xl flex-col items-center px-6 py-12 sm:py-20">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-ink-subtle">
            Financial Risk
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink sm:text-6xl">
            Financial Risk Score Dashboard
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-ink-muted">
            Analyse a company through Altman Z-Score or Beneish M-Score. Years shown reflect all
            available company data — no estimates, no missing-year fill-ins.
          </p>
        </div>

        {state.kind === "loading" && (
          <div className="mt-12 w-full rounded-3xl border border-line bg-white/80 p-10 text-center text-sm text-ink-muted shadow-card backdrop-blur">
            Loading available companies…
          </div>
        )}

        {state.kind === "error" && (
          <div className="mt-12 w-full rounded-3xl border border-line bg-white p-8 shadow-card">
            <p className="text-sm font-semibold text-ink">Couldn&apos;t load the company list.</p>
            <p className="mt-1 text-xs text-ink-muted">{state.message}</p>
          </div>
        )}

        {state.kind === "ready" && companies.length === 0 && (
          <div className="mt-12 w-full rounded-3xl border border-line bg-white p-8 shadow-card">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
              No eligible companies
            </p>
            <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-ink">
              No fully calculable company-year combinations are available yet.
            </h2>
          </div>
        )}

        {state.kind === "ready" && companies.length > 0 && (
          <div className="mt-12 grid w-full gap-6 lg:grid-cols-[1fr_1.1fr]">
            {/* Company picker */}
            <div className="rounded-3xl border border-line bg-white p-6 shadow-card">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                Step 1 · Company
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_160px]">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    if (selected && e.target.value !== selected.companyName) {
                      setTicker(null);
                    }
                  }}
                  placeholder="Search company or ticker"
                  className="w-full rounded-xl border border-line bg-white px-4 py-3 text-[15px] outline-none transition focus:border-ink focus:ring-4 focus:ring-ink/10"
                />
                <select
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  className="rounded-xl border border-line bg-white px-3 py-3 text-sm outline-none focus:border-ink"
                >
                  {sectors.map((s) => (
                    <option key={s} value={s}>
                      {s === "All" ? "All sectors" : s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3 max-h-72 overflow-auto rounded-xl border border-line bg-paper/40">
                {filtered.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-ink-muted">No matches.</p>
                )}
                {filtered.map((c) => (
                  <button
                    key={c.ticker}
                    type="button"
                    onClick={() => {
                      setTicker(c.ticker);
                      setQuery(c.companyName);
                    }}
                    className={`flex w-full items-center justify-between border-b border-line/60 px-4 py-3 text-left text-sm transition last:border-b-0 hover:bg-white ${
                      ticker === c.ticker ? "bg-white ring-1 ring-ink/10" : ""
                    }`}
                  >
                    <span className="flex flex-col">
                      <span className="font-medium text-ink">{c.companyName}</span>
                      <span className="text-[11px] text-ink-subtle">
                        {c.sector} · {c.availableFiscalYears.length}{" "}
                        {c.availableFiscalYears.length === 1 ? "year" : "years"}
                      </span>
                    </span>
                    <span className="text-xs font-medium text-ink-subtle">{c.ticker}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Score-type picker */}
            <div className="rounded-3xl border border-line bg-white p-6 shadow-card">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                Step 2 · Score type
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <ScoreTypeCard
                  active={scoreType === "altman"}
                  onClick={() => setScoreType("altman")}
                  title="Altman Z-Score"
                  subtitle="Bankruptcy distress model"
                  description="Five-factor model. Safe > 3.0, Grey 1.8–3.0, Distress < 1.8."
                  accent="from-emerald-100 via-emerald-50 to-white"
                />
                <ScoreTypeCard
                  active={scoreType === "beneish"}
                  onClick={() => setScoreType("beneish")}
                  title="Beneish M-Score"
                  subtitle="Earnings-manipulation model"
                  description="Eight-variable composite. Cutoff −1.78; higher = elevated risk."
                  accent="from-rose-100 via-rose-50 to-white"
                />
              </div>
              <div className="mt-6 rounded-xl border border-line bg-paper/40 px-4 py-3 text-xs text-ink-muted">
                {selected ? (
                  <span>
                    <span className="font-medium text-ink">{selected.companyName}</span> ·{" "}
                    {selected.availableFiscalYears.length} years available (
                    {selected.availableFiscalYears.join(", ")})
                  </span>
                ) : (
                  <span className="text-ink-subtle">Choose a company first.</span>
                )}
              </div>
              <button
                type="button"
                disabled={!ready}
                onClick={() => {
                  if (!selected || !scoreType) return;
                  onContinue({
                    ticker: selected.ticker,
                    year: selected.availableFiscalYears[0],
                    scoreType,
                  });
                }}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-7 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                View Dashboard
                <span aria-hidden>→</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreTypeCard({
  active,
  onClick,
  title,
  subtitle,
  description,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  description: string;
  accent: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border bg-white p-5 text-left transition ${
        active
          ? "border-ink shadow-card ring-2 ring-ink/10"
          : "border-line hover:border-ink/40 hover:shadow-card"
      }`}
    >
      <div
        className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br ${accent} opacity-60`}
      />
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        {subtitle}
      </p>
      <h3 className="mt-1 text-lg font-semibold tracking-tight text-ink">{title}</h3>
      <p className="mt-2 text-xs leading-relaxed text-ink-muted">{description}</p>
      <span
        className={`mt-4 inline-flex items-center text-[11px] font-medium ${
          active ? "text-ink" : "text-ink-subtle"
        }`}
      >
        {active ? "Selected ✓" : "Choose"}
      </span>
    </button>
  );
}
