/**
 * Parse relative date range (e.g. "-2d", "-1d", "-24h", "now") or absolute
 * ISO date strings (e.g. "2026-01-15T00:00:00Z") to absolute UTC timestamps.
 */

export function parseRelativeToSeconds(rel: string, now: Date): number {
  const s = (rel || '').trim();
  if (s.toLowerCase() === 'now' || s === '') return Math.floor(now.getTime() / 1000);

  // Try ISO / absolute date first
  const dateMs = Date.parse(s);
  if (!isNaN(dateMs)) return Math.floor(dateMs / 1000);

  const match = s.toLowerCase().match(/^(-?\d+)([hd])$/);
  if (!match) return Math.floor(now.getTime() / 1000);

  const value = parseInt(match[1], 10);
  const unit = match[2];
  const sec = 1000;
  const hour = 60 * 60 * sec;
  const day = 24 * hour;

  let delta = 0;
  if (unit === 'h') delta = value * hour;
  else if (unit === 'd') delta = value * day;
  return Math.floor((now.getTime() + delta) / 1000);
}

export function resolveRelativeDateRange(
  start: string,
  end: string,
  now = new Date(),
  bufferMinutes = 0
): { startUtc: number; endUtc: number } {
  let startUtc = parseRelativeToSeconds(start, now);
  let endUtc = parseRelativeToSeconds(end, now);
  const lo = Math.min(startUtc, endUtc);
  const hi = Math.max(startUtc, endUtc);
  startUtc = lo - bufferMinutes * 60;
  endUtc = hi;
  return { startUtc, endUtc };
}
