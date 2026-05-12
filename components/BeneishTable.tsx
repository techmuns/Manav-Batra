import { fmt, signed } from "@/lib/format";
import type { BeneishOutcome } from "@/lib/types";
import { MissingDataWarning } from "./MissingDataWarning";

const FORMULA =
  "M = -4.84 + 0.92·DSRI + 0.528·GMI + 0.404·AQI + 0.892·SGI + 0.115·DEPI − 0.172·SGAI + 4.679·TATA − 0.327·LVGI";

export function BeneishTable({ outcome }: { outcome: BeneishOutcome }) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-paper px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Formula
        </p>
        <p className="mt-1 font-mono text-sm leading-relaxed text-ink">
          {FORMULA}
        </p>
      </div>

      {outcome.status === "not_calculable" ? (
        <MissingDataWarning missing={outcome.missing} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-paper text-xs uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Variable</th>
                <th className="px-4 py-2.5 text-right font-semibold">Value</th>
                <th className="px-4 py-2.5 text-right font-semibold">Weight</th>
                <th className="px-4 py-2.5 text-right font-semibold">Contribution</th>
              </tr>
            </thead>
            <tbody className="tabular">
              <tr className="border-t border-line">
                <td className="px-4 py-2.5 text-ink-muted">Constant</td>
                <td className="px-4 py-2.5 text-right text-ink-muted">—</td>
                <td className="px-4 py-2.5 text-right text-ink-muted">—</td>
                <td className="px-4 py-2.5 text-right">{signed(outcome.constant, 2)}</td>
              </tr>
              {outcome.variables.map((v) => (
                <tr key={v.key} className="border-t border-line">
                  <td className="px-4 py-2.5 font-medium">{v.key}</td>
                  <td className="px-4 py-2.5 text-right">{fmt(v.value, 3)}</td>
                  <td className="px-4 py-2.5 text-right">{v.weight}</td>
                  <td className="px-4 py-2.5 text-right">{signed(v.contribution, 3)}</td>
                </tr>
              ))}
              <tr className="border-t border-line bg-paper">
                <td className="px-4 py-3 font-semibold">M-Score</td>
                <td className="px-4 py-3 text-right text-ink-muted">—</td>
                <td className="px-4 py-3 text-right text-ink-muted">—</td>
                <td className="px-4 py-3 text-right font-semibold">
                  {fmt(outcome.mScore, 2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
