"use client";

import type { ErrorCode, ScoresError } from "@/lib/types";

const COPY: Record<ErrorCode, { title: string; detail: string }> = {
  SCREENER_FETCH_FAILED: {
    title: "Unable to fetch company financials",
    detail:
      "We couldn't retrieve the data needed to calculate scores. Please try again in a moment.",
  },
  SCREENER_FETCH_BLOCKED: {
    title: "Live data source is currently unreachable",
    detail:
      "The upstream data source returned a non-OK response — most likely a bot block on requests from this environment.",
  },
  PARSER_FAILED: {
    title: "Couldn't read financial tables",
    detail:
      "The upstream page loaded but we couldn't extract the financial tables we need.",
  },
  YEAR_NOT_FOUND: {
    title: "Fiscal year not available",
    detail: "The selected fiscal year is not available for this company.",
  },
  UNKNOWN_TICKER: {
    title: "Company not found",
    detail: "The selected ticker isn't in our company list.",
  },
  MISSING_SLUG: {
    title: "Missing company selection",
    detail: "Please pick a company before calculating.",
  },
  ROUTE_FAILED: {
    title: "Request failed",
    detail: "The Calculate request couldn't complete. Please try again.",
  },
  NO_SNAPSHOT: {
    title: "Data not ingested yet",
    detail:
      "The Screener snapshot pipeline hasn't produced any data yet. Once the GitHub Actions ingestion job runs, scores will be available.",
  },
  SNAPSHOT_NOT_INGESTED: {
    title: "Company not ingested yet",
    detail:
      "This company isn't in the latest snapshot. The next ingestion run should pick it up.",
  },
};

export function ErrorScreen({
  error,
  onBack,
  onRetry,
}: {
  error: ScoresError;
  onBack: () => void;
  onRetry: () => void;
}) {
  const copy = COPY[error.errorCode] ?? {
    title: "Something went wrong",
    detail: error.message,
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col px-6 py-16">
      <div className="rounded-3xl border border-line bg-white p-8 shadow-card">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
          {error.errorCode}
        </p>
        <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink">
          {copy.title}
        </h2>
        {error.master && (
          <p className="mt-0.5 text-sm text-ink-muted">
            {error.master.companyName} · {error.master.ticker}
          </p>
        )}
        <p className="mt-4 text-sm text-ink-muted">{copy.detail}</p>
        {error.message && error.message !== copy.detail && (
          <p className="mt-2 rounded-lg bg-paper px-3 py-2 font-mono text-[11px] text-ink-muted">
            {error.message}
          </p>
        )}
        <p className="mt-3 text-xs text-ink-subtle">
          No scores are shown because no real data is available — placeholder
          or mock financials are never displayed in their place.
        </p>

        {error.debug && (
          <details className="mt-4 rounded-lg border border-line bg-paper/70 px-3 py-2 text-[11px]">
            <summary className="cursor-pointer font-semibold text-ink-muted">
              Debug
            </summary>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-ink-muted">
{JSON.stringify(error.debug, null, 2)}
            </pre>
          </details>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink-muted hover:text-ink"
          >
            Back to selector
          </button>
        </div>
      </div>
    </div>
  );
}
