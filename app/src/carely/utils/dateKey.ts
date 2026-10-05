/** Calendar date of a UTC-midnight (or date-only) value, as YYYY-MM-DD. */
export function utcDateKey(value: string | Date): string {
  return new Date(value).toISOString().slice(0, 10);
}

/** Whole years since a date-only birthday stored as UTC midnight. */
export function ageInYears(dob: string | Date, now = new Date()): number {
  const birth = new Date(dob);
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }
  return Math.max(0, age);
}

/** True when a prescription covers the given local calendar day (YYYY-MM-DD). */
export function prescriptionCoversDate(rx: { startDate: string | Date; endDate?: string | Date | null }, dayKey: string): boolean {
  const startKey = utcDateKey(rx.startDate);
  const endKey = rx.endDate ? utcDateKey(rx.endDate) : null;
  return dayKey >= startKey && (!endKey || dayKey <= endKey);
}
