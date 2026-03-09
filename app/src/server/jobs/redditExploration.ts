import { runExploration } from '../reddit/explorationRunner';
import { getSettings } from '../reddit/redditCreditService';
import { redditAiAnalysisJob } from 'wasp/server/jobs';

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
    await context.entities.RedditBotJob.update({
      where: { id: jobId },
      data: { status: 'FAILED', errorMessage: 'Project not found', completedAt: new Date() },
    });
    return;
  }
  if (project.userId !== args.userId) {
    const user = await context.entities.User.findUnique({
      where: { id: args.userId },
      select: { isAdmin: true },
    });
    if (!user?.isAdmin) {
      await context.entities.RedditBotJob.update({
        where: { id: jobId },
        data: { status: 'FAILED', errorMessage: 'Access denied', completedAt: new Date() },
      });
      return;
    }
  }

  try {
    await runExploration(projectId, jobId, options, context, args.userId);
    const settings = await getSettings(context.entities);
    if (
      settings.ai.enabled &&
      settings.ai.ollama.baseUrl?.trim() &&
      settings.ai.ollama.model?.trim()
    ) {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await context.entities.RedditBotJob.update({
      where: { id: jobId },
      data: { status: 'FAILED', errorMessage: message, completedAt: new Date() },
    });
    throw err;
  }
};
