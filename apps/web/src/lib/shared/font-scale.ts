export const DEFAULT_SITE_FONT_SCALE_PERCENT = 100;
export const MIN_SITE_FONT_SCALE_PERCENT = 50;
export const MAX_SITE_FONT_SCALE_PERCENT = 200;

export function normalizeSiteFontScalePercent(value: unknown): number {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return DEFAULT_SITE_FONT_SCALE_PERCENT;
  }

  const roundedValue = Math.round(numericValue);

  return Math.min(
    MAX_SITE_FONT_SCALE_PERCENT,
    Math.max(MIN_SITE_FONT_SCALE_PERCENT, roundedValue),
  );
}

export function siteFontScalePercentToMultiplier(value: unknown): number {
  return normalizeSiteFontScalePercent(value) / 100;
}
