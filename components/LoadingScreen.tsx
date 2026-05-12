"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "Fetching company financials",
  "Reading selected fiscal year",
  "Reading previous fiscal year",
  "Calculating Beneish variables",
  "Calculating Altman variables",
  "Preparing score dashboard",
] as const;

export function LoadingScreen({
  companyName,
  fiscalYear,
}: {
  companyName: string;
  fiscalYear: string;
}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, 420);
    return () => clearInterval(id);
  }, []);

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="mx-auto flex max-w-2xl flex-col px-6 py-16">
      <div className="rounded-3xl border border-line bg-white p-8 shadow-card">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
          Calculating
        </p>
        <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink">
          {companyName}
        </h2>
        <p className="mt-0.5 text-sm text-ink-muted">FY {fiscalYear}</p>

        <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-paper">
          <div
            className="h-full rounded-full bg-ink transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <ul className="mt-6 space-y-3 text-sm">
          {STEPS.map((label, i) => {
            const state: "done" | "current" | "pending" =
              i < step ? "done" : i === step ? "current" : "pending";
            return (
              <li key={label} className="flex items-center gap-3">
                <Indicator state={state} />
                <span
                  className={
                    state === "pending"
                      ? "text-ink-subtle"
                      : state === "current"
                        ? "text-ink"
                        : "text-ink-muted"
                  }
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="mt-7 text-xs text-ink-subtle">
          Fetching financials and calculating scores…
        </p>
      </div>
    </div>
  );
}

function Indicator({ state }: { state: "done" | "current" | "pending" }) {
  if (state === "done") {
    return (
      <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-white">
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M5 12l5 5 9-11" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-ink/15 border-t-ink" />
    );
  }
  return <span className="h-5 w-5 rounded-full border border-line bg-paper" />;
}
