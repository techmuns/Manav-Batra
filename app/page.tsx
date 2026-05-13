"use client";

import { useCallback, useState } from "react";
import { AltmanTable } from "@/components/AltmanTable";
import { BeneishTable } from "@/components/BeneishTable";
import { Card } from "@/components/Card";
import { ErrorScreen } from "@/components/ErrorScreen";
import { Landing } from "@/components/Landing";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ScoreSummary } from "@/components/ScoreSummary";
import { TrendChart } from "@/components/TrendChart";
import { findCompany } from "@/data/companies";
import type { ScoresError, ScoresResponse } from "@/lib/types";

type AppState =
  | { kind: "idle" }
  | { kind: "loading"; ticker: string; year: string }
  | { kind: "ready"; data: ScoresResponse }
  | { kind: "error"; ticker: string; year: string; error: ScoresError };

export default function Page() {
  const [state, setState] = useState<AppState>({ kind: "idle" });

  const calculate = useCallback(async (ticker: string, year: string) => {
    setState({ kind: "loading", ticker, year });
    const url = new URL("/api/scores", window.location.origin);
    url.searchParams.set("slug", ticker);
    url.searchParams.set("year", year);
    // Debug flag — when present, surface upstream diagnostics in the
    // error response so we can see the exact ingestion-failure details.
    if (new URLSearchParams(window.location.search).get("debug") === "1") {
      url.searchParams.set("debug", "1");
    }

    try {
      const res = await fetch(url.toString());
      const body = (await res.json()) as ScoresResponse | ScoresError;
      // Discriminate purely by `ok`.  not_calculable results still come
      // back with ok:true and are rendered as score cards, NOT errors.
      if (!body || (body as ScoresError).ok === false) {
        const errBody = body as ScoresError;
        setState({
          kind: "error",
          ticker,
          year,
          error: {
            ...errBody,
            master: errBody.master ?? findCompany(ticker),
          },
        });
        return;
      }
      setState({ kind: "ready", data: body as ScoresResponse });
    } catch (e) {
      setState({
        kind: "error",
        ticker,
        year,
        error: {
          ok: false,
          errorCode: "ROUTE_FAILED",
          message: e instanceof Error ? e.message : "Network error",
          master: findCompany(ticker),
        },
      });
    }
  }, []);

  if (state.kind === "idle") {
    return (
      <main className="min-h-screen">
        <Landing onCalculate={calculate} />
      </main>
    );
  }

  if (state.kind === "loading") {
    const m = findCompany(state.ticker);
    return (
      <main className="min-h-screen">
        <LoadingScreen
          companyName={m?.companyName ?? state.ticker}
          fiscalYear={state.year}
        />
      </main>
    );
  }

  if (state.kind === "error") {
    return (
      <main className="min-h-screen">
        <ErrorScreen
          error={state.error}
          onBack={() => setState({ kind: "idle" })}
          onRetry={() => calculate(state.ticker, state.year)}
        />
      </main>
    );
  }

  // ready
  const data = state.data;
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
        <span className="font-semibold">Illustrative data.</span>{" "}
        These figures were recreated from published consolidated annual
        reports for demonstration purposes; please cross-check any
        decision-critical number against the company&apos;s official
        investor-relations page.
      </div>

      <ScoreSummary
        master={data.master}
        fiscalYear={data.fiscalYear}
        beneish={data.beneish}
        altman={data.altman}
        onChangeCompany={() => setState({ kind: "idle" })}
        onRecalculate={() => calculate(data.master.ticker, data.fiscalYear)}
      />

      <Card title="Fiscal year" subtitle="Pick a year — the dashboard refetches and recalculates.">
        <div className="flex flex-wrap items-center gap-2">
          {data.availableYears.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => calculate(data.master.ticker, y)}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
                y === data.fiscalYear
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
        <BeneishTable outcome={data.beneish} />
      </Card>

      <Card title="Altman Z-Score" subtitle="Five-variable bankruptcy distress model">
        <AltmanTable outcome={data.altman} />
      </Card>

      <Card title="Score trend" subtitle="Per-year M-Score and Z-Score; gaps where inputs are missing.">
        <TrendChart trend={data.trend} isFinancial={data.master.isFinancialCompany} />
      </Card>
    </main>
  );
}
