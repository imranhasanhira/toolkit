import { fetchSubredditNew, fetchSubredditSearch, type RedditListingPost } from './redditClient';
import { getRedditLimiter } from './redditLimiter';
import { resolveRelativeDateRange } from './relativeDate';
import {
  getSettings,
  getDecryptedOpenRouterApiKey,
  deductCredit,
  InsufficientRedditCreditError,
  toNum,
} from './redditCreditService';

export interface ExplorationOptions {
  subreddits: string[];
  keywords: string[];
  relativeDateRange: { start: string; end: string; bufferMinutes?: number };
  maxPostsToExplore?: number;
  maxLeadsToFind?: number;
  /** When true (default), use Reddit API keyword search; when false, fetch all subreddit posts and match keywords locally. */
  strictKeywordSearch?: boolean;
}

function matchKeywords(text: string, keywords: string[]): string[] {
  if (!keywords.length) return [];
  const lower = text.toLowerCase();
  return keywords.filter((k) => k && lower.includes(k.toLowerCase()));
}

export async function runExploration(
  projectId: string,
  jobId: string,
  options: ExplorationOptions,
  context: {
    entities: any;
  },
  userId: string
): Promise<void> {
  const { entities } = context;
  const now = new Date();
  const { startUtc, endUtc } = resolveRelativeDateRange(
    options.relativeDateRange?.start ?? '-24h',
    options.relativeDateRange?.end ?? 'now',
    now,
    options.relativeDateRange?.bufferMinutes ?? 0
  );

  const subreddits = options.subreddits?.length ? options.subreddits : ['all'];
  const keywords = options.keywords || [];
  const maxPosts = options.maxPostsToExplore ?? 0;
  const maxLeads = options.maxLeadsToFind ?? 0;

  const project = await entities.RedditBotProject.findUnique({
    where: { id: projectId },
    select: { productDescription: true, keywords: true },
  });
  if (!project) throw new Error('Project not found');
  const projectKeywords = (project.keywords as string[]) || [];

  const settings = await getSettings(entities);
  const limiter = await getRedditLimiter(settings);
  const strictKeywordSearch = options.strictKeywordSearch !== false;
  const openrouterKey = await getDecryptedOpenRouterApiKey(entities);
  const aiEnabled =
    settings.ai.enabled === true &&
    (settings.ai.engine === 'openrouter'
      ? !!openrouterKey?.trim() && !!settings.ai.openrouter.model?.trim()
      : !!settings.ai.ollama.baseUrl?.trim() && !!settings.ai.ollama.model?.trim());

  // Reddit /new and search?sort=new return newest-first. We page with `after` to walk backward in time.
  // We process posts in [startUtc, endUtc] and stop when we see a post older than startUtc (past the window).
  for (const subreddit of subreddits) {
    const fetchPage =
      strictKeywordSearch && keywords.length > 0
        ? (after: string | null) =>
            fetchSubredditSearch(subreddit, keywords.join(' OR '), after)
        : (after: string | null) => fetchSubredditNew(subreddit, after);

    let after: string | null = null;
    let hasMore = true;

    while (hasMore) {
      const job = await entities.RedditBotJob.findUnique({
        where: { id: jobId },
        select: { stopRequestedAt: true, uniqueCount: true, keywordMatchCount: true },
      });
      if (job?.stopRequestedAt) {
        await entities.RedditBotJob.update({
          where: { id: jobId },
          data: { status: 'KILLED', completedAt: now },
        });
        return;
      }
      if (maxPosts > 0 && job && job.uniqueCount >= maxPosts) {
        await entities.RedditBotJob.update({
          where: { id: jobId },
          data: { status: 'COMPLETED', completedAt: now },
        });
        return;
      }
      if (maxLeads > 0 && job && job.keywordMatchCount >= maxLeads) {
        await entities.RedditBotJob.update({
          where: { id: jobId },
          data: { status: 'COMPLETED', completedAt: now },
        });
        return;
      }

      const settingsPage = await getSettings(entities);
      const creditPerCall = settingsPage.credits.perApiCall || 1;
      try {
        await deductCredit(entities, userId, creditPerCall, 'reddit_api_call', jobId);
      } catch (err) {
        if (err instanceof InsufficientRedditCreditError) {
          await entities.RedditBotJob.update({
            where: { id: jobId },
            data: {
              status: 'FAILED',
              errorMessage: err.message || 'Insufficient Reddit credit',
              completedAt: now,
            },
          });
          return;
        }
        throw err;
      }

      const listing = await limiter.schedule(() => fetchPage(after));
      const currentJob = await entities.RedditBotJob.findUnique({
        where: { id: jobId },
        select: { redditApiCalls: true, redditCreditsUsed: true },
      });
      await entities.RedditBotJob.update({
        where: { id: jobId },
        data: {
          redditApiCalls: (currentJob?.redditApiCalls ?? 0) + 1,
          redditCreditsUsed: toNum(currentJob?.redditCreditsUsed) + creditPerCall,
        },
      });
      const children = listing?.data?.children ?? [];
      after = listing?.data?.after ?? null;
      if (!children.length) hasMore = false;

      for (const { data: post } of children) {
        const created = post.created_utc;
        if (created < startUtc) {
          hasMore = false;
          break;
        }
        if (created > endUtc) continue;

        const redditId = post.id || post.name;
        if (!redditId) continue;

        const existingPost = await entities.RedditBotPost.findUnique({
          where: { redditId },
          include: { author: true },
        });

        let postId: string;
        let authorId: string;

        if (existingPost) {
          postId = existingPost.id;
          authorId = existingPost.authorId;
        } else {
          const author = await entities.RedditBotAuthor.upsert({
            where: { redditUsername: post.author || '[deleted]' },
            create: {
              redditUsername: post.author || '[deleted]',
              profileUrl: `https://reddit.com/user/${post.author || 'deleted'}`,
            },
            update: {},
          });
          authorId = author.id;
          const newPost = await entities.RedditBotPost.create({
            data: {
              redditId,
              title: post.title ?? '',
              content: (post.selftext as string) ?? '',
              postLink: `https://reddit.com${(post.permalink as string) || ''}`,
              authorId,
              subreddit: (post.subreddit as string) ?? subreddit,
              postedAt: created ? new Date(created * 1000) : null,
            },
          });
          postId = newPost.id;
        }

        const existingLink = await entities.RedditBotProjectPost.findUnique({
          where: { projectId_postId: { projectId, postId } },
        });
        if (existingLink && (existingLink.status === 'RELEVANT' || existingLink.status === 'DISCARDED')) {
          continue; // already in a final state (AI said relevant or discarded)
        }

        const text = `${(existingPost?.title ?? post.title) ?? ''} ${(existingPost?.content ?? post.selftext) ?? ''}`;
        const matched = matchKeywords(text, projectKeywords);
        const isMatched = matched.length > 0;

        const aiAnalysisStatus = aiEnabled ? 'PENDING' : 'NOT_REQUESTED';
        const jobIdForPost = aiEnabled ? jobId : null;

        const shouldSetAiForUpdate =
          aiEnabled &&
          (!existingLink ||
            existingLink.aiAnalysisStatus === 'NOT_REQUESTED' ||
            existingLink.aiAnalysisStatus === 'PENDING');

        await entities.RedditBotProjectPost.upsert({
          where: { projectId_postId: { projectId, postId } },
          create: {
            projectId,
            postId,
            status: isMatched ? 'MATCH' : 'DOWNLOADED',
            matchedKeywords: matched.length ? matched : undefined,
            aiAnalysisStatus,
            jobId: jobIdForPost,
          },
          update: {
            status: isMatched ? 'MATCH' : 'DOWNLOADED',
            matchedKeywords: matched.length ? matched : undefined,
            ...(shouldSetAiForUpdate
              ? { aiAnalysisStatus: 'PENDING' as const, jobId: jobIdForPost }
              : {}),
          },
        });

        // totalProcessed = every post we process (incl. duplicates). uniqueCount/keywordMatchCount = only unique new links
        const isNewLink = !existingLink;
        const jobRow = await entities.RedditBotJob.findUnique({
          where: { id: jobId },
          select: { uniqueCount: true, keywordMatchCount: true, totalProcessed: true },
        });
        await entities.RedditBotJob.update({
          where: { id: jobId },
          data: {
            totalProcessed: (jobRow?.totalProcessed ?? 0) + 1,
            ...(isNewLink
              ? {
                  uniqueCount: (jobRow?.uniqueCount ?? 0) + 1,
                  keywordMatchCount: isMatched ? (jobRow?.keywordMatchCount ?? 0) + 1 : (jobRow?.keywordMatchCount ?? 0),
                }
              : {}),
          },
        });

        const updated = await entities.RedditBotJob.findUnique({
          where: { id: jobId },
          select: { uniqueCount: true, keywordMatchCount: true, stopRequestedAt: true },
        });
        if (maxPosts > 0 && (updated?.uniqueCount ?? 0) >= maxPosts) {
          await entities.RedditBotJob.update({
            where: { id: jobId },
            data: { status: 'COMPLETED', completedAt: new Date() },
          });
          return;
        }
        if (maxLeads > 0 && (updated?.keywordMatchCount ?? 0) >= maxLeads) {
          await entities.RedditBotJob.update({
            where: { id: jobId },
            data: { status: 'COMPLETED', completedAt: new Date() },
          });
          return;
        }
      }
    }
  }

  await entities.RedditBotJob.update({
    where: { id: jobId },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });
}
