/**
 * Reddit API rate limiter using Bottleneck. Always on; clustering (Redis) is optional.
 * When bottleneck.clustering.enabled and redis.host are set, uses Bottleneck with ioredis for cross-process limiting.
 * Otherwise uses in-memory Bottleneck (single process).
 */

import Bottleneck from 'bottleneck';
import type { RedditSettings } from './redditCreditService';

let cachedLimiter: Bottleneck | null = null;
let cacheKey: string = '';

function configKey(settings: RedditSettings): string {
  const b = settings.bottleneck;
  return JSON.stringify({
    minTime: b.minTime,
    maxConcurrent: b.maxConcurrent,
    reservoir: b.reservoir ?? null,
    reservoirRefreshInterval: b.reservoirRefreshInterval ?? null,
    clustering: b.redis.clusteringEnabled && b.redis.host?.trim(),
    host: b.redis.host?.trim() ?? null,
    port: b.redis.port,
  });
}

export async function getRedditLimiter(settings: RedditSettings): Promise<Bottleneck> {
  const key = configKey(settings);
  if (cachedLimiter && cacheKey === key) {
    return cachedLimiter;
  }

  const b = settings.bottleneck;
  const options: Record<string, unknown> = {
    id: 'reddit-api',
    minTime: b.minTime ?? 10000,
    maxConcurrent: b.maxConcurrent ?? 1,
  };

  if (b.reservoir != null && b.reservoirRefreshInterval != null) {
    options.reservoir = b.reservoir;
    options.reservoirRefreshInterval = b.reservoirRefreshInterval;
    options.reservoirRefreshAmount = b.reservoir;
  }

  const useRedis =
    b.redis.clusteringEnabled === true &&
    typeof b.redis.host === 'string' &&
    b.redis.host.trim().length > 0;

  if (useRedis) {
    options.connection = new Bottleneck.IORedisConnection({
      clientOptions: {
        host: b.redis.host!.trim(),
        port: b.redis.port ?? 6379,
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => (times < 3 ? 500 : null),
      },
    });
  }

  const limiter = new Bottleneck(options as Bottleneck.ConstructorOptions);
  limiter.on('error', (err) => {
    console.error('Reddit Bottleneck limiter error:', err);
  });

  if (cachedLimiter && cacheKey !== key) {
    try {
      await cachedLimiter.disconnect();
    } catch (_) {
      // ignore
    }
    cachedLimiter = null;
  }

  cachedLimiter = limiter;
  cacheKey = key;
  return limiter;
}
