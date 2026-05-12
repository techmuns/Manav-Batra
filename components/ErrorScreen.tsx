"use client";

import type { ScoresError } from "@/lib/types";

const COPY: Record<ScoresError["error"], { title: string; detail: string }> = {
  fetch_failed: {
    title: "Unable to fetch company financials",
    detail:
      "We couldn't retrieve the data needed to calculate scores. Please try again in a moment.",
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
        <p className="mt-3 text-xs text-ink-subtle">
          No scores are shown because no real data is available — placeholder
          or mock financials are never displayed in their place.
        </p>

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
