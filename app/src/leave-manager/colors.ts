export const CATEGORY_COLOR_PALETTE = [
  '#2563EB',
  '#DC2626',
  '#059669',
  '#7C3AED',
  '#D97706',
  '#DB2777',
  '#0891B2',
  '#EA580C',
  '#4F46E5',
  '#0D9488',
  '#BE123C',
  '#65A30D',
  '#9333EA',
  '#0369A1',
] as const;

function normalizeHex(color: string): string {
  return color.trim().toLowerCase();
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100;
  const l = lightness / 100;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    const value = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * value)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`.toUpperCase();
}

/** First palette color not used by the given colors. Cycles, then generates a distinct hex. */
export function pickUnusedCategoryColor(usedColors: string[]): string {
  const used = new Set(usedColors.map(normalizeHex));
  const free = CATEGORY_COLOR_PALETTE.find((color) => !used.has(normalizeHex(color)));
  if (free) return free;

  for (let i = 0; i < 360; i += 1) {
    const hex = hslToHex((i * 47) % 360, 72, 42);
    if (!used.has(normalizeHex(hex))) return hex;
  }

  return CATEGORY_COLOR_PALETTE[usedColors.length % CATEGORY_COLOR_PALETTE.length];
}

export function toColorInputValue(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : '#2563eb';
}
