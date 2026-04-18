import type { TFunction } from "i18next";

/**
 * Carely vital categories carry two display concerns:
 *
 * 1. `displayName` — free-form text the admin can edit in Settings. For the
 *    built-in defaults (BLOOD_PRESSURE, HEART_RATE, …) this is English
 *    boilerplate ("Blood Pressure") seeded from `DEFAULT_CARELY_VITAL_CATEGORIES`
 *    and never touched once the DB migration runs. So a naive `{c.displayName}`
 *    render shows English even when the UI is Bengali.
 *
 * 2. `kind` — enum-ish string ("numeric" | "blood_pressure") shown as subtitle
 *    metadata on the settings list.
 *
 * These helpers translate both via the `carely:vitals.*` subtree, falling back
 * to the raw DB value so admin-authored custom categories and any future kinds
 * still render something sensible.
 */

export type VitalCategoryLike = {
  key?: string | null;
  displayName?: string | null;
};

/**
 * Translate a vital category's display name by its stable `key`, falling back
 * to the DB `displayName` (which may be admin-customized).
 *
 * Caller must have a `t` bound to the `carely` namespace (i.e.
 * `useTranslation("carely")`).
 */
export function vitalDisplayName(
  t: TFunction,
  category: VitalCategoryLike | null | undefined,
): string {
  if (!category) return "";
  const fallback = category.displayName ?? category.key ?? "";
  if (!category.key) return fallback;
  return t(`vitals.names.${category.key}`, { defaultValue: fallback });
}

/**
 * Translate a vital category's `kind` enum, falling back to the raw value so
 * unknown future kinds still render.
 */
export function vitalKindLabel(
  t: TFunction,
  kind: string | null | undefined,
): string {
  if (!kind) return "";
  return t(`vitals.kinds.${kind}`, { defaultValue: kind });
}
