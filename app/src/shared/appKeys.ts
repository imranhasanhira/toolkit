/**
 * Application keys for the user–app permission matrix.
 * Must stay in sync with nav items and backend operation gating.
 */
export const APP_KEYS = {
  SOKAFILM: 'sokafilm',
  ONLINE_JUDGE: 'online-judge',
  REDDIT_BOT: 'reddit-bot',
  CARELY: 'carely',
} as const;

export type AppKey = (typeof APP_KEYS)[keyof typeof APP_KEYS];

export const APP_KEYS_LIST: AppKey[] = [APP_KEYS.SOKAFILM, APP_KEYS.ONLINE_JUDGE, APP_KEYS.REDDIT_BOT, APP_KEYS.CARELY];

export const APP_DISPLAY_NAMES: Record<AppKey, string> = {
  [APP_KEYS.SOKAFILM]: 'SokaFilm',
  [APP_KEYS.ONLINE_JUDGE]: 'Online Judge',
  [APP_KEYS.REDDIT_BOT]: 'Reddit Bot',
  [APP_KEYS.CARELY]: 'Carely',
};
