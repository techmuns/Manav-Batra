"use client";

import { useCallback, useState } from "react";
import { AltmanDashboard } from "@/components/AltmanDashboard";
import { BeneishDashboard } from "@/components/BeneishDashboard";
import { EntryScreen, type ScoreType } from "@/components/EntryScreen";
import { ErrorScreen } from "@/components/ErrorScreen";
import { LoadingScreen } from "@/components/LoadingScreen";
import { findCompany } from "@/data/companies";
import type { ScoresError, ScoresResponse } from "@/lib/types";

type AppState =
  | { kind: "idle"; lastTicker?: string | null; lastScoreType?: ScoreType | null }
  | { kind: "loading"; ticker: string; year: string; scoreType: ScoreType }
  | { kind: "ready"; data: ScoresResponse; scoreType: ScoreType }
  | { kind: "error"; ticker: string; year: string; scoreType: ScoreType; error: ScoresError };

export default function Page() {
  const [state, setState] = useState<AppState>({ kind: "idle" });

  const calculate = useCallback(
    async (args: { ticker: string; year: string; scoreType: ScoreType }) => {
      setState({ kind: "loading", ...args });
      const url = new URL("/api/scores", window.location.origin);
      url.searchParams.set("slug", args.ticker);
      url.searchParams.set("year", args.year);
      if (new URLSearchParams(window.location.search).get("debug") === "1") {
        url.searchParams.set("debug", "1");
      }
      try {
        const res = await fetch(url.toString());
        const body = (await res.json()) as ScoresResponse | ScoresError;
        if (!body || (body as ScoresError).ok === false) {
          const errBody = body as ScoresError;
          setState({
            kind: "error",
            ticker: args.ticker,
            year: args.year,
            scoreType: args.scoreType,
            error: { ...errBody, master: errBody.master ?? findCompany(args.ticker) },
          });
          return;
        }
        setState({ kind: "ready", data: body as ScoresResponse, scoreType: args.scoreType });
      } catch (e) {
        setState({
          kind: "error",
          ticker: args.ticker,
          year: args.year,
          scoreType: args.scoreType,
          error: {
            ok: false,
            errorCode: "ROUTE_FAILED",
            message: e instanceof Error ? e.message : "Network error",
            master: findCompany(args.ticker),
          },
        });
      }
    },
    []
  );

  const goBackToEntry = useCallback(() => {
    setState((s) => ({
      kind: "idle",
      lastTicker:
        s.kind === "ready"
          ? s.data.company.ticker
          : "ticker" in s
            ? s.ticker
            : null,
      lastScoreType: "scoreType" in s ? s.scoreType : null,
    }));
  }, []);

  if (state.kind === "idle") {
    return (
      <EntryScreen
        onContinue={calculate}
        initialTicker={state.lastTicker ?? null}
        initialScoreType={state.lastScoreType ?? null}
      />
    );
  }

  if (state.kind === "loading") {
    const m = findCompany(state.ticker);
    return (
      <LoadingScreen
        companyName={m?.companyName ?? state.ticker}
        fiscalYear={state.year}
      />
    );
  }

  if (state.kind === "error") {
    return (
      <ErrorScreen
        error={state.error}
        onBack={goBackToEntry}
        onRetry={() =>
          calculate({
            ticker: state.ticker,
            year: state.year,
            scoreType: state.scoreType,
          })
        }
      />
    );
  }

  // ready — branch on score type
  if (state.scoreType === "altman") {
    return <AltmanDashboard data={state.data} onChangeSelection={goBackToEntry} />;
  }
  return <BeneishDashboard data={state.data} onChangeSelection={goBackToEntry} />;
}
