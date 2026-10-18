export interface LeaveProject {
  id: string;
  name: string;
  color: string | null;
  isArchived: boolean;
}

export interface LeaveCategory {
  id: string;
  name: string;
  color: string;
  startDate: string; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD or null when open-ended
  quota: number;
  isArchived: boolean;
  projectId: string | null;
}

export interface LeaveDate {
  date: string; // YYYY-MM-DD
  categoryId: string;
}

export interface GovernmentHoliday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  description?: string | null;
  projectId: string | null;
}

export type { LeaveScope } from './scope';

export type { RangeMode } from './dates';

/** Single click marks or clears one day. Range waits for a start tap, then an end tap. */
export type MarkMode = 'single' | 'range';
