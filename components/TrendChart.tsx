"use client";

import { useState } from "react";
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
import { ALTMAN_DISTRESS, ALTMAN_SAFE, BENEISH_CUTOFF } from "@/lib/calculations";
import type { TrendPoint } from "@/lib/types";

type Window = 5 | 10;

export function TrendChart({
  trend,
  isFinancial,
}: {
  trend: TrendPoint[];
  isFinancial: boolean;
}) {
  const [win, setWin] = useState<Window>(10);
  // Eligibility rule: only plot fiscal years that produced BOTH a Beneish
  // M-Score and an Altman Z-Score.  Missing-input years are dropped, not
  // shown as fake points.
  const eligible = trend.filter((d) => d.mScore != null && d.zScore != null);
  const data = eligible.slice(-win);
  const hasAnyM = data.length > 0;
  const hasAnyZ = data.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end gap-2">
        {[5, 10].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setWin(n as Window)}
            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
              win === n
                ? "bg-ink text-white ring-ink"
                : "bg-white text-ink-muted ring-line hover:text-ink"
            }`}
          >
            {n}Y
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartBlock
          title="Beneish M-Score"
          data={data}
          dataKey="mScore"
          domain={[-6, 1]}
          refs={[{ y: BENEISH_CUTOFF, label: "Cutoff −1.78", color: "#dc2626" }]}
          empty={hasAnyM ? undefined : "No years had complete inputs for M-Score"}
        />
        <ChartBlock
          title="Altman Z-Score"
          data={data}
          dataKey="zScore"
          domain={[0, 8]}
          refs={[
            { y: ALTMAN_DISTRESS, label: "Distress 1.8", color: "#dc2626" },
            { y: ALTMAN_SAFE, label: "Safe 3.0", color: "#16a34a" },
          ]}
          empty={
            isFinancial
              ? "Not applicable for financial companies"
              : hasAnyZ
                ? undefined
                : "No years had complete inputs for Z-Score"
          }
        />
      </div>
    </div>
  );
}

function ChartBlock({
  title,
  data,
  dataKey,
  domain,
  refs,
  empty,
}: {
  title: string;
  data: TrendPoint[];
  dataKey: "mScore" | "zScore";
  domain: [number, number];
  refs: Array<{ y: number; label: string; color: string }>;
  empty?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        {title}
      </p>
      <div className="mt-3 h-60">
        {empty ? (
          <div className="flex h-full items-center justify-center text-sm text-ink-muted">
            {empty}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="fiscalYear" stroke="#94a3b8" fontSize={12} tickLine={false} />
              <YAxis domain={domain} stroke="#94a3b8" fontSize={12} tickLine={false} width={40} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
              {refs.map((r) => (
                <ReferenceLine
                  key={r.label}
                  y={r.y}
                  stroke={r.color}
                  strokeDasharray="4 4"
                  label={{
                    value: r.label,
                    position: "insideTopRight",
                    fill: r.color,
                    fontSize: 10,
                  }}
                />
              ))}
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke="#0f172a"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
