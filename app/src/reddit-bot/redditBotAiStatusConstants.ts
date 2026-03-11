import { RedditBotAiAnalysisStatus } from '@prisma/client';

/** All AI analysis statuses (for manual run: process every post regardless of status). */
export const AI_ANALYSIS_STATUSES_ALL: RedditBotAiAnalysisStatus[] = Object.values(RedditBotAiAnalysisStatus);

/** Statuses that mean "not yet sent to AI" or "queued" — exploration auto-AI picks these. */
export const AI_ANALYSIS_STATUSES_QUEUED: readonly [RedditBotAiAnalysisStatus, RedditBotAiAnalysisStatus] = [
  RedditBotAiAnalysisStatus.NOT_REQUESTED,
  RedditBotAiAnalysisStatus.PENDING,
];
