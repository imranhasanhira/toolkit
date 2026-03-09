/**
 * RedditSettings key-value keys. Single source of truth for key names and value types.
 */

export const REDDIT_SETTINGS_KEYS = {
  // credits.*
  credits_defaultForNewUser: 'credits.defaultForNewUser',
  credits_perApiCall: 'credits.perApiCall',
  // ai.*
  ai_enabled: 'ai.enabled',
  ai_engine: 'ai.engine',
  ai_ollama_baseUrl: 'ai.ollama.baseUrl',
  ai_ollama_model: 'ai.ollama.model',
  ai_openrouter_baseUrl: 'ai.openrouter.baseUrl',
  ai_openrouter_apiKey: 'ai.openrouter.apiKey',
  ai_openrouter_model: 'ai.openrouter.model',
  ai_ollama_disableThinking: 'ai.ollama.disableThinking',
  ai_openrouter_disableThinking: 'ai.openrouter.disableThinking',
  // bottleneck.*
  bottleneck_minTime: 'bottleneck.minTime',
  bottleneck_maxConcurrent: 'bottleneck.maxConcurrent',
  bottleneck_reservoir: 'bottleneck.reservoir',
  bottleneck_reservoirRefreshInterval: 'bottleneck.reservoirRefreshInterval',
  bottleneck_clustering_enabled: 'bottleneck.clustering.enabled',
  bottleneck_redis_host: 'bottleneck.redis.host',
  bottleneck_redis_port: 'bottleneck.redis.port',
} as const;

export type RedditSettingsKey = (typeof REDDIT_SETTINGS_KEYS)[keyof typeof REDDIT_SETTINGS_KEYS];

/** Default values for typed settings (used when key is missing). */
export const REDDIT_SETTINGS_DEFAULTS = {
  [REDDIT_SETTINGS_KEYS.credits_defaultForNewUser]: 100,
  [REDDIT_SETTINGS_KEYS.credits_perApiCall]: 1,
  [REDDIT_SETTINGS_KEYS.ai_enabled]: false,
  [REDDIT_SETTINGS_KEYS.ai_engine]: 'ollama' as 'ollama' | 'openrouter',
  [REDDIT_SETTINGS_KEYS.ai_ollama_baseUrl]: null as string | null,
  [REDDIT_SETTINGS_KEYS.ai_ollama_model]: null as string | null,
  [REDDIT_SETTINGS_KEYS.ai_openrouter_baseUrl]: 'https://openrouter.ai/api/v1',
  [REDDIT_SETTINGS_KEYS.ai_openrouter_apiKey]: null as string | null,
  [REDDIT_SETTINGS_KEYS.ai_openrouter_model]: null as string | null,
  [REDDIT_SETTINGS_KEYS.ai_ollama_disableThinking]: true,
  [REDDIT_SETTINGS_KEYS.ai_openrouter_disableThinking]: true,
  [REDDIT_SETTINGS_KEYS.bottleneck_minTime]: 10000,
  [REDDIT_SETTINGS_KEYS.bottleneck_maxConcurrent]: 1,
  [REDDIT_SETTINGS_KEYS.bottleneck_reservoir]: null as number | null,
  [REDDIT_SETTINGS_KEYS.bottleneck_reservoirRefreshInterval]: null as number | null,
  [REDDIT_SETTINGS_KEYS.bottleneck_clustering_enabled]: false,
  [REDDIT_SETTINGS_KEYS.bottleneck_redis_host]: null as string | null,
  [REDDIT_SETTINGS_KEYS.bottleneck_redis_port]: 6379,
} as const;
