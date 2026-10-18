export const DEFAULT_PROJECT_NAME = 'Default';

export const DEFAULT_LEAVE_CATEGORIES = [
  { name: 'Vacation', color: '#2563EB', quota: 20 },
  { name: 'Sick Leave', color: '#DC2626', quota: 10 },
  { name: 'Personal', color: '#059669', quota: 5 },
  { name: 'Work From Home', color: '#7C3AED', quota: 10 },
] as const;

/** Previously hardcoded in the page. Seeded once per project, never re-injected after delete. */
export const DEFAULT_GOVERNMENT_HOLIDAYS = [
  { date: '2025-12-25', name: 'Christmas Day' },
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-04-05', name: 'Easter Sunday' },
  { date: '2026-04-06', name: 'Easter Monday' },
  { date: '2026-04-27', name: "King's Day" },
  { date: '2026-05-14', name: 'Ascension Day' },
  { date: '2026-05-24', name: 'Whit Sunday' },
  { date: '2026-05-25', name: 'Whit Monday' },
  { date: '2026-12-25', name: 'Christmas Day' },
] as const;
