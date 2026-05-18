"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BENEISH_CUTOFF } from "@/lib/calculations";
import {
  BENEISH_COMPONENTS,
  beneishNarrative,
  beneishRiskLabel,
  componentNarrative,
  direction,
} from "@/lib/interpretations";
import type { BeneishVariableKey, ScoresResponse } from "@/lib/types";

const COMPONENT_ORDER: BeneishVariableKey[] = [
  "DSRI",
  "GMI",
  "AQI",
  "SGI",
  "DEPI",
  "SGAI",
  "TATA",
  "LVGI",
];

export function BeneishDashboard({
  data,
  onChangeSelection,
}: {
  data: ScoresResponse;
  onChangeSelection: () => void;
}) {
  const [component, setComponent] = useState<BeneishVariableKey>("DEPI");

  const trend = data.trend.filter((p) => p.mScore != null);
  const latest = trend[trend.length - 1];

  const series = useMemo(
    () =>
      trend.map((p) => ({
        fiscalYear: p.fiscalYear,
        mScore: p.mScore as number,
        component: p.beneishVariables?.[component] ?? null,
      })),
    [trend, component]
  );

  const latestComponentVal = series.length
    ? series[series.length - 1].component
    : null;
  const componentValues = series
    .map((p) => p.component)
    .filter((v): v is number => typeof v === "number");
  const componentDir = direction(componentValues);

  const meta = BENEISH_COMPONENTS[component];

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <Header
        companyName={data.company.name}
        ticker={data.company.ticker}
        sector={data.company.sector}
        onChangeSelection={onChangeSelection}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Left rail */}
        <aside className="space-y-4">
          <div className="rounded-3xl border border-line bg-surface p-5 shadow-card">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              Company
            </p>
            <p className="mt-1.5 text-lg font-semibold leading-tight text-ink">
              {data.company.name}
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">
              {data.company.ticker} · {data.company.sector}
            </p>
            <p className="mt-3 text-[11px] text-ink-subtle">
              {data.availableYears.length}{" "}
              {data.availableYears.length === 1 ? "year" : "years"} available
            </p>
          </div>

          <div className="rounded-3xl border border-line bg-surface p-5 shadow-card">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              Beneish components
            </p>
            <ul className="mt-3 space-y-1.5">
              {COMPONENT_ORDER.map((c) => {
                const active = c === component;
                return (
                  <li key={c}>
                    <button
                      type="button"
                      onClick={() => setComponent(c)}
                      className={`flex w-full items-baseline justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                        active
                          ? "bg-ink text-white"
                          : "text-ink-muted hover:bg-paper hover:text-ink"
                      }`}
                    >
                      <span className="font-medium">{c}</span>
                      <span
                        className={`text-[10px] ${
                          active ? "text-white/70" : "text-ink-subtle"
                        }`}
                      >
                        {BENEISH_COMPONENTS[c].fullName.split(" ").slice(-2).join(" ")}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        {/* Main */}
        <section className="space-y-6">
          {/* Hero strip — 4 cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <HeroCard
              label="Latest Beneish M-Score"
              value={latest ? (latest.mScore as number).toFixed(2) : "—"}
              sub={latest ? `FY ${latest.fiscalYear}` : ""}
              accent="from-blue-200 via-sky-50 to-[#d8def3]"
            />
            <HeroCard
              label="Manipulation risk"
              value={
                latest
                  ? (latest.mScore as number) > BENEISH_CUTOFF
                    ? "High"
                    : "Low"
                  : "—"
              }
              sub={
                latest
                  ? beneishRiskLabel(
                      (latest.mScore as number) > BENEISH_CUTOFF ? "high" : "low"
                    )
                  : ""
              }
              accent={
                latest && (latest.mScore as number) > BENEISH_CUTOFF
                  ? "from-rose-200 via-rose-50 to-[#d8def3]"
                  : "from-emerald-200 via-emerald-50 to-[#d8def3]"
              }
            />
            <HeroCard
              label={`Selected · ${component}`}
              value={
                latestComponentVal != null ? latestComponentVal.toFixed(3) : "—"
              }
              sub={meta.fullName}
              accent="from-cyan-200 via-cyan-50 to-[#d8def3]"
            />
            <HeroCard
              label={`${component} trend`}
              value={
                componentDir === "rising"
                  ? "↑ Rising"
                  : componentDir === "falling"
                    ? "↓ Falling"
                    : "→ Stable"
              }
              sub={`across ${componentValues.length} ${componentValues.length === 1 ? "year" : "years"}`}
              accent={
                componentDir === "rising"
                  ? "from-amber-200 via-amber-50 to-[#d8def3]"
                  : componentDir === "falling"
                    ? "from-emerald-200 via-emerald-50 to-[#d8def3]"
                    : "from-blue-200 via-blue-50 to-[#d8def3]"
              }
            />
          </div>

          {/* Year strip */}
          <div className="rounded-3xl border border-line bg-surface p-5 shadow-card">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              All available years
            </p>
            <div className="mt-4 overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase tracking-[0.12em] text-ink-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Fiscal year</th>
                    <th className="px-3 py-2 text-right font-semibold">M-Score</th>
                    <th className="px-3 py-2 text-right font-semibold">{component}</th>
                    <th className="px-3 py-2 text-left font-semibold">Risk</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {series.map((p) => {
                    const high = p.mScore > BENEISH_CUTOFF;
                    return (
                      <tr key={p.fiscalYear} className="border-t border-line">
                        <td className="px-3 py-2.5">FY {p.fiscalYear}</td>
                        <td className="px-3 py-2.5 text-right">{p.mScore.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right">
                          {p.component != null ? p.component.toFixed(3) : "—"}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-xs font-medium ${high ? "text-rose-700" : "text-emerald-700"}`}
                        >
                          {high ? "High" : "Low"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Combo trend */}
          <div className="rounded-3xl border border-line bg-surface p-6 shadow-card">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                Beneish M-Score &amp; {component} trend
              </p>
              <p className="text-[11px] text-ink-subtle">
                Cutoff −1.78 · {meta.fullName}
              </p>
            </div>
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={series}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid stroke="#bcc7e6" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="fiscalYear"
                    stroke="#7e85c4"
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="#1d4ed8"
                    fontSize={12}
                    tickLine={false}
                    width={40}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#6366f1"
                    fontSize={12}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #bcc7e6",
                      background: "#e6eafa",
                      color: "#1a205a",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine
                    yAxisId="left"
                    y={BENEISH_CUTOFF}
                    stroke="#dc2626"
                    strokeDasharray="4 4"
                    label={{
                      value: "Cutoff −1.78",
                      position: "insideTopRight",
                      fill: "#dc2626",
                      fontSize: 10,
                    }}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="mScore"
                    name="M-Score (left)"
                    stroke="#1d4ed8"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="component"
                    name={`${component} (right)`}
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Interpretation */}
          <div className="grid gap-4 md:grid-cols-2">
            <InsightCard title="Beneish M-Score" lines={beneishNarrative(data.trend)} />
            <InsightCard
              title={`${component} · ${meta.label}`}
              lines={componentNarrative(component, data.trend)}
            />
          </div>

          <BeneishDataQualityFooter data={data} />
        </section>
      </div>
    </main>
  );
}

function BeneishDataQualityFooter({ data }: { data: ScoresResponse }) {
  const dq = data.dataQuality;
  if (!dq) return null;
  const conf = dq.beneishConfidence;
  const lastUpdated = dq.lastUpdated
    ? new Date(dq.lastUpdated).toISOString().slice(0, 10)
    : "—";
  const confColor =
    conf === "High"
      ? "text-emerald-700"
      : conf === "Medium"
        ? "text-amber-700"
        : conf === "Low"
          ? "text-rose-700"
          : "text-ink-muted";
  return (
    <p className="text-[11px] text-ink-subtle">
      Source: <span className="font-medium text-ink-muted">{dq.snapshotSource}</span>
      {" · "}Last updated: <span className="font-medium text-ink-muted">{lastUpdated}</span>
      {" · "}Data confidence:{" "}
      <span className={`font-medium ${confColor}`}>{conf}</span>
    </p>
  );
}

function Header({
  companyName,
  ticker,
  sector,
  onChangeSelection,
}: {
  companyName: string;
  ticker: string;
  sector: string;
  onChangeSelection: () => void;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
          {sector}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">
          {companyName}
        </h1>
        <p className="mt-0.5 text-sm text-ink-muted">{ticker} · Beneish M-Score</p>
      </div>
      <button
        type="button"
        onClick={onChangeSelection}
        className="rounded-lg border border-line bg-surface-soft px-3.5 py-1.5 text-xs font-medium text-ink-muted transition hover:text-ink"
      >
        ← Change selection
      </button>
    </header>
  );
}

function HeroCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-surface p-5 shadow-card">
      <div
        className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br ${accent} opacity-70`}
      />
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight tabular text-ink">
        {value}
      </p>
      <p className="mt-1.5 text-xs leading-snug text-ink-muted">{sub}</p>
    </div>
  );
}

function InsightCard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-3xl border border-line bg-surface p-6 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        {title}
      </p>
      <ul className="mt-4 space-y-3">
        {lines.map((l, i) => (
          <li
            key={i}
            className="rounded-xl bg-paper/40 px-4 py-3 text-sm leading-relaxed text-ink"
          >
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}
