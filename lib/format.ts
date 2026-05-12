export function fmt(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function signed(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return "—";
  const s = fmt(value, digits);
  return value >= 0 ? `+${s}` : s;
}
