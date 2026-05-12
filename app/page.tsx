"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AltmanTable } from "@/components/AltmanTable";
import { BeneishTable } from "@/components/BeneishTable";
import { Card } from "@/components/Card";
import { CompanySelector } from "@/components/CompanySelector";
import { ComparisonTable } from "@/components/ComparisonTable";
import { ScoreSummary } from "@/components/ScoreSummary";
import { TrendChart } from "@/components/TrendChart";
import { COMPANY_MASTER, findCompany } from "@/data/companies";
import { DEV_MOCK_AVAILABLE_YEARS } from "@/data/devMockFinancials";
import { calculateAltman, calculateBeneish } from "@/lib/calculations";
import type {
  AltmanOutcome,
  BeneishOutcome,
  CompanyFinancials,
} from "@/lib/types";

type ApiPayload = CompanyFinancials & { usingSampleData?: boolean; error?: string };

type LoadState =
  | { kind: "idle" }
  | { kind: "loading"; ticker: string }
  | { kind: "ready"; data: ApiPayload }
  | { kind: "error"; ticker: string; message: string };

export default function Page() {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>({ kind: "idle" });

  const data = state.kind === "ready" ? state.data : null;

  // Years available for the selected company.  Before Calculate is
  // pressed, fall back to the static dev-mock year list so the year
  // selector is never empty.
  const availableYears = useMemo(() => {
    if (data && data.years.length > 0) {
      return [...data.years].map((y) => y.fiscalYear).sort((a, b) => b.localeCompare(a));
    }
    return DEV_MOCK_AVAILABLE_YEARS;
  }, [data]);

  // Initialise default year (latest) whenever the available list shifts.
  useEffect(() => {
    if (availableYears.length === 0) return;
    if (!selectedYear || !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  const handleCalculate = useCallback(async () => {
    if (!selectedTicker) return;
    setState({ kind: "loading", ticker: selectedTicker });
    try {
      const res = await fetch(`/api/financials?ticker=${encodeURIComponent(selectedTicker)}`);
      const json = (await res.json()) as ApiPayload;
      if (!res.ok && (!json.years || json.years.length === 0)) {
        setState({
          kind: "error",
          ticker: selectedTicker,
          message: json.error ?? `Request failed (HTTP ${res.status})`,
        });
        return;
      }
      try {
        sessionStorage.setItem(`fin:${selectedTicker}`, JSON.stringify(json));
      } catch {
        /* sessionStorage unavailable; ignore */
      }
      setState({ kind: "ready", data: json });
    } catch (err) {
      setState({
        kind: "error",
        ticker: selectedTicker,
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }, [selectedTicker]);

  // Recompute scores for the *selected* fiscal year against the *prior* fiscal year.
  // This runs whenever data OR selectedYear changes — that is exactly how the
  // year selector triggers a recalc.
  const { beneish, altman, fiscalYear } = useMemo(() => {
    if (!data || !selectedYear) {
      const fy = selectedYear ?? "—";
      return {
        fiscalYear: fy,
        beneish: { status: "not_calculable", fiscalYear: fy, missing: [] } as BeneishOutcome,
        altman: { status: "not_calculable", fiscalYear: fy, missing: [] } as AltmanOutcome,
      };
    }
    const sorted = [...data.years].sort((a, b) =>
      a.fiscalYear.localeCompare(b.fiscalYear)
    );
    const idx = sorted.findIndex((y) => y.fiscalYear === selectedYear);
    const current = idx >= 0 ? sorted[idx] : undefined;
    const prior = idx > 0 ? sorted[idx - 1] : undefined;
    return {
      fiscalYear: selectedYear,
      beneish: calculateBeneish(current, prior),
      altman: calculateAltman(data.master, current),
    };
  }, [data, selectedYear]);

  const showDashboard = state.kind === "ready" && data;
  const master = data?.master;
  const usingSampleData = state.kind === "ready" && state.data.usingSampleData === true;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
            Financial Risk
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            Beneish &amp; Altman Dashboard
          </h1>
        </div>
        {showDashboard && (
          <div className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-ink" />
            Selected FY:&nbsp;<span className="font-semibold text-ink">FY {fiscalYear}</span>
          </div>
        )}
      </header>

      {!showDashboard && (
        <Card title="Select company" subtitle={`${COMPANY_MASTER.length} Indian listed companies`}>
          <CompanySelector
            companies={COMPANY_MASTER}
            selectedTicker={selectedTicker}
            selectedYear={selectedYear}
            availableYears={availableYears}
            onSelectCompany={(t) => {
              setSelectedTicker(t);
            }}
            onSelectYear={setSelectedYear}
            onCalculate={handleCalculate}
            loading={state.kind === "loading"}
          />
        </Card>
      )}

      {state.kind === "loading" && !data && (
        <Card>
          <div className="flex items-center gap-3 text-sm text-ink-muted">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
            Fetching financial data for {state.ticker}…
          </div>
        </Card>
      )}

      {state.kind === "error" && (
        <Card title="Data unavailable">
          <p className="text-sm text-ink">
            We couldn&apos;t retrieve financial data for {findCompany(state.ticker)?.companyName ?? state.ticker}.
          </p>
          <p className="mt-1 text-xs text-ink-muted">Reason: {state.message}</p>
          <p className="mt-3 text-xs text-ink-subtle">
            No scores are shown because no real data is available — mock or
            placeholder financials are never displayed in their place.
          </p>
          <button
            type="button"
            onClick={() => setState({ kind: "idle" })}
            className="mt-4 rounded-lg border border-line bg-white px-3.5 py-1.5 text-xs font-medium text-ink-muted hover:text-ink"
          >
            Back to selector
          </button>
        </Card>
      )}

      {showDashboard && master && (
        <>
          {usingSampleData && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              <span className="font-semibold">Sample data.</span>{" "}
              Real Screener ingestion is not currently available in this environment, so this
              company is shown with illustrative dev-only financials. Do not interpret these
              numbers as live data.
            </div>
          )}

          <ScoreSummary
            master={master}
            fiscalYear={fiscalYear}
            beneish={beneish}
            altman={altman}
            onChangeCompany={() => {
              setState({ kind: "idle" });
              setSelectedYear(null);
            }}
          />

          <Card
            title="Fiscal year"
            subtitle="Select a year — scores, calculation tables and trend recompute instantly."
          >
            <div className="flex flex-wrap items-center gap-2">
              {availableYears.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => setSelectedYear(y)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
                    selectedYear === y
                      ? "bg-ink text-white ring-ink"
                      : "bg-white text-ink-muted ring-line hover:text-ink"
                  }`}
                >
                  FY {y}
                </button>
              ))}
            </div>
          </Card>

          <Card title="Beneish M-Score" subtitle="Eight-variable manipulation detection model">
            <BeneishTable outcome={beneish} />
          </Card>

          <Card title="Altman Z-Score" subtitle="Five-variable bankruptcy distress model">
            <AltmanTable outcome={altman} />
          </Card>

          <Card title="Score trend" subtitle="Per-year M-Score and Z-Score; gaps where inputs are missing.">
            <TrendChart company={data} />
          </Card>

          <Card title="Comparison" subtitle={`At FY ${fiscalYear}`}>
            <ComparisonTable current={data} fiscalYear={fiscalYear} />
          </Card>
        </>
      )}
    </main>
  );
}
