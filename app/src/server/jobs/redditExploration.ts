import { runExploration } from '../reddit/explorationRunner';
import { getSettings, getDecryptedOpenRouterApiKey } from '../reddit/redditCreditService';
import { redditAiAnalysisJob } from 'wasp/server/jobs';
import { RedditBotJobStatus } from '@prisma/client';
import { AI_ANALYSIS_STATUSES_QUEUED } from '../../reddit-bot/redditBotAiStatusConstants';

export type RedditExplorationJobPayload = {
  projectId: string;
  userId: string;
  jobId: string;
  scheduleId?: string | null;
  options: {
    subreddits: string[];
    keywords: string[];
    relativeDateRange: { start: string; end: string };
    maxPostsToExplore?: number;
    maxLeadsToFind?: number;
    strictKeywordSearch?: boolean;
  };
};

export const processRedditExploration = async (
  args: RedditExplorationJobPayload,
  context: any
) => {
  const { projectId, jobId, options } = args;

  const project = await context.entities.RedditBotProject.findUnique({
    where: { id: projectId },
  });
  if (!project) {
    console.error(`[redditExploration] Project ${projectId} not found for job ${jobId}`);
    await context.entities.RedditBotJob.update({
      where: { id: jobId },
      data: { status: RedditBotJobStatus.FAILED, errorMessage: 'Project not found', completedAt: new Date() },
    });
    return;
  }
  if (project.userId !== args.userId) {
    const user = await context.entities.User.findUnique({
      where: { id: args.userId },
      select: { isAdmin: true },
    });
    if (!user?.isAdmin) {
      console.error(`[redditExploration] Access denied for user ${args.userId} on project ${projectId}`);
      await context.entities.RedditBotJob.update({
        where: { id: jobId },
        data: { status: RedditBotJobStatus.FAILED, errorMessage: 'Access denied', completedAt: new Date() },
      });
      return;
    }
  }

  try {
    await runExploration(projectId, jobId, options, context, args.userId);
    const settings = await getSettings(context.entities);
    const openrouterKey = await getDecryptedOpenRouterApiKey(context.entities);
    const aiReady =
      settings.ai.enabled &&
      (settings.ai.engine === 'openrouter'
        ? !!openrouterKey?.trim() && !!settings.ai.openrouter.model?.trim()
        : !!settings.ai.ollama.baseUrl?.trim() && !!settings.ai.ollama.model?.trim());
    if (aiReady) {
      const totalToProcess = await context.entities.RedditBotProjectPost.count({
        where: { jobId, aiAnalysisStatus: { in: ['NOT_REQUESTED', 'PENDING'] } },
      });
      const maxPosts = settings.ai.maxPostsPerAnalysisRun;
      if (totalToProcess > maxPosts) {
        console.warn(
          `[redditExploration] Skipping auto AI analysis for job ${jobId}: ${totalToProcess} posts exceed limit of ${maxPosts}. Run AI analysis manually with narrower filters.`
        );
      } else {
        const run = await context.entities.RedditBotAiAnalysisRun.create({
          data: {
            projectId,
            triggerSource: 'exploration',
            explorationJobId: jobId,
            status: 'RUNNING',
            totalToProcess,
            processedCount: 0,
          },
        });
        await redditAiAnalysisJob.submit({ runId: run.id, jobId });
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[redditExploration] Job ${jobId} failed:`, err);
    await context.entities.RedditBotJob.update({
      where: { id: jobId },
      data: {
        status: RedditBotJobStatus.FAILED,
        errorMessage: message.slice(0, 1000),
        completedAt: new Date(),
      },
    });
    // Do not rethrow: we've recorded failure in our DB. Resolving here ensures PgBoss
    // marks this job as done and frees the worker so the next job (e.g. a second
    // exploration) is picked up. Rethrowing can leave this job stuck "active" and
    // block the queue.
  }
};
