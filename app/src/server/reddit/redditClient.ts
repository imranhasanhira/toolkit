/**
 * Reddit public JSON API client. No OAuth required for read-only.
 * Use polite User-Agent and throttle (e.g. 1 req per 6s for anonymous).
 *
 * Reddit requires a unique, descriptive User-Agent. Missing or generic values get 403 Blocked.
 * Set env REDDIT_API_USER_AGENT to: platform:app_id:version (by /u/YourRedditUsername)
 * Example: server:toolkit-leadgen:1.0 (by /u/yourname)
 */

const DEFAULT_USER_AGENT = 'server:toolkit-leadgen:1.0 (by /u/toolkit-user)';
function getUserAgent(): string {
  const env = process.env.REDDIT_API_USER_AGENT?.trim();
  return env || DEFAULT_USER_AGENT;
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
  limit = 100
): Promise<RedditListingResponse> {
  const sub = subreddit.replace(/^r\//, '').trim() || 'reddit';
  const url = new URL(`https://www.reddit.com/r/${sub}/new.json`);
  url.searchParams.set('limit', String(limit));
  if (after) url.searchParams.set('after', after);

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': getUserAgent() },
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 403) {
      console.error('Reddit API 403 response:', body);
    }
    const hint = res.status === 403 ? ' Reddit often returns 403 for invalid/missing User-Agent; set REDDIT_API_USER_AGENT (e.g. server:toolkit-leadgen:1.0 (by /u/YourUsername)).' : '';
    throw new Error(`Reddit API error: ${res.status} ${res.statusText}.${hint}`);
  }

  return res.json() as Promise<RedditListingResponse>;
}

export async function fetchSubredditSearch(
  subreddit: string,
  query: string,
  after?: string | null,
  limit = 100
): Promise<RedditListingResponse> {
  const sub = subreddit.replace(/^r\//, '').trim() || 'reddit';
  const url = new URL(`https://www.reddit.com/r/${sub}/search.json`);
  url.searchParams.set('q', query);
  url.searchParams.set('restrict_sr', 'on');
  url.searchParams.set('sort', 'new');
  url.searchParams.set('limit', String(limit));
  if (after) url.searchParams.set('after', after);

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': getUserAgent() },
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 403) {
      console.error('Reddit API 403 response:', body);
    }
    const hint = res.status === 403 ? ' Reddit often returns 403 for invalid/missing User-Agent; set REDDIT_API_USER_AGENT (e.g. server:toolkit-leadgen:1.0 (by /u/YourUsername)).' : '';
    throw new Error(`Reddit API error: ${res.status} ${res.statusText}.${hint}`);
  }

  return res.json() as Promise<RedditListingResponse>;
}
