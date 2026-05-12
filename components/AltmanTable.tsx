import { fmt, signed } from "@/lib/format";
import type { AltmanOutcome } from "@/lib/types";
import { MissingDataWarning } from "./MissingDataWarning";

const FORMULA = "Z = 1.2·X1 + 1.4·X2 + 3.3·X3 + 0.6·X4 + 1.0·X5";

export function AltmanTable({ outcome }: { outcome: AltmanOutcome }) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-paper px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          Formula
        </p>
        <p className="mt-1 font-mono text-sm leading-relaxed text-ink">{FORMULA}</p>
      </div>

      {outcome.status === "not_comparable" ? (
        <div className="rounded-xl border border-line bg-slate-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            Not Applicable
          </p>
          <p className="mt-1 text-sm text-ink">{outcome.reason}</p>
          <p className="mt-1 text-xs text-ink-muted">
            Altman Z-Score is not designed for banks, NBFCs, insurers or other
            financial-sector balance sheets.
          </p>
        </div>
      ) : outcome.status === "not_calculable" ? (
        <MissingDataWarning missing={outcome.missingVariables} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-paper text-[11px] uppercase tracking-[0.12em] text-ink-muted">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Variable</th>
                <th className="px-4 py-2.5 text-left font-semibold">Formula</th>
                <th className="px-4 py-2.5 text-right font-semibold">Value</th>
                <th className="px-4 py-2.5 text-right font-semibold">Weight</th>
                <th className="px-4 py-2.5 text-right font-semibold">Contribution</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {outcome.variables.map((v) => (
                <tr key={v.key} className="border-t border-line">
                  <td className="px-4 py-2.5 font-medium">{v.key}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{v.formula}</td>
                  <td className="px-4 py-2.5 text-right">{fmt(v.value, 3)}</td>
                  <td className="px-4 py-2.5 text-right">{v.weight}</td>
                  <td className="px-4 py-2.5 text-right">{signed(v.contribution, 3)}</td>
                </tr>
              ))}
              <tr className="border-t border-line bg-paper">
                <td className="px-4 py-3 font-semibold">Z-Score</td>
                <td className="px-4 py-3 text-ink-muted">—</td>
                <td className="px-4 py-3 text-right text-ink-muted">—</td>
                <td className="px-4 py-3 text-right text-ink-muted">—</td>
                <td className="px-4 py-3 text-right font-semibold">{fmt(outcome.zScore, 2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
