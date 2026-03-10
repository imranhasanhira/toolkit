import { getSettings, getDecryptedOpenRouterApiKey } from '../reddit/redditCreditService';
import { evaluateRelevancy } from '../reddit/redditRelevancyService';

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
        data: { status: 'FAILED', errorMessage: 'AI not configured' },
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
          data: { status: 'FAILED', errorMessage: 'OpenRouter API key not set' },
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
  let run: { id: string; stopRequestedAt: Date | null; totalToProcess: number; processedCount: number } | null = null;

  if (args.runId) {
    run = await entities.RedditBotAiAnalysisRun.findUnique({
      where: { id: args.runId },
      select: { id: true, stopRequestedAt: true, totalToProcess: true, processedCount: true },
    });
    if (!run) return;
    if (run.stopRequestedAt) {
      await entities.RedditBotAiAnalysisRun.update({
        where: { id: args.runId },
        data: { status: 'KILLED' },
      });
      return;
    }
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
          data: { status: 'KILLED', processedCount: run.processedCount },
        });
        return;
      }
    }

    let projectPost: { id: string; projectId: string; postId: string; jobId: string | null } | null = null;

    if (args.jobId) {
      projectPost = await entities.RedditBotProjectPost.findFirst({
        where: {
          jobId: args.jobId,
          aiAnalysisStatus: { in: ['NOT_REQUESTED', 'PENDING'] },
        },
        select: { id: true, projectId: true, postId: true, jobId: true },
      });
    } else if (args.projectId) {
      const statuses = args.includeAlreadyProcessed
        ? (['NOT_REQUESTED', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'] as const)
        : (['NOT_REQUESTED', 'PENDING'] as const);
      const where: any = {
        projectId: args.projectId,
        aiAnalysisStatus: { in: statuses },
      };
      const fs = args.filterSnapshot;
      if (fs) {
        if (fs.status) where.status = fs.status;
        if (fs.subreddits?.length) {
          where.post = where.post || {};
          where.post.OR = fs.subreddits.map((s: string) => ({
            subreddit: { equals: s, mode: 'insensitive' as const },
          }));
        }
        if (fs.postedAfter || fs.postedBefore) {
          where.post = where.post || {};
          where.post.postedAt = {};
          if (fs.postedAfter) where.post.postedAt.gte = new Date(fs.postedAfter);
          if (fs.postedBefore) where.post.postedAt.lte = new Date(fs.postedBefore);
        }
      }
      projectPost = await entities.RedditBotProjectPost.findFirst({
        where,
        select: { id: true, projectId: true, postId: true, jobId: true, matchedKeywords: true },
      });
      if (projectPost && fs?.keywords?.length) {
        const mk = ((projectPost as any).matchedKeywords as string[]) ?? [];
        const matchesKw = mk.some((m: string) => fs.keywords!.some((k: string) => k.toLowerCase() === m.toLowerCase()));
        if (!matchesKw) {
          const allCandidates = await entities.RedditBotProjectPost.findMany({
            where,
            select: { id: true, projectId: true, postId: true, jobId: true, matchedKeywords: true },
            take: 200,
          });
          projectPost = allCandidates.find((pp: any) => {
            const ppMk = (pp.matchedKeywords as string[]) ?? [];
            return ppMk.some((m: string) => fs.keywords!.some((k: string) => k.toLowerCase() === m.toLowerCase()));
          }) ?? null;
        }
      }
    }

    if (!projectPost) break;

    await entities.RedditBotProjectPost.update({
      where: { id: projectPost.id },
      data: { aiAnalysisStatus: 'IN_PROGRESS' },
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
        data: { aiAnalysisStatus: 'FAILED' },
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
          aiAnalysisStatus: 'COMPLETED',
          status: result.relevant ? 'RELEVANT' : 'DISCARDED',
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
        data: { aiAnalysisStatus: 'FAILED', aiAnalysisErrorMessage: message },
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
    await entities.RedditBotAiAnalysisRun.update({
      where: { id: args.runId },
      data: {
        status: runRow?.stopRequestedAt ? 'KILLED' : 'COMPLETED',
        processedCount: run.processedCount,
      },
    });
  }
};
