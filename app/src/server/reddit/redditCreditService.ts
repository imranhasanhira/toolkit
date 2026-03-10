/**
 * Reddit API credit service. Uses RedditCreditAccount and RedditSettings (key-value).
 * Credits use Prisma Decimal for exact precision; convert to number for arithmetic.
 */

import {
  REDDIT_SETTINGS_KEYS,
  REDDIT_SETTINGS_DEFAULTS,
} from './redditSettingsKeys';
import { decryptKey, maskKey } from './redditOpenRouterKey';

/** Convert Prisma Decimal or number to number. Use when reading credit fields from DB. */
export function toNum(v: unknown): number {
  if (v == null) return 0;
  const o = v as { toNumber?: () => number };
  if (typeof o.toNumber === 'function') return o.toNumber();
  return Number(v);
}

export class InsufficientRedditCreditError extends Error {
  constructor(message = 'Insufficient Reddit credit') {
    super(message);
    this.name = 'InsufficientRedditCreditError';
  }
}

/** Typed Reddit settings (nested: credits, ai, bottleneck). */
export type RedditSettings = {
  credits: {
    defaultForNewUser: number;
    perApiCall: number;
  };
  ai: {
    enabled: boolean;
    engine: 'ollama' | 'openrouter';
    ollama: { baseUrl: string | null; model: string | null; disableThinking: boolean };
    openrouter: { baseUrl: string; model: string | null; apiKeyMasked: string | null; disableThinking: boolean };
    maxPostsPerAnalysisRun: number;
  };
  bottleneck: {
    minTime: number;
    maxConcurrent: number;
    reservoir?: number;
    reservoirRefreshInterval?: number;
    redis: {
      clusteringEnabled: boolean;
      host: string | null;
      port: number;
      /** Authentication for Redis. May come from settings or REDIS_URL; settings take precedence. */
      password: string | null;
      username: string | null;
    };
  };
};

function jsonToNum(val: unknown): number {
  if (val == null) return 0;
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function jsonToBool(val: unknown): boolean {
  return val === true || val === 'true';
}

function jsonToStrOrNull(val: unknown): string | null {
  if (val == null) return null;
  const s = String(val);
  return s.trim() || null;
}

/**
 * Parse REDIS_URL (e.g. redis://host:6379, redis://:password@host:6379, redis://user:password@host:6379).
 * Used for host/port fallback and for auth when Redis requires it (NOAUTH).
 */
function parseRedisUrl(
  url: string | undefined
): { host: string; port: number; password: string | null; username: string | null } | null {
  if (!url || typeof url !== 'string' || !url.trim()) return null;
  try {
    const u = new URL(url.trim());
    const host = u.hostname?.trim();
    if (!host) return null;
    const port = u.port ? parseInt(u.port, 10) : 6379;
    const password = u.password ? decodeURIComponent(u.password) : null;
    const username = u.username ? decodeURIComponent(u.username) : null;
    return {
      host,
      port: Number.isFinite(port) && port > 0 ? port : 6379,
      password: password?.trim() || null,
      username: username?.trim() || null,
    };
  } catch {
    return null;
  }
}

/** Returns decrypted OpenRouter API key for server-side use only. Never send to client. */
export async function getDecryptedOpenRouterApiKey(entities: any): Promise<string | null> {
  const row = await entities.RedditSettings.findUnique({
    where: { key: REDDIT_SETTINGS_KEYS.ai_openrouter_apiKey },
  });
  const stored = (row?.value as string | null | undefined) ?? null;
  return decryptKey(stored);
}

export async function getSettings(entities: any): Promise<RedditSettings> {
  const rows = await entities.RedditSettings.findMany();
  const map: Record<string, unknown> = {};
  for (const r of rows as { key: string; value: unknown }[]) {
    map[r.key] = r.value;
  }
  const defaults: Record<string, unknown> = { ...REDDIT_SETTINGS_DEFAULTS };
  const get = (key: string): unknown => map[key] ?? defaults[key];
  const aiEngine = get(REDDIT_SETTINGS_KEYS.ai_engine);
  const engine: 'ollama' | 'openrouter' =
    aiEngine === 'openrouter' ? 'openrouter' : 'ollama';
  const openrouterApiKeyStored = get(REDDIT_SETTINGS_KEYS.ai_openrouter_apiKey) as string | null | undefined;
  const openrouterBaseUrlDefault =
    (REDDIT_SETTINGS_DEFAULTS as Record<string, unknown>)[REDDIT_SETTINGS_KEYS.ai_openrouter_baseUrl] as string;
  return {
    credits: {
      defaultForNewUser: jsonToNum(get(REDDIT_SETTINGS_KEYS.credits_defaultForNewUser)) || 100,
      perApiCall: jsonToNum(get(REDDIT_SETTINGS_KEYS.credits_perApiCall)) || 1,
    },
    ai: {
      enabled: jsonToBool(get(REDDIT_SETTINGS_KEYS.ai_enabled)),
      engine,
      ollama: {
        baseUrl: jsonToStrOrNull(get(REDDIT_SETTINGS_KEYS.ai_ollama_baseUrl)),
        model: jsonToStrOrNull(get(REDDIT_SETTINGS_KEYS.ai_ollama_model)),
        disableThinking: jsonToBool(get(REDDIT_SETTINGS_KEYS.ai_ollama_disableThinking)),
      },
      openrouter: {
        baseUrl: jsonToStrOrNull(get(REDDIT_SETTINGS_KEYS.ai_openrouter_baseUrl)) ?? openrouterBaseUrlDefault,
        model: jsonToStrOrNull(get(REDDIT_SETTINGS_KEYS.ai_openrouter_model)),
        apiKeyMasked: openrouterApiKeyStored
          ? maskKey(decryptKey(openrouterApiKeyStored))
          : null,
        disableThinking: jsonToBool(get(REDDIT_SETTINGS_KEYS.ai_openrouter_disableThinking)),
      },
      maxPostsPerAnalysisRun: jsonToNum(get(REDDIT_SETTINGS_KEYS.ai_maxPostsPerAnalysisRun)) || 1000,
    },
    bottleneck: {
      minTime: jsonToNum(get(REDDIT_SETTINGS_KEYS.bottleneck_minTime)) || 10000,
      maxConcurrent: jsonToNum(get(REDDIT_SETTINGS_KEYS.bottleneck_maxConcurrent)) || 1,
      reservoir: (() => {
        const v = get(REDDIT_SETTINGS_KEYS.bottleneck_reservoir);
        if (v == null) return undefined;
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
      })(),
      reservoirRefreshInterval: (() => {
        const v = get(REDDIT_SETTINGS_KEYS.bottleneck_reservoirRefreshInterval);
        if (v == null) return undefined;
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
      })(),
      redis: (() => {
        const settingsHost = jsonToStrOrNull(get(REDDIT_SETTINGS_KEYS.bottleneck_redis_host));
        const settingsPort = jsonToNum(get(REDDIT_SETTINGS_KEYS.bottleneck_redis_port)) || 6379;
        const settingsUsername = jsonToStrOrNull(get(REDDIT_SETTINGS_KEYS.bottleneck_redis_username));
        const settingsPassword = jsonToStrOrNull(get(REDDIT_SETTINGS_KEYS.bottleneck_redis_password));
        const fromEnv = parseRedisUrl(process.env.REDIS_URL);
        // Prefer settings; if host not set, use REDIS_URL from env. If clustering is on and neither has host, limiter will fail when connecting.
        const host = settingsHost?.trim() || fromEnv?.host || null;
        const port = settingsHost?.trim() ? settingsPort : (fromEnv?.port ?? 6379);
        // Auth: settings (username/password) override REDIS_URL; REDIS_URL used as fallback.
        const username = settingsUsername?.trim() || fromEnv?.username || null;
        const password = settingsPassword?.trim() || fromEnv?.password || null;
        return {
          clusteringEnabled: jsonToBool(get(REDDIT_SETTINGS_KEYS.bottleneck_clustering_enabled)),
          host,
          port,
          password,
          username,
        };
      })(),
    },
  };
}

export type RedditCreditBalance = {
  balance: number;
  totalUsed: number;
};

export async function getBalance(
  entities: any,
  userId: string
): Promise<RedditCreditBalance> {
  const account = await entities.RedditCreditAccount.findUnique({
    where: { userId },
  });
  if (!account) {
    return { balance: 0, totalUsed: 0 };
  }
  return {
    balance: toNum(account.balance),
    totalUsed: toNum(account.totalUsed),
  };
}

export async function deductCredit(
  entities: any,
  userId: string,
  amount: number,
  reason: string,
  jobId?: string | null
): Promise<void> {
  if (amount <= 0) return;

  const account = await entities.RedditCreditAccount.findUnique({
    where: { userId },
  });
  const balance = toNum(account?.balance);
  if (balance < amount) {
    throw new InsufficientRedditCreditError(
      `Insufficient Reddit credit: have ${balance}, need ${amount}`
    );
  }

  const newBalance = balance - amount;
  const newTotalUsed = toNum(account?.totalUsed) + amount;

  await entities.RedditCreditAccount.upsert({
    where: { userId },
    create: {
      userId,
      balance: newBalance,
      totalUsed: newTotalUsed,
    },
    update: {
      balance: newBalance,
      totalUsed: newTotalUsed,
    },
  });

  await entities.RedditCreditTransaction.create({
    data: {
      userId,
      amount: -amount,
      reason,
      jobId: jobId ?? undefined,
    },
  });
}

export async function topUp(
  entities: any,
  userId: string,
  amount: number,
  reason = 'topup'
): Promise<RedditCreditBalance> {
  if (amount <= 0) {
    throw new Error('Top-up amount must be positive');
  }

  const account = await entities.RedditCreditAccount.findUnique({
    where: { userId },
  });
  const currentBalance = toNum(account?.balance);
  const currentTotalUsed = toNum(account?.totalUsed);
  const newBalance = currentBalance + amount;

  await entities.RedditCreditAccount.upsert({
    where: { userId },
    create: {
      userId,
      balance: newBalance,
      totalUsed: currentTotalUsed,
    },
    update: {
      balance: newBalance,
    },
  });

  await entities.RedditCreditTransaction.create({
    data: {
      userId,
      amount,
      reason,
    },
  });

  return { balance: newBalance, totalUsed: currentTotalUsed };
}
