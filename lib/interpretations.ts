import type {
  AltmanResult,
  BeneishResult,
  BeneishVariableKey,
  TrendPoint,
} from "@/lib/types";

// ----- Beneish component metadata ---------------------------------------

interface ComponentMeta {
  label: string;
  fullName: string;
  measures: string;
  risingSuggests: string;
}

export const BENEISH_COMPONENTS: Record<BeneishVariableKey, ComponentMeta> = {
  DSRI: {
    label: "DSRI",
    fullName: "Days Sales in Receivables Index",
    measures:
      "Change in days-sales-outstanding vs. the prior year — i.e. how much faster or slower customers are paying.",
    risingSuggests:
      "Receivables growing faster than sales, which can signal aggressive revenue recognition or extended credit terms.",
  },
  GMI: {
    label: "GMI",
    fullName: "Gross Margin Index",
    measures:
      "Prior-year gross margin divided by current-year gross margin.",
    risingSuggests:
      "Gross margin is deteriorating, which historically increases the temptation to manage reported earnings.",
  },
  AQI: {
    label: "AQI",
    fullName: "Asset Quality Index",
    measures:
      "Share of non-current, non-PP&E assets relative to total assets, compared year-over-year.",
    risingSuggests:
      "Growing share of soft assets (intangibles, other non-current) — sometimes a sign of expense capitalisation.",
  },
  SGI: {
    label: "SGI",
    fullName: "Sales Growth Index",
    measures: "Current-year sales divided by prior-year sales.",
    risingSuggests:
      "Strong top-line growth. Not bad on its own, but growth firms face stronger pressure to keep beating estimates.",
  },
  DEPI: {
    label: "DEPI",
    fullName: "Depreciation Index",
    measures:
      "Prior-year depreciation rate divided by current-year depreciation rate (rate = depreciation / (depreciation + PP&E)).",
    risingSuggests:
      "Depreciation rate is slowing, possibly through extended useful-life assumptions that boost reported profit.",
  },
  SGAI: {
    label: "SGAI",
    fullName: "SG&A Expense Index",
    measures: "SG&A-to-sales ratio this year vs. last year.",
    risingSuggests:
      "Overheads growing faster than revenue — a deterioration in operating efficiency.",
  },
  TATA: {
    label: "TATA",
    fullName: "Total Accruals to Total Assets",
    measures:
      "Difference between net income and operating cash flow, scaled by total assets.",
    risingSuggests:
      "Earnings increasingly driven by accruals rather than cash — historically a stronger manipulation signal.",
  },
  LVGI: {
    label: "LVGI",
    fullName: "Leverage Index",
    measures: "This year's debt-to-assets ratio divided by last year's.",
    risingSuggests:
      "Leverage is rising — which can create covenant-pressure incentives to manage earnings.",
  },
};

// ----- Direction helpers ------------------------------------------------

export type TrendDirection = "rising" | "falling" | "stable";

export function direction(values: number[]): TrendDirection {
  if (values.length < 2) return "stable";
  const first = values[0];
  const last = values[values.length - 1];
  if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0)
    return "stable";
  const pct = (last - first) / Math.abs(first);
  if (pct > 0.05) return "rising";
  if (pct < -0.05) return "falling";
  return "stable";
}

// ----- Altman interpretation -------------------------------------------

export function altmanZone(z: number): "distress" | "grey" | "safe" {
  if (z < 1.8) return "distress";
  if (z > 3.0) return "safe";
  return "grey";
}

export function altmanZoneLabel(z: AltmanResult["interpretation"]): string {
  if (z === "safe") return "Safe Zone";
  if (z === "grey") return "Grey Zone";
  return "Distress Zone";
}

export function altmanNarrative(trend: TrendPoint[]): string[] {
  const points = trend.filter((p) => p.zScore != null) as Array<
    TrendPoint & { zScore: number }
  >;
  if (points.length === 0) return [];
  const latest = points[points.length - 1];
  const earliest = points[0];
  const latestZone = altmanZone(latest.zScore);

  const lines: string[] = [];
  lines.push(
    `Latest reported FY ${latest.fiscalYear} prints at Z = ${latest.zScore.toFixed(
      2
    )}, placing the company in the ${
      latestZone === "safe"
        ? "safe zone (Z > 3.0)"
        : latestZone === "grey"
          ? "grey zone (1.8 ≤ Z ≤ 3.0)"
          : "distress zone (Z < 1.8)"
    }.`
  );

  if (points.length > 1) {
    const dir = direction(points.map((p) => p.zScore));
    const change = latest.zScore - earliest.zScore;
    lines.push(
      `Across the ${points.length}-year window the score has ${
        dir === "rising"
          ? "improved"
          : dir === "falling"
            ? "deteriorated"
            : "stayed broadly stable"
      } (FY ${earliest.fiscalYear} → FY ${latest.fiscalYear}: Δ ${
        change >= 0 ? "+" : ""
      }${change.toFixed(2)}).`
    );

    const zones = points.map((p) => altmanZone(p.zScore));
    const distinct = new Set(zones);
    if (distinct.size > 1) {
      lines.push(
        `Zone transitions across the period: ${zones
          .map(
            (z) =>
              z[0].toUpperCase() + z.slice(1) // e.g. "Safe"
          )
          .join(" → ")}.`
      );
    } else {
      lines.push(`Zone has remained ${[...distinct][0]} throughout.`);
    }
  }

  return lines;
}

// ----- Beneish interpretation -------------------------------------------

export function beneishRiskLabel(b: BeneishResult["interpretation"]): string {
  return b === "high" ? "High manipulation risk" : "Low manipulation risk";
}

export function beneishNarrative(trend: TrendPoint[]): string[] {
  const points = trend.filter((p) => p.mScore != null) as Array<
    TrendPoint & { mScore: number }
  >;
  if (points.length === 0) return [];
  const latest = points[points.length - 1];
  const earliest = points[0];
  const lines: string[] = [];

  lines.push(
    `Latest FY ${latest.fiscalYear} M-Score is ${latest.mScore.toFixed(
      2
    )} — ${
      latest.mScore > -1.78
        ? "above the −1.78 cutoff, in the high-manipulation-risk band."
        : "below the −1.78 cutoff, in the low-manipulation-risk band."
    }`
  );
  if (points.length > 1) {
    const dir = direction(points.map((p) => p.mScore));
    const change = latest.mScore - earliest.mScore;
    lines.push(
      `Over FY ${earliest.fiscalYear} → FY ${latest.fiscalYear} the M-Score has ${
        dir === "rising"
          ? "drifted upward toward the cutoff"
          : dir === "falling"
            ? "moved further into the low-risk band"
            : "been broadly stable"
      } (Δ ${change >= 0 ? "+" : ""}${change.toFixed(2)}).`
    );
  }
  return lines;
}

export function componentNarrative(
  component: BeneishVariableKey,
  trend: TrendPoint[]
): string[] {
  const meta = BENEISH_COMPONENTS[component];
  const points = trend
    .map((p) => ({ fy: p.fiscalYear, v: p.beneishVariables?.[component] }))
    .filter((p): p is { fy: string; v: number } => typeof p.v === "number");
  if (points.length === 0) return [];
  const latest = points[points.length - 1];
  const earliest = points[0];
  const lines: string[] = [];
  lines.push(`${meta.fullName}. ${meta.measures}`);
  lines.push(
    `FY ${latest.fy}: ${latest.v.toFixed(3)}.${
      points.length > 1
        ? ` FY ${earliest.fy} → FY ${latest.fy} change: ${
            latest.v >= earliest.v ? "+" : ""
          }${(latest.v - earliest.v).toFixed(3)} (${direction(
            points.map((p) => p.v)
          )}).`
        : ""
    }`
  );
  lines.push(`Rising values suggest: ${meta.risingSuggests}`);
  return lines;
}
