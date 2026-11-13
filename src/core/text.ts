// Polish number formatting and plurals for UI templates.

/** Decimal comma, at most `digits` decimals. */
export const num = (v: number, digits = 1): string => (Math.round(v * 10 ** digits) / 10 ** digits).toString().replace('.', ',');

/**
 * Polish has three plural forms: 1 skrzynka, 2–4 skrzynki, 5+ skrzynek (and 12–14 take the last one).
 * Templates write them as `{skrzynka|skrzynki|skrzynek}`.
 */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(Math.round(n));
  if (abs === 1) return one;
  const last = abs % 10;
  const tens = abs % 100;
  return last >= 2 && last <= 4 && (tens < 12 || tens > 14) ? few : many;
}

const FORMS = /\{([^{}|]+)\|([^{}|]+)\|([^{}|]+)\}/g;

/** Fills `{v}` with `text` and picks the right plural form for `count` in every `{a|b|c}` group. */
export function fillCount(template: string, text: string, count: number): string {
  return template.replace('{v}', text).replace(FORMS, (_m, one: string, few: string, many: string) => plural(count, one, few, many));
}
