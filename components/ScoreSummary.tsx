import { fmt } from "@/lib/format";
import type {
  AltmanOutcome,
  BeneishOutcome,
  CompanyFinancials,
} from "@/lib/types";
import { StatusBadge, type Status } from "./StatusBadge";

function beneishStatus(o: BeneishOutcome): Status {
  if (o.status !== "ok") return "neutral";
  return o.interpretation === "high" ? "risk" : "safe";
}

function altmanStatus(o: AltmanOutcome): Status {
  if (o.status === "ok") {
    if (o.interpretation === "safe") return "safe";
    if (o.interpretation === "grey") return "watch";
    return "risk";
  }
  return "neutral";
}

function beneishLabel(o: BeneishOutcome): string {
  if (o.status !== "ok") return "Not Calculable";
  return o.interpretation === "high"
    ? "High manipulation risk"
    : "Low manipulation risk";
}

function altmanLabel(o: AltmanOutcome): string {
  if (o.status === "not_applicable") return o.reason;
  if (o.status === "not_calculable") return "Not Calculable";
  if (o.interpretation === "safe") return "Safe zone";
  if (o.interpretation === "grey") return "Grey zone";
  return "Distress zone";
}

export function ScoreSummary({
  company,
  year,
  beneish,
  altman,
}: {
  company: CompanyFinancials;
  year: number;
  beneish: BeneishOutcome;
  altman: AltmanOutcome;
}) {
  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {company.name}
          </h1>
          <p className="text-sm text-ink-muted">FY {year}</p>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <ScoreCard
          label="Beneish M-Score"
          value={beneish.status === "ok" ? fmt(beneish.mScore, 2) : "—"}
          status={beneishStatus(beneish)}
          statusLabel={beneishLabel(beneish)}
          hint={
            beneish.status === "ok"
              ? "Cutoff: −1.78"
              : beneish.status === "not_calculable"
                ? `${beneish.missing.length} variable(s) missing`
                : ""
          }
        />
        <ScoreCard
          label="Altman Z-Score"
          value={altman.status === "ok" ? fmt(altman.zScore, 2) : "—"}
          status={altmanStatus(altman)}
          statusLabel={altmanLabel(altman)}
          hint={
            altman.status === "ok"
              ? "Distress < 1.8 · Safe > 3.0"
              : altman.status === "not_calculable"
                ? `${altman.missing.length} variable(s) missing`
                : ""
          }
        />
      </div>
    </div>
  );
}

function ScoreCard({
  label,
  value,
  status,
  statusLabel,
  hint,
}: {
  label: string;
  value: string;
  status: Status;
  statusLabel: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          {label}
        </p>
        <StatusBadge status={status}>{statusLabel}</StatusBadge>
      </div>
      <p className="mt-3 text-4xl font-semibold tracking-tight tabular text-ink">
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}
