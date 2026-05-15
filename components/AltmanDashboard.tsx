"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ALTMAN_DISTRESS, ALTMAN_SAFE } from "@/lib/calculations";
import { altmanNarrative, altmanZone } from "@/lib/interpretations";
import type { ScoresResponse } from "@/lib/types";

export function AltmanDashboard({
  data,
  onChangeSelection,
}: {
  data: ScoresResponse;
  onChangeSelection: () => void;
}) {
  const series = data.trend.filter((p) => p.zScore != null) as Array<{
    fiscalYear: string;
    zScore: number;
  }>;
  const latest = series[series.length - 1];
  const earliest = series[0];
  const best = series.reduce((a, b) => (a.zScore > b.zScore ? a : b), series[0]);
  const worst = series.reduce((a, b) => (a.zScore < b.zScore ? a : b), series[0]);
  const avg = series.reduce((s, p) => s + p.zScore, 0) / (series.length || 1);
  const prevYoY =
    series.length >= 2 ? latest.zScore - series[series.length - 2].zScore : null;
  const latestZone = latest ? altmanZone(latest.zScore) : null;
  const narrative = altmanNarrative(data.trend);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <Header
        companyName={data.company.name}
        ticker={data.company.ticker}
        sector={data.company.sector}
        scoreLabel="Altman Z-Score"
        onChangeSelection={onChangeSelection}
      />

      {/* Hero strip */}
      <div className="grid gap-4 md:grid-cols-3">
        <HeroNumber
          label="Latest Altman Z-Score"
          value={latest ? latest.zScore.toFixed(2) : "—"}
          sub={latest ? `FY ${latest.fiscalYear}` : ""}
          accent={
            latestZone === "safe"
              ? "from-emerald-200 via-emerald-50 to-[#e7eefa]"
              : latestZone === "grey"
                ? "from-amber-200 via-amber-50 to-[#e7eefa]"
                : "from-rose-200 via-rose-50 to-[#e7eefa]"
          }
        />
        <HeroStatus zone={latestZone} />
        <HeroMeta
          rows={[
            { label: "Years available", value: String(series.length) },
            { label: "Latest fiscal year", value: latest ? `FY ${latest.fiscalYear}` : "—" },
            { label: "YoY change", value: prevYoY === null ? "—" : `${prevYoY >= 0 ? "+" : ""}${prevYoY.toFixed(2)}` },
          ]}
        />
      </div>

      {/* Year strip */}
      <section className="rounded-3xl border border-line bg-surface p-6 shadow-card">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
          All available years
        </p>
        <div className="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {series.map((p) => {
            const z = altmanZone(p.zScore);
            return (
              <div
                key={p.fiscalYear}
                className="rounded-2xl border border-line bg-paper/40 p-4"
              >
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-subtle">
                  FY {p.fiscalYear}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular text-ink">
                  {p.zScore.toFixed(2)}
                </p>
                <p
                  className={`mt-1 text-[11px] font-medium ${
                    z === "safe"
                      ? "text-emerald-700"
                      : z === "grey"
                        ? "text-amber-700"
                        : "text-rose-700"
                  }`}
                >
                  {z === "safe" ? "Safe" : z === "grey" ? "Grey" : "Distress"} zone
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Trend */}
      <section className="rounded-3xl border border-line bg-surface p-6 shadow-card">
        <div className="flex items-baseline justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            Z-Score trend
          </p>
          <p className="text-[11px] text-ink-subtle">
            Distress &lt; 1.8 · Safe &gt; 3.0
          </p>
        </div>
        <div className="mt-4 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="fiscalYear" stroke="#94a3b8" fontSize={12} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} width={40} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <ReferenceLine
                y={ALTMAN_DISTRESS}
                stroke="#dc2626"
                strokeDasharray="4 4"
                label={{ value: "Distress 1.8", position: "insideTopRight", fill: "#dc2626", fontSize: 10 }}
              />
              <ReferenceLine
                y={ALTMAN_SAFE}
                stroke="#16a34a"
                strokeDasharray="4 4"
                label={{ value: "Safe 3.0", position: "insideTopRight", fill: "#16a34a", fontSize: 10 }}
              />
              <Line
                type="monotone"
                dataKey="zScore"
                stroke="#1d4ed8"
                strokeWidth={2.5}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Interpretation + comparison strip */}
      <section className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <div className="rounded-3xl border border-line bg-surface p-6 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            Interpretation
          </p>
          <ul className="mt-4 space-y-3">
            {narrative.map((line, i) => (
              <li
                key={i}
                className="rounded-xl bg-paper/40 px-4 py-3 text-sm leading-relaxed text-ink"
              >
                {line}
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3 rounded-3xl border border-line bg-surface p-6 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            At a glance
          </p>
          <Row label="Best year" value={`FY ${best.fiscalYear} · ${best.zScore.toFixed(2)}`} />
          <Row label="Worst year" value={`FY ${worst.fiscalYear} · ${worst.zScore.toFixed(2)}`} />
          <Row label="Average" value={avg.toFixed(2)} />
          <Row
            label="Earliest year"
            value={`FY ${earliest.fiscalYear} · ${earliest.zScore.toFixed(2)}`}
          />
        </div>
      </section>
    </main>
  );
}

function Header({
  companyName,
  ticker,
  sector,
  scoreLabel,
  onChangeSelection,
}: {
  companyName: string;
  ticker: string;
  sector: string;
  scoreLabel: string;
  onChangeSelection: () => void;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
          {sector}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">{companyName}</h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          {ticker} · {scoreLabel}
        </p>
      </div>
      <button
        type="button"
        onClick={onChangeSelection}
        className="rounded-lg border border-line bg-white px-3.5 py-1.5 text-xs font-medium text-ink-muted transition hover:text-ink"
      >
        ← Change selection
      </button>
    </header>
  );
}

function HeroNumber({
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
    <div className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-card">
      <div className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br ${accent} opacity-70`} />
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        {label}
      </p>
      <p className="mt-2 text-5xl font-semibold tracking-tight tabular text-ink">{value}</p>
      <p className="mt-2 text-xs text-ink-muted">{sub}</p>
    </div>
  );
}

function HeroStatus({ zone }: { zone: "safe" | "grey" | "distress" | null }) {
  const cfg = zone === "safe"
    ? { title: "Safe Zone", body: "Z above 3.0 — bankruptcy risk is low on this model.", accent: "from-emerald-200 via-emerald-50 to-[#e7eefa]", color: "text-emerald-700" }
    : zone === "grey"
      ? { title: "Grey Zone", body: "Z between 1.8 and 3.0 — model gives no clear verdict.", accent: "from-amber-200 via-amber-50 to-[#e7eefa]", color: "text-amber-700" }
      : zone === "distress"
        ? { title: "Distress Zone", body: "Z below 1.8 — model flags elevated bankruptcy risk.", accent: "from-rose-200 via-rose-50 to-[#e7eefa]", color: "text-rose-700" }
        : { title: "—", body: "No data", accent: "from-slate-200 via-slate-50 to-[#e7eefa]", color: "text-ink-muted" };
  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-card">
      <div className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br ${cfg.accent} opacity-70`} />
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        Latest status
      </p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${cfg.color}`}>{cfg.title}</p>
      <p className="mt-2 text-xs leading-relaxed text-ink-muted">{cfg.body}</p>
    </div>
  );
}

function HeroMeta({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <div className="rounded-3xl border border-line bg-surface p-6 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">Context</p>
      <ul className="mt-3 space-y-2.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between text-sm">
            <span className="text-ink-muted">{r.label}</span>
            <span className="font-medium text-ink tabular">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className="font-medium text-ink tabular">{value}</span>
    </div>
  );
}
