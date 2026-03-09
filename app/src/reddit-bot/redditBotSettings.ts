import { HttpError } from 'wasp/server';
import {
  getBalance,
  getSettings,
  getDecryptedOpenRouterApiKey,
  topUp,
  toNum,
} from '../server/reddit/redditCreditService';
import { REDDIT_SETTINGS_KEYS } from '../server/reddit/redditSettingsKeys';
import { encryptKey } from '../server/reddit/redditOpenRouterKey';
import * as z from 'zod';

export const getMyRedditCredit = async (_args: void, context: any) => {
  if (!context.user) throw new HttpError(401, 'Not authorized');
  const [balanceData, settings] = await Promise.all([
    getBalance(context.entities, context.user.id),
    getSettings(context.entities),
  ]);
  return {
    ...balanceData,
    creditPerApiCall: settings.credits.perApiCall,
  };
};

/** Returns whether AI relevancy (Ollama or OpenRouter) is configured. Used to enable/disable Run AI analysis button. */
export const getRedditAiConfigStatus = async (_args: void, context: any) => {
  if (!context.user) throw new HttpError(401, 'Not authorized');
  const settings = await getSettings(context.entities);
  const openrouterKey = await getDecryptedOpenRouterApiKey(context.entities);
  const configured =
    settings.ai.enabled === true &&
    (settings.ai.engine === 'openrouter'
      ? !!openrouterKey?.trim() && !!settings.ai.openrouter.model?.trim()
      : !!settings.ai.ollama.baseUrl?.trim() && !!settings.ai.ollama.model?.trim());
  return { configured };
};

export const getRedditSettings = async (_args: void, context: any) => {
  if (!context.user?.isAdmin) throw new HttpError(403, 'Admin only');
  return getSettings(context.entities);
};

const updateRedditSettingsSchema = z.object({
  defaultCreditForNewUser: z.number().min(0).optional(),
  creditPerApiCall: z.number().positive().optional(),
  aiRelevancyEnabled: z.boolean().optional(),
  aiEngine: z.enum(['ollama', 'openrouter']).optional(),
  ollamaBaseUrl: z.string().nullable().optional(),
  ollamaModel: z.string().nullable().optional(),
  openrouterBaseUrl: z.string().nullable().optional(),
  openrouterApiKey: z.string().nullable().optional(),
  openrouterModel: z.string().nullable().optional(),
  ollamaDisableThinking: z.boolean().optional(),
  openrouterDisableThinking: z.boolean().optional(),
  aiMaxPostsPerAnalysisRun: z.number().min(1).optional(),
  // bottleneck
  bottleneckMinTime: z.number().min(0).optional(),
  bottleneckMaxConcurrent: z.number().min(1).optional(),
  bottleneckReservoir: z.number().min(0).nullable().optional(),
  bottleneckReservoirRefreshInterval: z.number().min(0).nullable().optional(),
  bottleneckClusteringEnabled: z.boolean().optional(),
  bottleneckRedisHost: z.string().nullable().optional(),
  bottleneckRedisPort: z.number().min(1).optional(),
});

async function setSetting(
  entities: any,
  key: string,
  value: unknown
): Promise<void> {
  const json = JSON.parse(JSON.stringify(value));
  await entities.RedditSettings.upsert({
    where: { key },
    update: { value: json },
    create: { key, value: json },
  });
}

export const updateRedditSettings = async (args: unknown, context: any) => {
  if (!context.user?.isAdmin) throw new HttpError(403, 'Admin only');
  const parsed = updateRedditSettingsSchema.safeParse(args);
  if (!parsed.success) {
    console.error('[updateRedditSettings] Zod validation failed:', parsed.error.format());
    throw new HttpError(400, 'Invalid input');
  }
  const entities = context.entities;
  const d = parsed.data;

  if (d.defaultCreditForNewUser !== undefined) {
    await setSetting(entities, REDDIT_SETTINGS_KEYS.credits_defaultForNewUser, d.defaultCreditForNewUser);
  }
  if (d.creditPerApiCall !== undefined) {
    await setSetting(entities, REDDIT_SETTINGS_KEYS.credits_perApiCall, d.creditPerApiCall);
  }
  if (d.aiRelevancyEnabled !== undefined) {
    await setSetting(entities, REDDIT_SETTINGS_KEYS.ai_enabled, d.aiRelevancyEnabled);
  }
  if (d.aiEngine !== undefined) {
    await setSetting(entities, REDDIT_SETTINGS_KEYS.ai_engine, d.aiEngine);
  }
  if (d.ollamaBaseUrl !== undefined) {
    await setSetting(entities, REDDIT_SETTINGS_KEYS.ai_ollama_baseUrl, d.ollamaBaseUrl);
  }
  if (d.ollamaModel !== undefined) {
    await setSetting(entities, REDDIT_SETTINGS_KEYS.ai_ollama_model, d.ollamaModel);
  }
  if (d.openrouterBaseUrl !== undefined) {
    await setSetting(entities, REDDIT_SETTINGS_KEYS.ai_openrouter_baseUrl, d.openrouterBaseUrl);
  }
  if (d.openrouterModel !== undefined) {
    await setSetting(entities, REDDIT_SETTINGS_KEYS.ai_openrouter_model, d.openrouterModel);
  }
  if (d.openrouterApiKey !== undefined && d.openrouterApiKey !== null && String(d.openrouterApiKey).trim() !== '') {
    const encrypted = encryptKey(String(d.openrouterApiKey).trim());
    await setSetting(entities, REDDIT_SETTINGS_KEYS.ai_openrouter_apiKey, encrypted);
  }
  if (d.ollamaDisableThinking !== undefined) {
    await setSetting(entities, REDDIT_SETTINGS_KEYS.ai_ollama_disableThinking, d.ollamaDisableThinking);
  }
  if (d.openrouterDisableThinking !== undefined) {
    await setSetting(entities, REDDIT_SETTINGS_KEYS.ai_openrouter_disableThinking, d.openrouterDisableThinking);
  }
  if (d.aiMaxPostsPerAnalysisRun !== undefined) {
    await setSetting(entities, REDDIT_SETTINGS_KEYS.ai_maxPostsPerAnalysisRun, d.aiMaxPostsPerAnalysisRun);
  }
  if (d.bottleneckMinTime !== undefined) {
    await setSetting(entities, REDDIT_SETTINGS_KEYS.bottleneck_minTime, d.bottleneckMinTime);
  }
  if (d.bottleneckMaxConcurrent !== undefined) {
    await setSetting(entities, REDDIT_SETTINGS_KEYS.bottleneck_maxConcurrent, d.bottleneckMaxConcurrent);
  }
  if (d.bottleneckReservoir !== undefined) {
    await setSetting(entities, REDDIT_SETTINGS_KEYS.bottleneck_reservoir, d.bottleneckReservoir);
  }
  if (d.bottleneckReservoirRefreshInterval !== undefined) {
    await setSetting(entities, REDDIT_SETTINGS_KEYS.bottleneck_reservoirRefreshInterval, d.bottleneckReservoirRefreshInterval);
  }
  if (d.bottleneckClusteringEnabled !== undefined) {
    await setSetting(entities, REDDIT_SETTINGS_KEYS.bottleneck_clustering_enabled, d.bottleneckClusteringEnabled);
  }
  if (d.bottleneckRedisHost !== undefined) {
    await setSetting(entities, REDDIT_SETTINGS_KEYS.bottleneck_redis_host, d.bottleneckRedisHost);
  }
  if (d.bottleneckRedisPort !== undefined) {
    await setSetting(entities, REDDIT_SETTINGS_KEYS.bottleneck_redis_port, d.bottleneckRedisPort);
  }

  const result = await getSettings(entities);
  return result;
};

const topUpSchema = z.object({
  userId: z.string(),
  amount: z.number().positive(),
});

export const topUpRedditCredit = async (args: unknown, context: any) => {
  if (!context.user?.isAdmin) throw new HttpError(403, 'Admin only');
  const parsed = topUpSchema.safeParse(args);
  if (!parsed.success) throw new HttpError(400, 'Invalid input');
  const { userId, amount } = parsed.data;
  return topUp(context.entities, userId, amount);
};

type RedditCreditUserRow = {
  id: string;
  email: string | null;
  username: string | null;
  balance: number;
  totalUsed: number;
  totalIssued: number;
};

/** Returns all users with their Reddit credit balance, totalUsed, and totalIssued (no filter by credit activity). */
export const getRedditCreditUsersWithBalances = async (_args: void, context: any) => {
  if (!context.user?.isAdmin) throw new HttpError(403, 'Admin only');
  const entities = context.entities;
  const [users, accounts, positiveTransactions] = await Promise.all([
    entities.User.findMany({
      select: { id: true, email: true, username: true },
      orderBy: [{ username: 'asc' }, { email: 'asc' }],
    }),
    entities.RedditCreditAccount.findMany({
      select: { userId: true, balance: true, totalUsed: true },
    }),
    entities.RedditCreditTransaction.findMany({
      where: { amount: { gt: 0 } },
      select: { userId: true, amount: true },
    }),
  ]);
  const issuedByUser: Record<string, number> = {};
  for (const t of positiveTransactions as { userId: string; amount: unknown }[]) {
    issuedByUser[t.userId] = (issuedByUser[t.userId] ?? 0) + toNum(t.amount);
  }
  const accountByUser: Record<string, { balance: unknown; totalUsed: unknown }> = {};
  for (const a of accounts as { userId: string; balance: unknown; totalUsed: unknown }[]) {
    accountByUser[a.userId] = { balance: a.balance, totalUsed: a.totalUsed };
  }
  return users.map((u: { id: string; email: string | null; username: string | null }) => {
    const acc = accountByUser[u.id];
    return {
      id: u.id,
      email: u.email,
      username: u.username,
      balance: toNum(acc?.balance),
      totalUsed: toNum(acc?.totalUsed),
      totalIssued: issuedByUser[u.id] ?? 0,
    };
  }) as RedditCreditUserRow[];
};

export const getOpenRouterAiCredit = async (_args: void, context: any) => {
  if (!context.user) throw new HttpError(401, 'Not authorized');
  const settings = await getSettings(context.entities);
  if (!settings.ai.enabled || settings.ai.engine !== 'openrouter') {
    return { available: false as const };
  }
  const apiKey = await getDecryptedOpenRouterApiKey(context.entities);
  if (!apiKey?.trim()) return { available: false as const };
  const baseUrl = settings.ai.openrouter.baseUrl || 'https://openrouter.ai/api/v1';
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/key`, {
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
    });
    if (!res.ok) return { available: false as const };
    const json = await res.json() as {
      data: { usage: number; limit: number | null; limit_remaining: number | null; is_free_tier: boolean };
    };
    const d = json.data;
    return {
      available: true as const,
      usage: d.usage,
      limit: d.limit,
      limitRemaining: d.limit_remaining,
      isFreeTier: d.is_free_tier,
    };
  } catch {
    return { available: false as const };
  }
};

export const getRedditCreditAdminStats = async (_args: void, context: any) => {
  if (!context.user?.isAdmin) throw new HttpError(403, 'Admin only');
  const entities = context.entities;
  const [jobs, transactions, accounts] = await Promise.all([
    entities.RedditBotJob.findMany({
      select: { redditApiCalls: true, redditCreditsUsed: true },
    }),
    entities.RedditCreditTransaction.findMany({
      select: { amount: true },
    }),
    entities.RedditCreditAccount.findMany({
      select: { totalUsed: true },
    }),
  ]);
  const totalApiCalls = jobs.reduce(
    (s: number, j: { redditApiCalls?: number | null }) => s + (j.redditApiCalls ?? 0),
    0
  );
  const totalIssued = transactions
    .filter((t: { amount: unknown }) => toNum(t.amount) > 0)
    .reduce((s: number, t: { amount: unknown }) => s + toNum(t.amount), 0);
  const totalUsed = accounts.reduce(
    (s: number, a: { totalUsed?: unknown }) => s + toNum(a.totalUsed),
    0
  );
  return { totalApiCalls, totalIssued, totalUsed };
};
