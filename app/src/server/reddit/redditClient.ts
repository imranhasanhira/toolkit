/**
 * Reddit public JSON API client. No OAuth required for read-only.
 * Use polite User-Agent and throttle (e.g. 1 req per 6s for anonymous).
 *
 * Reddit requires a unique, descriptive User-Agent. Missing or generic values get 403 Blocked.
 * Set env REDDIT_API_USER_AGENT to: platform:app_id:version (by /u/YourRedditUsername)
 * Example: server:toolkit-leadgen:1.0 (by /u/yourname)
 */

import axios, { AxiosError } from 'axios';

const DEFAULT_USER_AGENT = 'server:toolkit-leadgen:1.0 (by /u/toolkit-user)';
const REDDIT_FETCH_TIMEOUT_MS = 30_000; // 30s so we don't hang forever

function getUserAgent(): string {
  const env = process.env.REDDIT_API_USER_AGENT?.trim();
  return env || DEFAULT_USER_AGENT;
}

async function fetchWithTimeout(
  url: string,
  options: { method?: string; headers?: Record<string, string> },
  timeoutMs: number,
  externalSignal?: AbortSignal
): Promise<any> {
  const controller = new AbortController();

  let onExternalAbort: (() => void) | null = null;
  if (externalSignal) {
    if (externalSignal.aborted) {
      throw new Error('Reddit API request aborted.');
    }
    onExternalAbort = () => controller.abort();
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  console.info('Reddit API:', url);
  try {
    const method = options.method || 'GET';
    const headers = options.headers as Record<string, string> | undefined;

    const res = await axios({
      url,
      method,
      headers,
      timeout: timeoutMs,
      signal: controller.signal,
      maxRedirects: 5,
    });

    return res.data;
  } catch (err: unknown) {
    if (axios.isCancel(err)) {
      if (externalSignal?.aborted) {
        throw new Error('Reddit API request aborted.');
      }
      throw new Error(`Reddit API request timed out after ${timeoutMs / 1000}s. Check network and REDDIT_API_USER_AGENT.`);
    }

    if (err instanceof AxiosError) {
      if (err.code === 'ECONNABORTED') {
        throw new Error(`Reddit API request timed out after ${timeoutMs / 1000}s. Check network and REDDIT_API_USER_AGENT.`);
      }

      if (err.response) {
        if (err.response.status === 403) {
          console.error('Reddit API 403 response:', err.response.data);
        }
        const hint = err.response.status === 403 ? ' Reddit often returns 403 for invalid/missing User-Agent; set REDDIT_API_USER_AGENT (e.g. server:toolkit-leadgen:1.0 (by /u/YourUsername)).' : '';
        throw new Error(`Reddit API error: ${err.response.status} ${err.response.statusText}.${hint}`);
      }
    }
    throw err;
  } finally {
    if (externalSignal && onExternalAbort) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

export interface RedditListingPost {
  id: string;
  name: string; // e.g. t3_xxx
  title: string;
  selftext: string;
  author: string;
  created_utc: number;
  permalink: string;
  subreddit: string;
}

export interface RedditListingResponse {
  kind: string;
  data: {
    after: string | null;
    children: Array<{
      kind: string;
      data: RedditListingPost;
    }>;
  };
}

export async function fetchSubredditNew(
  subreddit: string,
  after?: string | null,
  limit = 100,
  signal?: AbortSignal
): Promise<RedditListingResponse> {
  const sub = subreddit.replace(/^r\//, '').trim() || 'reddit';
  const url = new URL(`https://www.reddit.com/r/${sub}/new.json`);
  url.searchParams.set('limit', String(limit));
  if (after) url.searchParams.set('after', after);

  const res = await fetchWithTimeout(
    url.toString(),
    { headers: { 'User-Agent': getUserAgent() } },
    REDDIT_FETCH_TIMEOUT_MS,
    signal
  );

  return res as RedditListingResponse;
}

export async function fetchSubredditSearch(
  subreddit: string,
  query: string,
  after?: string | null,
  limit = 100,
  signal?: AbortSignal
): Promise<RedditListingResponse> {
  const sub = subreddit.replace(/^r\//, '').trim() || 'reddit';
  const url = new URL(`https://www.reddit.com/r/${sub}/search.json`);
  url.searchParams.set('q', query);
  url.searchParams.set('restrict_sr', 'on');
  url.searchParams.set('sort', 'new');
  url.searchParams.set('limit', String(limit));
  if (after) url.searchParams.set('after', after);

  const res = await fetchWithTimeout(
    url.toString(),
    { headers: { 'User-Agent': getUserAgent() } },
    REDDIT_FETCH_TIMEOUT_MS,
    signal
  );

  return res as RedditListingResponse;
}
