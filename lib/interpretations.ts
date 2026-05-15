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
  risingMeans: string;
  fallingMeans: string;
  stableMeans: string;
}

export const BENEISH_COMPONENTS: Record<BeneishVariableKey, ComponentMeta> = {
  DSRI: {
    label: "DSRI",
    fullName: "Days Sales in Receivables Index",
    measures:
      "Change in days-sales-outstanding vs. the prior year — i.e. how much faster or slower customers are paying.",
    risingMeans:
      "Receivables are growing faster than sales. That can signal aggressive revenue recognition (booking sales earlier than cash arrives) or looser credit terms — both are watch-outs for earnings quality.",
    fallingMeans:
      "Receivables are growing more slowly than sales, or even shrinking. Cash is being collected faster — typically a clean, healthy sign.",
    stableMeans:
      "Collection profile is steady year over year — no red flag and no improvement.",
  },
  GMI: {
    label: "GMI",
    fullName: "Gross Margin Index",
    measures: "Prior-year gross margin divided by current-year gross margin.",
    risingMeans:
      "Gross margin is deteriorating. Companies under margin pressure are statistically more likely to lean on earnings-management to defend headline profitability.",
    fallingMeans:
      "Gross margin is expanding. Operating leverage is improving — a positive on earnings quality, not a negative.",
    stableMeans:
      "Gross margin is holding flat — no incremental manipulation incentive from this driver.",
  },
  AQI: {
    label: "AQI",
    fullName: "Asset Quality Index",
    measures:
      "Share of non-current, non-PP&E assets relative to total assets, compared year-over-year.",
    risingMeans:
      "A larger slice of the balance sheet is in soft assets (intangibles, other non-current). Sometimes innocuous; sometimes a sign that operating expenses are being capitalised to flatter income.",
    fallingMeans:
      "Asset base is hardening — proportionally more tangible / current assets. Generally cleaner.",
    stableMeans: "Asset mix is unchanged — neutral for the model.",
  },
  SGI: {
    label: "SGI",
    fullName: "Sales Growth Index",
    measures: "Current-year sales divided by prior-year sales.",
    risingMeans:
      "Sales growth is accelerating. Growth itself isn't manipulation, but high-growth firms historically face stronger pressure to keep beating estimates, so the M-Score weights this positively.",
    fallingMeans:
      "Growth is decelerating. Less external pressure to hit headline numbers — and arguably a more conservative top line.",
    stableMeans: "Growth pace is steady.",
  },
  DEPI: {
    label: "DEPI",
    fullName: "Depreciation Index",
    measures:
      "Prior-year depreciation rate divided by current-year depreciation rate (rate = depreciation / (depreciation + PP&E)).",
    risingMeans:
      "Depreciation rate is slowing. That can quietly boost reported profit if it reflects extended useful-life assumptions rather than genuine asset-life economics.",
    fallingMeans:
      "Depreciation rate is keeping up with — or accelerating relative to — PP&E. No life-extension benefit hitting profit; clean signal.",
    stableMeans:
      "Depreciation behaviour is unchanged year over year — neutral.",
  },
  SGAI: {
    label: "SGAI",
    fullName: "SG&A Expense Index",
    measures: "SG&A-to-sales ratio this year vs. last year.",
    risingMeans:
      "Overheads are growing faster than revenue — operating efficiency is slipping. Margin pressure can become a precursor to earnings management.",
    fallingMeans:
      "SG&A is growing more slowly than sales. Operating leverage is improving.",
    stableMeans: "Cost discipline is holding steady relative to growth.",
  },
  TATA: {
    label: "TATA",
    fullName: "Total Accruals to Total Assets",
    measures:
      "Difference between net income and operating cash flow, scaled by total assets.",
    risingMeans:
      "Earnings increasingly driven by accruals rather than cash. Historically the strongest single signal in the M-Score — non-cash-backed profits warrant scrutiny.",
    fallingMeans:
      "Earnings are increasingly cash-backed. Reported profit and operating cash flow are converging — high-quality earnings.",
    stableMeans:
      "Accrual intensity is unchanged — neutral, and reflects consistent earnings quality.",
  },
  LVGI: {
    label: "LVGI",
    fullName: "Leverage Index",
    measures: "This year's debt-to-assets ratio divided by last year's.",
    risingMeans:
      "Leverage is climbing. Higher debt loads create covenant-pressure incentives to manage earnings, which is why the M-Score watches this.",
    fallingMeans:
      "Balance sheet is de-leveraging — covenant pressure easing. A structural positive.",
    stableMeans: "Capital structure is unchanged.",
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

  // 1. Where we are.
  lines.push(
    `Latest FY ${latest.fiscalYear}: Z = ${latest.zScore.toFixed(
      2
    )} — ${
      latestZone === "safe"
        ? "comfortably in the safe zone (Z > 3.0). The model assigns a low near-term bankruptcy probability."
        : latestZone === "grey"
          ? "in the grey zone (1.8 ≤ Z ≤ 3.0). The model gives no clear distress verdict — close monitoring is warranted."
          : "in the distress zone (Z < 1.8). The model is signalling elevated near-term bankruptcy risk on these inputs."
    }`
  );

  // 2. What the trend means.
  if (points.length > 1) {
    const dir = direction(points.map((p) => p.zScore));
    const change = latest.zScore - earliest.zScore;
    const dirCopy =
      dir === "rising"
        ? "improving — working capital, retained earnings, profitability or market value are strengthening relative to the asset base. The company is moving away from distress."
        : dir === "falling"
          ? "deteriorating — at least one of working capital, retained earnings, EBIT, market value or sales-efficiency is weakening relative to assets. Direction of travel is toward distress."
          : "broadly stable. Strength of the balance sheet relative to its drivers is roughly unchanged.";
    lines.push(
      `FY ${earliest.fiscalYear} → FY ${latest.fiscalYear} (Δ ${
        change >= 0 ? "+" : ""
      }${change.toFixed(2)}): the score is ${dirCopy}`
    );

    // 3. Zone transitions.
    const zones = points.map((p) => altmanZone(p.zScore));
    const distinct = new Set(zones);
    if (distinct.size > 1) {
      lines.push(
        `Zone history across the window: ${zones
          .map((z) => z[0].toUpperCase() + z.slice(1))
          .join(" → ")}.`
      );
    } else {
      lines.push(
        `The company has stayed in the ${[...distinct][0]} zone throughout the period — directionally consistent.`
      );
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

  // 1. Where we are.
  lines.push(
    `Latest FY ${latest.fiscalYear}: M = ${latest.mScore.toFixed(2)} — ${
      latest.mScore > -1.78
        ? "above the −1.78 cutoff, which the model treats as elevated earnings-manipulation risk. Worth investigating which components are pushing the score up."
        : "below the −1.78 cutoff, in the low-risk band. On these inputs the model does not flag the company as a likely manipulator."
    }`
  );

  // 2. What the trend means.
  if (points.length > 1) {
    const dir = direction(points.map((p) => p.mScore));
    const change = latest.mScore - earliest.mScore;
    const dirCopy =
      dir === "rising"
        ? "drifting upward, i.e. toward the −1.78 cutoff. Earnings quality is deteriorating on this composite even if the score is still in the safe band."
        : dir === "falling"
          ? "moving further away from the −1.78 cutoff into safer territory. The eight underlying signals are collectively cleaner than they were."
          : "essentially flat. Earnings-quality signals have been consistent through the period.";
    lines.push(
      `FY ${earliest.fiscalYear} → FY ${latest.fiscalYear} (Δ ${
        change >= 0 ? "+" : ""
      }${change.toFixed(2)}): the M-Score is ${dirCopy}`
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
  const dir = direction(points.map((p) => p.v));

  const lines: string[] = [];

  // 1. What it is.
  lines.push(`${meta.fullName}. ${meta.measures}`);

  // 2. This company's reading + direction.
  lines.push(
    `FY ${latest.fy}: ${latest.v.toFixed(3)}.${
      points.length > 1
        ? ` FY ${earliest.fy} → FY ${latest.fy} change: ${
            latest.v >= earliest.v ? "+" : ""
          }${(latest.v - earliest.v).toFixed(3)} (${dir}).`
        : ""
    }`
  );

  // 3. What that direction means for THIS company.
  const interpretation =
    dir === "rising"
      ? meta.risingMeans
      : dir === "falling"
        ? meta.fallingMeans
        : meta.stableMeans;
  lines.push(`What this means: ${interpretation}`);

  return lines;
}
