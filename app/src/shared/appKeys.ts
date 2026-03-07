/**
 * Application keys for the user–app permission matrix.
 * Must stay in sync with nav items and backend operation gating.
 */
export const APP_KEYS = {
  SOKAFILM: 'sokafilm',
  ONLINE_JUDGE: 'online-judge',
} as const;

export type AppKey = (typeof APP_KEYS)[keyof typeof APP_KEYS];

export const APP_KEYS_LIST: AppKey[] = [APP_KEYS.SOKAFILM, APP_KEYS.ONLINE_JUDGE];

export const APP_DISPLAY_NAMES: Record<AppKey, string> = {
  [APP_KEYS.SOKAFILM]: 'SokaFilm',
  [APP_KEYS.ONLINE_JUDGE]: 'Online Judge',
};
