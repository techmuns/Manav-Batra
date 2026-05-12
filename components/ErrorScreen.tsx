"use client";

import type { ScoresError } from "@/lib/types";

const COPY: Record<ScoresError["error"], { title: string; detail: string }> = {
  fetch_failed: {
    title: "Unable to fetch company financials",
    detail:
      "We couldn't retrieve the data needed to calculate scores. Please try again in a moment.",
  },
  screener_fetch_blocked: {
    title: "Live data source is currently unreachable",
    detail:
      "The upstream data source returned a non-OK response — most likely a bot block on the request from this environment.",
  },
  parser_failed: {
    title: "Couldn't read financial tables",
    detail:
      "The upstream page loaded but we couldn't extract the financial tables we need.",
  },
  unknown_ticker: {
    title: "Company not found",
    detail: "The selected ticker isn't in our company list.",
  },
  no_data: {
    title: "No financial data available",
    detail: "Nothing was returned for this company.",
  },
  year_unavailable: {
    title: "Year not available",
    detail: "The selected fiscal year is not available for this company.",
  },
  missing_slug: {
    title: "Missing company selection",
    detail: "Please pick a company before calculating.",
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
  const copy = COPY[error.error] ?? {
    title: "Something went wrong",
    detail: error.message,
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col px-6 py-16">
      <div className="rounded-3xl border border-line bg-white p-8 shadow-card">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
          Data unavailable
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
