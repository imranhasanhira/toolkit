import { redditAiAnalysisJob } from 'wasp/server/jobs';
import { getSettings, getDecryptedOpenRouterApiKey } from '../reddit/redditCreditService';
import { evaluateRelevancy } from '../reddit/redditRelevancyService';
import {
  RedditBotAiAnalysisStatus,
  RedditBotProjectPostStatus,
  RedditBotAiAnalysisRunStatus,
} from '@prisma/client';
import { AI_ANALYSIS_STATUSES_QUEUED } from '../../reddit-bot/redditBotAiStatusConstants';

export type RedditAiAnalysisJobPayload = {
  runId?: string;
  jobId?: string;
  projectId?: string;
  includeAlreadyProcessed?: boolean;
  filterSnapshot?: {
    status?: string;
    subreddits?: string[];
    keywords?: string[];
    postedAfter?: string;
    postedBefore?: string;
  };
};

const BATCH_CAP = 100;
const STALE_IN_PROGRESS_MS = 10 * 60 * 1000;
const CANDIDATE_PAGE = 200;

function keywordsMatch(matchedKeywords: unknown, filterKeywords: string[]): boolean {
  const mk = (matchedKeywords as string[]) ?? [];
  return mk.some((m) => filterKeywords.some((k) => k.toLowerCase() === m.toLowerCase()));
}

function analysisWhere(args: RedditAiAnalysisJobPayload, runStartedAt?: Date | null): any | null {
  if (args.jobId) {
    return {
      jobId: args.jobId,
      aiAnalysisStatus: { in: [...AI_ANALYSIS_STATUSES_QUEUED] },
    };
  }
  if (!args.projectId) return null;
  const where: any = { projectId: args.projectId };
  const and: any[] = [];
  if (args.includeAlreadyProcessed && runStartedAt) {
    // Each post is processed once per run: already-finished rows only if they
    // were last updated before this run started.
    and.push({
      OR: [
        { aiAnalysisStatus: { in: [...AI_ANALYSIS_STATUSES_QUEUED] } },
        {
          aiAnalysisStatus: {
            in: [RedditBotAiAnalysisStatus.COMPLETED, RedditBotAiAnalysisStatus.FAILED],
          },
          updatedAt: { lt: runStartedAt },
        },
      ],
    });
  } else {
    where.aiAnalysisStatus = { in: [...AI_ANALYSIS_STATUSES_QUEUED] };
  }
  const fs = args.filterSnapshot;
  if (fs) {
    if (fs.status) where.status = fs.status;
    if (fs.subreddits?.length) {
      and.push({
        post: {
          OR: fs.subreddits.map((s: string) => ({
            subreddit: { equals: s, mode: 'insensitive' as const },
          })),
        },
      });
    }
    if (fs.postedAfter || fs.postedBefore) {
      const postedAt: any = {};
      if (fs.postedAfter) postedAt.gte = new Date(fs.postedAfter);
      if (fs.postedBefore) postedAt.lte = new Date(fs.postedBefore);
      and.push({ post: { postedAt } });
    }
  }
  if (and.length) where.AND = and;
  return where;
}

async function findNextAnalysisPost(entities: any, args: RedditAiAnalysisJobPayload, runStartedAt?: Date | null) {
  const where = analysisWhere(args, runStartedAt);
  if (!where) return null;
  const filterKeywords = args.filterSnapshot?.keywords;
  const select = { id: true, projectId: true, postId: true, jobId: true, matchedKeywords: true };
  let skip = 0;
  while (true) {
    const page = await entities.RedditBotProjectPost.findMany({
      where,
      select,
      orderBy: { createdAt: 'asc' },
      take: CANDIDATE_PAGE,
      skip,
    });
    if (page.length === 0) return null;
    if (!filterKeywords?.length) return page[0];
    const match = page.find((pp: { matchedKeywords: unknown }) => keywordsMatch(pp.matchedKeywords, filterKeywords));
    if (match) return match;
    if (page.length < CANDIDATE_PAGE) return null;
    skip += CANDIDATE_PAGE;
  }
}

export const processRedditAiAnalysis = async (
  args: RedditAiAnalysisJobPayload,
  context: any
) => {
  const { entities } = context;
  const settings = await getSettings(entities);
  const aiConfigured =
    settings.ai.enabled &&
    (settings.ai.engine === 'openrouter'
      ? (await getDecryptedOpenRouterApiKey(entities)) && !!settings.ai.openrouter.model?.trim()
      : !!settings.ai.ollama.baseUrl?.trim() && !!settings.ai.ollama.model?.trim());
  if (!aiConfigured) {
    if (args.runId) {
      await entities.RedditBotAiAnalysisRun.update({
        where: { id: args.runId },
        data: { status: RedditBotAiAnalysisRunStatus.FAILED, errorMessage: 'AI not configured' },
      });
    }
    return;
  }

  let relevancyOptions: { engine: 'ollama'; baseUrl: string; model: string; disableThinking: boolean } | { engine: 'openrouter'; baseUrl: string; apiKey: string; model: string; disableThinking: boolean };
  if (settings.ai.engine === 'openrouter') {
    const apiKey = await getDecryptedOpenRouterApiKey(entities);
    if (!apiKey?.trim()) {
      if (args.runId) {
        await entities.RedditBotAiAnalysisRun.update({
          where: { id: args.runId },
          data: { status: RedditBotAiAnalysisRunStatus.FAILED, errorMessage: 'OpenRouter API key not set' },
        });
      }
      return;
    }
    relevancyOptions = {
      engine: 'openrouter',
      baseUrl: settings.ai.openrouter.baseUrl?.trim() || 'https://openrouter.ai/api/v1',
      apiKey: apiKey.trim(),
      model: settings.ai.openrouter.model!.trim(),
      disableThinking: settings.ai.openrouter.disableThinking,
    };
  } else {
    relevancyOptions = {
      engine: 'ollama',
      baseUrl: settings.ai.ollama.baseUrl!.trim(),
      model: settings.ai.ollama.model!.trim(),
      disableThinking: settings.ai.ollama.disableThinking,
    };
  }

  let processed = 0;
  let run: { id: string; createdAt: Date; stopRequestedAt: Date | null; totalToProcess: number; processedCount: number } | null = null;

  if (args.runId) {
    run = await entities.RedditBotAiAnalysisRun.findUnique({
      where: { id: args.runId },
      select: { id: true, createdAt: true, stopRequestedAt: true, totalToProcess: true, processedCount: true },
    });
    if (!run) return;
    if (run.stopRequestedAt) {
      await entities.RedditBotAiAnalysisRun.update({
        where: { id: args.runId },
        data: { status: RedditBotAiAnalysisRunStatus.KILLED },
      });
      return;
    }
  }

  const reclaimWhere: any = {
    aiAnalysisStatus: RedditBotAiAnalysisStatus.IN_PROGRESS,
  };
  if (args.jobId) {
    reclaimWhere.jobId = args.jobId;
  } else if (args.projectId) {
    reclaimWhere.projectId = args.projectId;
    reclaimWhere.updatedAt = { lt: new Date(Date.now() - STALE_IN_PROGRESS_MS) };
  }
  if (args.jobId || args.projectId) {
    await entities.RedditBotProjectPost.updateMany({
      where: reclaimWhere,
      data: { aiAnalysisStatus: RedditBotAiAnalysisStatus.PENDING },
    });
  }

  while (processed < BATCH_CAP) {
    if (run) {
      const current = await entities.RedditBotAiAnalysisRun.findUnique({
        where: { id: run.id },
        select: { stopRequestedAt: true },
      });
      if (current?.stopRequestedAt) {
        await entities.RedditBotAiAnalysisRun.update({
          where: { id: run.id },
          data: { status: RedditBotAiAnalysisRunStatus.KILLED, processedCount: run.processedCount },
        });
        return;
      }
    }

    const projectPost = await findNextAnalysisPost(entities, args, run?.createdAt);

    if (!projectPost) break;

    await entities.RedditBotProjectPost.update({
      where: { id: projectPost.id },
      data: { aiAnalysisStatus: RedditBotAiAnalysisStatus.IN_PROGRESS },
    });

    const project = await entities.RedditBotProject.findUnique({
      where: { id: projectPost.projectId },
      select: { productDescription: true },
    });
    const post = await entities.RedditBotPost.findUnique({
      where: { id: projectPost.postId },
      select: { title: true, content: true, postLink: true },
    });

    if (!project || !post) {
      await entities.RedditBotProjectPost.update({
        where: { id: projectPost.id },
        data: { aiAnalysisStatus: RedditBotAiAnalysisStatus.FAILED },
      });
      processed++;
      if (run) {
        run.processedCount++;
        await entities.RedditBotAiAnalysisRun.update({
          where: { id: run.id },
          data: { processedCount: run.processedCount },
        });
      }
      continue;
    }

    const postText = `${post.title ?? ''} ${post.content ?? ''}`.trim();

    try {
      const result = await evaluateRelevancy(
        project.productDescription ?? '',
        postText,
        relevancyOptions,
        post.postLink
      );

      await entities.RedditBotProjectPost.update({
        where: { id: projectPost.id },
        data: {
          aiAnalysisStatus: RedditBotAiAnalysisStatus.COMPLETED,
          status: result.relevant ? RedditBotProjectPostStatus.RELEVANT : RedditBotProjectPostStatus.DISCARDED,
          painPointSummary: result.painPointSummary ?? null,
          aiReasoning: result.reasoning ?? null,
        },
      });

      // keywordMatchCount on the job is exploration-only (keyword matches); we don't update it here when AI says relevant
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Reddit AI analysis failed for projectPost', projectPost.id, err);
      await entities.RedditBotProjectPost.update({
        where: { id: projectPost.id },
        data: { aiAnalysisStatus: RedditBotAiAnalysisStatus.FAILED, aiAnalysisErrorMessage: message },
      });
    }

    processed++;
    if (run) {
      run.processedCount++;
      await entities.RedditBotAiAnalysisRun.update({
        where: { id: run.id },
        data: { processedCount: run.processedCount },
      });
    }
  }

  if (run && args.runId) {
    const runRow = await entities.RedditBotAiAnalysisRun.findUnique({
      where: { id: args.runId },
      select: { stopRequestedAt: true },
    });
    if (runRow?.stopRequestedAt) {
      await entities.RedditBotAiAnalysisRun.update({
        where: { id: args.runId },
        data: { status: RedditBotAiAnalysisRunStatus.KILLED, processedCount: run.processedCount },
      });
      return;
    }
    if (processed >= BATCH_CAP) {
      const more = await findNextAnalysisPost(entities, args, run?.createdAt);
      if (more) {
        await redditAiAnalysisJob.submit(args);
        return;
      }
    }
    await entities.RedditBotAiAnalysisRun.update({
      where: { id: args.runId },
      data: {
        status: RedditBotAiAnalysisRunStatus.COMPLETED,
        processedCount: run.processedCount,
      },
    });
  }
};
