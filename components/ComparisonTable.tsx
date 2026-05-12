"use client";

import { useMemo, useState } from "react";
import { calculateAltman, calculateBeneish } from "@/lib/calculations";
import { fmt } from "@/lib/format";
import type { CompanyFinancials } from "@/lib/types";
import { StatusBadge, type Status } from "./StatusBadge";

interface Row {
  ticker: string;
  name: string;
  m: { display: string; status: Status; label: string };
  z: { display: string; status: Status; label: string };
}

function buildRow(company: CompanyFinancials, year: number): Row {
  const sorted = [...company.years].sort((a, b) => a.year - b.year);
  const idx = sorted.findIndex((y) => y.year === year);
  const current = idx >= 0 ? sorted[idx] : sorted[sorted.length - 1];
  const prior = idx > 0 ? sorted[idx - 1] : undefined;

  const b = calculateBeneish(current, prior);
  const a = calculateAltman(company, current);

  return {
    ticker: company.ticker,
    name: company.name,
    m:
      b.status === "ok"
        ? {
            display: fmt(b.mScore, 2),
            status: b.interpretation === "high" ? "risk" : "safe",
            label: b.interpretation === "high" ? "High" : "Low",
          }
        : { display: "—", status: "neutral", label: "Not Calculable" },
    z:
      a.status === "ok"
        ? {
            display: fmt(a.zScore, 2),
            status:
              a.interpretation === "safe"
                ? "safe"
                : a.interpretation === "grey"
                  ? "watch"
                  : "risk",
            label:
              a.interpretation === "safe"
                ? "Safe"
                : a.interpretation === "grey"
                  ? "Grey"
                  : "Distress",
          }
        : a.status === "not_applicable"
          ? { display: "—", status: "neutral", label: "Not Comparable" }
          : { display: "—", status: "neutral", label: "Not Calculable" },
  };
}

export function ComparisonTable({
  companies,
  year,
}: {
  companies: CompanyFinancials[];
  year: number;
}) {
  const [selected, setSelected] = useState<string[]>(() =>
    companies.slice(0, Math.min(3, companies.length)).map((c) => c.ticker)
  );

  const rows = useMemo(
    () =>
      companies
        .filter((c) => selected.includes(c.ticker))
        .map((c) => buildRow(c, year)),
    [companies, selected, year]
  );

  function toggle(ticker: string) {
    setSelected((prev) =>
      prev.includes(ticker) ? prev.filter((t) => t !== ticker) : [...prev, ticker]
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {companies.map((c) => {
          const active = selected.includes(c.ticker);
          return (
            <button
              key={c.ticker}
              type="button"
              onClick={() => toggle(c.ticker)}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
                active
                  ? "bg-ink text-white ring-ink"
                  : "bg-white text-ink-muted ring-line hover:text-ink"
              }`}
            >
              {c.name}
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-paper text-xs uppercase tracking-wider text-ink-muted">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold">Company</th>
              <th className="px-4 py-2.5 text-right font-semibold">
                Beneish M-Score
              </th>
              <th className="px-4 py-2.5 text-left font-semibold">
                Manipulation Risk
              </th>
              <th className="px-4 py-2.5 text-right font-semibold">
                Altman Z-Score
              </th>
              <th className="px-4 py-2.5 text-left font-semibold">
                Distress Risk
              </th>
            </tr>
          </thead>
          <tbody className="tabular">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-muted">
                  Select companies to compare.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.ticker} className="border-t border-line">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3 text-right">{r.m.display}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.m.status}>{r.m.label}</StatusBadge>
                </td>
                <td className="px-4 py-3 text-right">{r.z.display}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.z.status}>{r.z.label}</StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
