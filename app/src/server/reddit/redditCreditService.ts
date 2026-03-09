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
      redis: {
        clusteringEnabled: jsonToBool(get(REDDIT_SETTINGS_KEYS.bottleneck_clustering_enabled)),
        host: jsonToStrOrNull(get(REDDIT_SETTINGS_KEYS.bottleneck_redis_host)),
        port: jsonToNum(get(REDDIT_SETTINGS_KEYS.bottleneck_redis_port)) || 6379,
      },
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
