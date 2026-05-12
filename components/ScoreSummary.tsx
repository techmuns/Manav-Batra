import { fmt } from "@/lib/format";
import type {
  AltmanOutcome,
  BeneishOutcome,
  CompanyMaster,
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
  return o.interpretation === "high" ? "High manipulation risk" : "Low manipulation risk";
}
function altmanLabel(o: AltmanOutcome): string {
  if (o.status === "not_applicable") return o.reason;
  if (o.status === "not_calculable") return "Not Calculable";
  if (o.interpretation === "safe") return "Safe zone";
  if (o.interpretation === "grey") return "Grey zone";
  return "Distress zone";
}

export function ScoreSummary({
  master,
  fiscalYear,
  beneish,
  altman,
  onChangeCompany,
  onRecalculate,
}: {
  master: CompanyMaster;
  fiscalYear: string;
  beneish: BeneishOutcome;
  altman: AltmanOutcome;
  onChangeCompany: () => void;
  onRecalculate?: () => void;
}) {
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
            {master.sector}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">
            {master.companyName}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {master.ticker} · FY {fiscalYear}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onRecalculate && (
            <button
              type="button"
              onClick={onRecalculate}
              className="rounded-lg border border-line bg-white px-3.5 py-1.5 text-xs font-medium text-ink-muted transition hover:text-ink"
            >
              Recalculate
            </button>
          )}
          <button
            type="button"
            onClick={onChangeCompany}
            className="rounded-lg border border-line bg-white px-3.5 py-1.5 text-xs font-medium text-ink-muted transition hover:text-ink"
          >
            Change company
          </button>
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
              : `${beneish.missing.length} variable(s) missing`
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          {label}
        </p>
        <StatusBadge status={status}>{statusLabel}</StatusBadge>
      </div>
      <p className="mt-3 text-5xl font-semibold tracking-tight tabular text-ink">
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}
