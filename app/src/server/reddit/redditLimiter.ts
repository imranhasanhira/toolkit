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
    hasPassword: !!b.redis.password,
    hasUsername: !!b.redis.username,
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

  if (b.redis.clusteringEnabled === true && !useRedis) {
    throw new Error(
      'Reddit Bottleneck clustering is enabled but Redis host is not set. Set Bottleneck Redis host in Reddit admin settings or set REDIS_URL env.'
    );
  }

  if (useRedis) {
    const clientOptions: Record<string, unknown> = {
      host: b.redis.host!.trim(),
      port: b.redis.port ?? 6379,
      connectTimeout: 5000,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => (times < 3 ? 500 : null),
    };
    if (b.redis.password != null && b.redis.password !== '') {
      clientOptions.password = b.redis.password;
    }
    if (b.redis.username != null && b.redis.username !== '') {
      clientOptions.username = b.redis.username;
    }
    const connection = new Bottleneck.IORedisConnection({
      clientOptions,
    });

    options.connection = connection;

    // Reject fast if Redis isn't connected so jobs don't hang in the queue forever
    await new Promise<void>((resolve, reject) => {
      let resolved = false;

      // Bottleneck IORedisConnection doesn't expose 'ready', so we hook the underlying client
      // Try to emit ready on the wrapper if the wrapper emits it, or grab the client
      const checkClient = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      const failClient = (err: Error) => {
        if (!resolved) {
          resolved = true;
          reject(new Error(`Reddit Bottleneck IORedis connection failed: ${err.message}. Check your Bottleneck DB settings.`));
        }
      };

      try {
        // @ts-ignore - access internal redis instance for events if available
        const client = connection._client || connection.client;
        if (client) {
          client.on('ready', checkClient);
          client.on('error', failClient);
        } else {
          // fallback if we can't get the client
          connection.on('error', failClient);
          // wait a tiny bit to see if error throws, otherwise assume ready
          setTimeout(checkClient, 2000);
        }
      } catch {
        // safety
      }

      // strict timeout fallback just in case IORedis doesn't emit error
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error(`Reddit Bottleneck IORedis connection timed out after 5s. Your Redis host (${b.redis.host}) is unreachable.`));
        }
      }, 5000);
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
