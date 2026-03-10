import { redditExplorationJob } from 'wasp/server/jobs';

export const processRedditScheduleRunner = async (_args: any, context: any) => {
  const now = new Date();
  const schedules = await context.entities.RedditBotSchedule.findMany({
    where: {
      enabled: true,
      nextRunAt: { lte: now },
    },
    include: { project: true },
  });

  console.log(`[scheduleRunner] Found ${schedules.length} due schedule(s) at ${now.toISOString()}`);

  for (const schedule of schedules) {
    const config = (schedule.config as Record<string, unknown>) || {};
    const subreddits = (config.subreddits as string[]) ?? (schedule.project.subreddits as string[]) ?? [];
    const keywords = (config.keywords as string[]) ?? (schedule.project.keywords as string[]) ?? [];
    const range = (config.relativeDateRange as { start?: string; end?: string }) ?? { start: '-24h', end: 'now' };
    const maxPosts = (config.maxPostsToExplore as number) | 0;
    const maxLeads = (config.maxLeadsToFind as number) | 0;
    const strictKeywordSearch = config.strictKeywordSearch as boolean | undefined;

    const jobConfig = {
      subreddits: subreddits.length ? subreddits : ['all'],
      keywords,
      relativeDateRange: { start: range.start ?? '-24h', end: range.end ?? 'now' },
      maxPostsToExplore: maxPosts || undefined,
      maxLeadsToFind: maxLeads || undefined,
      strictKeywordSearch,
    };

    const job = await context.entities.RedditBotJob.create({
      data: {
        projectId: schedule.projectId,
        scheduleId: schedule.id,
        status: 'RUNNING',
        uniqueCount: 0,
        keywordMatchCount: 0,
        config: jobConfig,
      },
    });

    console.log(`[scheduleRunner] Submitting exploration for schedule ${schedule.id} -> job ${job.id} (project=${schedule.projectId}, user=${schedule.userId})`);
    await redditExplorationJob.submit({
      projectId: schedule.projectId,
      userId: schedule.userId,
      jobId: job.id,
      scheduleId: schedule.id,
      options: {
        subreddits: subreddits.length ? subreddits : ['all'],
        keywords,
        relativeDateRange: { start: range.start ?? '-24h', end: range.end ?? 'now' },
        maxPostsToExplore: maxPosts || undefined,
        maxLeadsToFind: maxLeads || undefined,
        strictKeywordSearch,
      },
    });

    let nextRun: Date | null = null;
    if (schedule.runAtTime) {
      const [h, m] = String(schedule.runAtTime).split(':').map(Number);
      nextRun = new Date(now);
      nextRun.setUTCHours(h || 0, m || 0, 0, 0);
      if (nextRun <= now) nextRun.setUTCDate(nextRun.getUTCDate() + 1);
    } else {
      nextRun = new Date(now);
      nextRun.setUTCHours(nextRun.getUTCHours() + 1, 0, 0, 0);
    }

    await context.entities.RedditBotSchedule.update({
      where: { id: schedule.id },
      data: { lastRunAt: now, nextRunAt: nextRun },
    });
  }
};
