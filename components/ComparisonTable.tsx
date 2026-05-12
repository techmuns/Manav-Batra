"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateAltman, calculateBeneish } from "@/lib/calculations";
import { fmt } from "@/lib/format";
import type { CompanyFinancials, CompanyMaster } from "@/lib/types";
import { StatusBadge, type Status } from "./StatusBadge";

interface Row {
  master: CompanyMaster;
  m: { display: string; status: Status; label: string };
  z: { display: string; status: Status; label: string };
}

function loadCached(ticker: string): CompanyFinancials | null {
  try {
    const raw = sessionStorage.getItem(`fin:${ticker}`);
    return raw ? (JSON.parse(raw) as CompanyFinancials) : null;
  } catch {
    return null;
  }
}

function buildRow(company: CompanyFinancials, fiscalYear: string): Row {
  const sorted = [...company.years].sort((a, b) =>
    a.fiscalYear.localeCompare(b.fiscalYear)
  );
  const idx = sorted.findIndex((y) => y.fiscalYear === fiscalYear);
  const current = idx >= 0 ? sorted[idx] : sorted[sorted.length - 1];
  const prior = idx > 0 ? sorted[idx - 1] : undefined;

  const b = calculateBeneish(current, prior);
  const a = calculateAltman(company.master, current);

  return {
    master: company.master,
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
  current,
  fiscalYear,
}: {
  current: CompanyFinancials;
  fiscalYear: string;
}) {
  // Pull whatever the user has already fetched into session storage.
  const [cached, setCached] = useState<CompanyFinancials[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const found: CompanyFinancials[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i);
      if (!k || !k.startsWith("fin:")) continue;
      const v = loadCached(k.slice(4));
      if (v && v.years.length > 0) found.push(v);
    }
    setCached(found);
  }, [current]);

  const rows = useMemo(() => {
    const all: CompanyFinancials[] = [
      current,
      ...cached.filter((c) => c.master.ticker !== current.master.ticker),
    ];
    return all.map((c) => buildRow(c, fiscalYear));
  }, [cached, current, fiscalYear]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-muted">
        Companies you&apos;ve already fetched this session, compared at FY {fiscalYear}.
      </p>
      <div className="overflow-hidden rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-paper text-[11px] uppercase tracking-[0.12em] text-ink-muted">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold">Company</th>
              <th className="px-4 py-2.5 text-right font-semibold">Beneish M-Score</th>
              <th className="px-4 py-2.5 text-left font-semibold">Manipulation Risk</th>
              <th className="px-4 py-2.5 text-right font-semibold">Altman Z-Score</th>
              <th className="px-4 py-2.5 text-left font-semibold">Distress Risk</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-muted">
                  No companies cached yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.master.ticker} className="border-t border-line">
                <td className="px-4 py-3">
                  <div className="font-medium">{r.master.companyName}</div>
                  <div className="text-[11px] text-ink-subtle">{r.master.sector}</div>
                </td>
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
