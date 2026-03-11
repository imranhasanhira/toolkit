import { fetchSubredditNew, fetchSubredditSearch, type RedditListingPost } from './redditClient';
import { resolveRelativeDateRange } from './relativeDate';
import {
  getSettings,
  getDecryptedOpenRouterApiKey,
  deductCredit,
  InsufficientRedditCreditError,
  toNum,
} from './redditCreditService';
import { getRedditLimiter } from './redditLimiter';
import { RedditBotJobStatus, RedditBotProjectPostStatus, RedditBotAiAnalysisStatus } from '@prisma/client';

const SAFETY_TIMEOUT_MS = 35_000;

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
        ? (after: string | null, signal?: AbortSignal) =>
          fetchSubredditSearch(subreddit, keywords.join(' OR '), after, 100, signal)
        : (after: string | null, signal?: AbortSignal) =>
          fetchSubredditNew(subreddit, after, 100, signal);

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
          data: { status: RedditBotJobStatus.KILLED, completedAt: now },
        });
        return;
      }
      if (maxPosts > 0 && job && job.uniqueCount >= maxPosts) {
        await entities.RedditBotJob.update({
          where: { id: jobId },
          data: { status: RedditBotJobStatus.COMPLETED, completedAt: now },
        });
        return;
      }
      if (maxLeads > 0 && job && job.keywordMatchCount >= maxLeads) {
        await entities.RedditBotJob.update({
          where: { id: jobId },
          data: { status: RedditBotJobStatus.COMPLETED, completedAt: now },
        });
        return;
      }

      const settingsPage = await getSettings(entities);
      const creditPerCall = settingsPage.credits.perApiCall || 1;
      try {
        await deductCredit(entities, userId, creditPerCall, 'reddit_api_call', jobId);
      } catch (err) {
        if (err instanceof InsufficientRedditCreditError) {
          console.warn(`[exploration] job=${jobId} insufficient credit, marking FAILED`);
          await entities.RedditBotJob.update({
            where: { id: jobId },
            data: {
              status: RedditBotJobStatus.FAILED,
              errorMessage: err.message || 'Insufficient Reddit credit',
              completedAt: now,
            },
          });
          return;
        }
        throw err;
      }

      let listing;
      const maxAttempts = 3;
      let attempt = 0;
      while (true) {
        attempt += 1;
        const attemptController = new AbortController();
        let safetyTimeoutId: ReturnType<typeof setTimeout> | null = null;
        try {
          // The function inside schedule() executes only when Bottleneck grants the slot.
          const schedulePromise = limiter.schedule<any>(async () => {

            const safetyPromise = new Promise<never>((_, reject) => {
              safetyTimeoutId = setTimeout(() => {
                attemptController.abort();
                reject(
                  new Error(
                    `Reddit API request timed out (safety: ${SAFETY_TIMEOUT_MS / 1000}s). The fetch may have hung without triggering its own AbortController.`
                  )
                );
              }, SAFETY_TIMEOUT_MS);
            });

            // Race the actual fetch against the safety timeout INSIDE the Bottleneck lock
            // If the timeout wins, the returned promise rejects -> Bottleneck frees the slot.
            const pagePromise = fetchPage(after, attemptController.signal);

            // Swallow dangling rejections if safety timeout wins (avoids Node warnings)
            pagePromise.catch(() => { });

            return await Promise.race([pagePromise, safetyPromise]);
          });

          // Wait for either the queueing process or the execution itself to finish/fail
          listing = await schedulePromise;

          if (safetyTimeoutId) clearTimeout(safetyTimeoutId);
          break;
        } catch (err) {
          if (safetyTimeoutId) clearTimeout(safetyTimeoutId);
          attemptController.abort();

          const message = err instanceof Error ? err.message : String(err);
          const isAborted = message === 'Reddit API request aborted.';
          const isFetchTimeout = message.startsWith('Reddit API request timed out');
          const isRedditApiError = message.startsWith('Reddit API error:');

          if (isRedditApiError) {
            console.error(
              `[exploration] job=${jobId} Reddit API error (non-retryable), aborting job:`,
              err
            );
            throw new Error(
              `Reddit exploration failed due to Reddit API error: ${message}`.slice(0, 1000)
            );
          }

          const isTransient = isFetchTimeout || isAborted || !isRedditApiError;
          if (!isTransient || attempt >= maxAttempts) {
            console.error(
              `[exploration] job=${jobId} Reddit API call failed after ${attempt} attempt(s), aborting job:`,
              err
            );
            throw new Error(
              `Reddit exploration failed after ${attempt} attempt(s): ${message}`.slice(0, 1000)
            );
          }

          const baseDelayMs = 1000 * Math.pow(2, attempt - 1);
          const jitterMs = Math.floor(Math.random() * 500);
          const delayMs = baseDelayMs + jitterMs;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
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
        if (
          existingLink &&
          (existingLink.status === RedditBotProjectPostStatus.RELEVANT ||
            existingLink.status === RedditBotProjectPostStatus.DISCARDED)
        ) {
          continue; // already in a final state (AI said relevant or discarded)
        }

        const text = `${(existingPost?.title ?? post.title) ?? ''} ${(existingPost?.content ?? post.selftext) ?? ''}`;
        const matched = matchKeywords(text, projectKeywords);
        const isMatched = matched.length > 0;

        const aiAnalysisStatus = aiEnabled ? RedditBotAiAnalysisStatus.PENDING : RedditBotAiAnalysisStatus.NOT_REQUESTED;
        const jobIdForPost = aiEnabled ? jobId : null;

        const shouldSetAiForUpdate =
          aiEnabled &&
          (!existingLink ||
            existingLink.aiAnalysisStatus === RedditBotAiAnalysisStatus.NOT_REQUESTED ||
            existingLink.aiAnalysisStatus === RedditBotAiAnalysisStatus.PENDING);
        const skippedAiAlreadyAnalysed = aiEnabled && !!existingLink && !shouldSetAiForUpdate;

        await entities.RedditBotProjectPost.upsert({
          where: { projectId_postId: { projectId, postId } },
          create: {
            projectId,
            postId,
            status: isMatched ? RedditBotProjectPostStatus.MATCH : RedditBotProjectPostStatus.DOWNLOADED,
            matchedKeywords: matched.length ? matched : undefined,
            aiAnalysisStatus,
            jobId: jobIdForPost,
          },
          update: {
            status: isMatched ? RedditBotProjectPostStatus.MATCH : RedditBotProjectPostStatus.DOWNLOADED,
            matchedKeywords: matched.length ? matched : undefined,
            ...(shouldSetAiForUpdate
              ? { aiAnalysisStatus: RedditBotAiAnalysisStatus.PENDING, jobId: jobIdForPost }
              : {}),
          },
        });

        // totalProcessed = every post we process (incl. duplicates). uniqueCount/keywordMatchCount = only unique new links
        const isNewLink = !existingLink;
        const jobRow = await entities.RedditBotJob.findUnique({
          where: { id: jobId },
          select: { uniqueCount: true, keywordMatchCount: true, totalProcessed: true, aiAnalysisSkippedCount: true },
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
            ...(skippedAiAlreadyAnalysed
              ? { aiAnalysisSkippedCount: (jobRow?.aiAnalysisSkippedCount ?? 0) + 1 }
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
            data: { status: RedditBotJobStatus.COMPLETED, completedAt: new Date() },
          });
          return;
        }
        if (maxLeads > 0 && (updated?.keywordMatchCount ?? 0) >= maxLeads) {
          await entities.RedditBotJob.update({
            where: { id: jobId },
            data: { status: RedditBotJobStatus.COMPLETED, completedAt: new Date() },
          });
          return;
        }
      }
    }
  }

  await entities.RedditBotJob.update({
    where: { id: jobId },
    data: { status: RedditBotJobStatus.COMPLETED, completedAt: new Date() },
  });
}
