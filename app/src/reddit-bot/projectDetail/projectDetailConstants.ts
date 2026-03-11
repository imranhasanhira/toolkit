import { formatDuration } from '../../shared/utils';

export const TAB_VALUES = ['home', 'posts', 'schedules', 'jobs'] as const;

export const POSTS_PAGE_SIZE_KEY = 'reddit-bot-posts-page-size';
export const PAGE_SIZE_OPTIONS = [20, 50, 100, 200, 500] as const;

export const POST_STATUS_COLOR: Record<string, string> = {
  DOWNLOADED: 'bg-muted text-muted-foreground',
  MATCH: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  RELEVANT: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  DISCARDED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export const JOB_STATUS_COLOR: Record<string, string> = {
  RUNNING: 'text-blue-600 dark:text-blue-400',
  COMPLETED: 'text-green-600 dark:text-green-400',
  FAILED: 'text-red-600 dark:text-red-400',
  KILLED: 'text-amber-600 dark:text-amber-400',
};

export const AI_RUN_STATUS_COLOR: Record<string, string> = {
  RUNNING: 'text-blue-600 dark:text-blue-400',
  COMPLETED: 'text-green-600 dark:text-green-400',
  FAILED: 'text-red-600 dark:text-red-400',
  KILLED: 'text-amber-600 dark:text-amber-400',
};

export type JobConfig = {
  subreddits?: string[];
  keywords?: string[];
  relativeDateRange?: { start: string; end: string; bufferMinutes?: number };
  maxPostsToExplore?: number;
  maxLeadsToFind?: number;
  strictKeywordSearch?: boolean;
};

export function formatJobConfigSummary(config: JobConfig | null | undefined): string {
  if (!config) return 'Exploration (no details)';
  const parts: string[] = [];
  if (config.subreddits?.length) {
    parts.push(config.subreddits.map((s) => (s === 'all' ? 'all' : `r/${s}`)).join(', '));
  }
  if (config.keywords?.length) {
    parts.push(config.keywords.join(', '));
  }
  if (config.relativeDateRange) {
    const { start, end } = config.relativeDateRange;
    parts.push(`${start} → ${end}`);
  }
  if (config.maxPostsToExplore || config.maxLeadsToFind) {
    const limits: string[] = [];
    if (config.maxPostsToExplore) limits.push(`max ${config.maxPostsToExplore} posts`);
    if (config.maxLeadsToFind) limits.push(`max ${config.maxLeadsToFind} leads`);
    parts.push(limits.join(', '));
  }
  if (config.strictKeywordSearch === false) parts.push('all posts (keyword match)');
  return parts.length ? parts.join(' · ') : 'Exploration (no details)';
}

export function formatJobDuration(createdAt: string | Date, completedAt: string | Date | null | undefined): string | null {
  if (!completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(createdAt).getTime();
  if (ms < 0) return null;
  return formatDuration(ms);
}
