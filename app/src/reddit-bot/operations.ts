import type {
  RedditBotProject,
  RedditBotProjectPost,
  RedditBotSchedule,
  RedditBotJob,
} from 'wasp/entities';
import { HttpError } from 'wasp/server';
import { redditExplorationJob, redditAiAnalysisJob } from 'wasp/server/jobs';
import { toNum, getSettings, getDecryptedOpenRouterApiKey } from '../server/reddit/redditCreditService';
import { evaluateRelevancy } from '../server/reddit/redditRelevancyService';
import { requireAppAccess } from '../server/appPermissions';
import { APP_KEYS } from '../shared/appKeys';
import { z } from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../server/validation';

/**
 * Ensures the user is the project owner or an admin. Call this for every operation
 * that reads or mutates project-scoped data (project, posts, schedules, jobs).
 * RedditBotProject.userId is the creator; admins can access any project.
 */
function ensureProjectAccess(
  project: { userId: string } | null,
  userId: string,
  isAdmin?: boolean
) {
  if (!project) throw new HttpError(404, 'Project not found');
  if (project.userId !== userId && !isAdmin)
    throw new HttpError(403, 'Access denied to this project');
}

// --- List projects (owner only, or all for admin)
export const getRedditBotProjects = async (_args: void, context: any) => {
  if (!context.user) throw new HttpError(401, 'Not authorized');
  await requireAppAccess(context.user.id, APP_KEYS.REDDIT_BOT, context.user.isAdmin);

  const where = context.user.isAdmin
    ? {}
    : { userId: context.user.id };

  return context.entities.RedditBotProject.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  }) as Promise<RedditBotProject[]>;
};

// --- Get single project (ownership or admin)
export const getRedditBotProjectById = async (
  args: { projectId: string },
  context: any
) => {
  if (!context.user) throw new HttpError(401, 'Not authorized');
  await requireAppAccess(context.user.id, APP_KEYS.REDDIT_BOT, context.user.isAdmin);

  const project = await context.entities.RedditBotProject.findUnique({
    where: { id: args.projectId },
  });
  ensureProjectAccess(project, context.user.id, context.user.isAdmin);
  return project as RedditBotProject;
};

export const getRedditBotProjectCreditUsed = async (
  args: { projectId: string },
  context: any
) => {
  if (!context.user) throw new HttpError(401, 'Not authorized');
  await requireAppAccess(context.user.id, APP_KEYS.REDDIT_BOT, context.user.isAdmin);

  const project = await context.entities.RedditBotProject.findUnique({
    where: { id: args.projectId },
    select: { userId: true },
  });
  ensureProjectAccess(project, context.user.id, context.user.isAdmin);

  const result = await context.entities.RedditBotJob.aggregate({
    where: { projectId: args.projectId },
    _sum: { redditCreditsUsed: true },
  });
  return { creditsUsed: toNum(result._sum?.redditCreditsUsed) };
};

const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  productDescription: z.string().optional(),
  subreddits: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
});

export const createRedditBotProject = async (
  rawArgs: z.infer<typeof createProjectSchema>,
  context: any
) => {
  if (!context.user) throw new HttpError(401, 'Not authorized');
  await requireAppAccess(context.user.id, APP_KEYS.REDDIT_BOT, context.user.isAdmin);

  const args = ensureArgsSchemaOrThrowHttpError(createProjectSchema, rawArgs);

  return context.entities.RedditBotProject.create({
    data: {
      userId: context.user.id,
      name: args.name.trim(),
      description: args.description?.trim() || null,
      productDescription: args.productDescription?.trim() ?? '',
      subreddits: args.subreddits,
      keywords: args.keywords,
    },
  }) as Promise<RedditBotProject>;
};

const updateProjectSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  productDescription: z.string().optional(),
  subreddits: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
});

export const updateRedditBotProject = async (
  rawArgs: z.infer<typeof updateProjectSchema>,
  context: any
) => {
  if (!context.user) throw new HttpError(401, 'Not authorized');
  await requireAppAccess(context.user.id, APP_KEYS.REDDIT_BOT, context.user.isAdmin);

  const args = ensureArgsSchemaOrThrowHttpError(updateProjectSchema, rawArgs);
  const project = await context.entities.RedditBotProject.findUnique({
    where: { id: args.id },
  });
  ensureProjectAccess(project, context.user.id, context.user.isAdmin);

  const data: Record<string, unknown> = {};
  if (args.name !== undefined) data.name = args.name.trim();
  if (args.description !== undefined) data.description = args.description ?? null;
  if (args.productDescription !== undefined) data.productDescription = args.productDescription;
  if (args.subreddits !== undefined) data.subreddits = args.subreddits;
  if (args.keywords !== undefined) data.keywords = args.keywords;

  return context.entities.RedditBotProject.update({
    where: { id: args.id },
    data,
  }) as Promise<RedditBotProject>;
};

export const deleteRedditBotProject = async (
  args: { id: string },
  context: any
) => {
  if (!context.user) throw new HttpError(401, 'Not authorized');
  await requireAppAccess(context.user.id, APP_KEYS.REDDIT_BOT, context.user.isAdmin);

  const project = await context.entities.RedditBotProject.findUnique({
    where: { id: args.id },
  });
  ensureProjectAccess(project, context.user.id, context.user.isAdmin);

  await context.entities.RedditBotProject.delete({
    where: { id: args.id },
  });
};

// --- Project posts (list with filters, cursor pagination)
const getProjectPostsSchema = z.object({
  projectId: z.string(),
  status: z.enum(['DOWNLOADED', 'MATCH', 'RELEVANT', 'DISCARDED']).optional(),
  subreddits: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  postedAfter: z.string().datetime().optional(),
  postedBefore: z.string().datetime().optional(),
  fetchedAfter: z.string().datetime().optional(),
  fetchedBefore: z.string().datetime().optional(),
  sortBy: z.enum(['postedAt', 'createdAt']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  cursor: z.string().optional(),
  take: z.number().int().min(1).max(500).optional(),
});

function buildPostsWhere(args: {
  projectId: string;
  status?: string;
  subreddits?: string[];
  keywords?: string[];
  postedAfter?: string;
  postedBefore?: string;
  fetchedAfter?: string;
  fetchedBefore?: string;
}) {
  const where: any = { projectId: args.projectId };
  if (args.status) where.status = args.status;
  if (args.subreddits?.length) {
    where.post = where.post || {};
    where.post.OR = args.subreddits.map((s: string) => ({
      subreddit: { equals: s, mode: 'insensitive' as const },
    }));
  }
  if (args.postedAfter || args.postedBefore) {
    where.post = where.post || {};
    where.post.postedAt = where.post.postedAt || {};
    if (args.postedAfter) where.post.postedAt.gte = new Date(args.postedAfter);
    if (args.postedBefore) where.post.postedAt.lte = new Date(args.postedBefore);
  }
  if (args.fetchedAfter || args.fetchedBefore) {
    where.createdAt = {};
    if (args.fetchedAfter) where.createdAt.gte = new Date(args.fetchedAfter);
    if (args.fetchedBefore) where.createdAt.lte = new Date(args.fetchedBefore);
  }
  return where;
}

export const getRedditBotProjectPosts = async (
  rawArgs: z.infer<typeof getProjectPostsSchema>,
  context: any
) => {
  if (!context.user) throw new HttpError(401, 'Not authorized');
  await requireAppAccess(context.user.id, APP_KEYS.REDDIT_BOT, context.user.isAdmin);

  const args = ensureArgsSchemaOrThrowHttpError(getProjectPostsSchema, rawArgs);
  const project = await context.entities.RedditBotProject.findUnique({
    where: { id: args.projectId },
  });
  ensureProjectAccess(project, context.user.id, context.user.isAdmin);

  const where = buildPostsWhere({
    projectId: args.projectId,
    status: args.status,
    subreddits: args.subreddits,
    postedAfter: args.postedAfter,
    postedBefore: args.postedBefore,
    fetchedAfter: args.fetchedAfter,
    fetchedBefore: args.fetchedBefore,
  });

  const sortBy = args.sortBy ?? 'postedAt';
  const order = args.order ?? 'desc';
  const orderBy =
    sortBy === 'postedAt'
      ? [{ post: { postedAt: order } }, { id: order }] as const
      : ([{ createdAt: order }, { id: order }] as const);

  const take = args.take ?? 20;
  const hasKeywordFilter = (args.keywords?.length ?? 0) > 0;

  let list: any[];
  let total: number;
  let nextCursor: string | null = null;

  if (hasKeywordFilter) {
    const fullList = await context.entities.RedditBotProjectPost.findMany({
      where,
      orderBy,
      include: { post: { include: { author: true } } },
      take: 2000,
    });
    const filtered = fullList.filter((pp: any) => {
      const mk = pp.matchedKeywords as string[] | null;
      if (!mk || !Array.isArray(mk)) return false;
      const mkLower = mk.map((m: string) => m.toLowerCase());
      return args.keywords!.some((k) => mkLower.includes(k.toLowerCase()));
    });
    total = filtered.length;
    let start = 0;
    if (args.cursor) {
      const idx = filtered.findIndex((pp: any) => pp.id === args.cursor);
      if (idx >= 0) start = idx + 1;
    }
    list = filtered.slice(start, start + take);
    if (start + list.length < total && list.length === take) {
      nextCursor = list[list.length - 1]?.id ?? null;
    }
  } else {
    total = await context.entities.RedditBotProjectPost.count({ where });
    const cursorPayload = args.cursor ? { id: args.cursor } : undefined;
    list = await context.entities.RedditBotProjectPost.findMany({
      where,
      orderBy,
      include: { post: { include: { author: true } } },
      take: take + 1,
      ...(cursorPayload ? { cursor: cursorPayload, skip: 1 } : {}),
    });
    if (list.length > take) {
      nextCursor = list[take - 1]?.id ?? null;
      list = list.slice(0, take);
    }
  }

  return { items: list, nextCursor, total };
};

const updatePostStatusSchema = z.object({
  projectPostId: z.string(),
  status: z.enum(['DOWNLOADED', 'MATCH', 'RELEVANT', 'DISCARDED']),
  painPointSummary: z.string().optional(),
});

export const updateRedditBotProjectPostStatus = async (
  rawArgs: z.infer<typeof updatePostStatusSchema>,
  context: any
) => {
  if (!context.user) throw new HttpError(401, 'Not authorized');
  await requireAppAccess(context.user.id, APP_KEYS.REDDIT_BOT, context.user.isAdmin);

  const args = ensureArgsSchemaOrThrowHttpError(updatePostStatusSchema, rawArgs);
  const row = await context.entities.RedditBotProjectPost.findUnique({
    where: { id: args.projectPostId },
    include: { project: true },
  });
  if (!row) throw new HttpError(404, 'Project post not found');
  ensureProjectAccess(row.project, context.user.id, context.user.isAdmin);

  await context.entities.RedditBotProjectPost.update({
    where: { id: args.projectPostId },
    data: {
      status: args.status,
      ...(args.painPointSummary !== undefined && { painPointSummary: args.painPointSummary }),
    },
  });
};

const analyzeProjectPostSchema = z.object({
  projectPostId: z.string(),
});

/** Run AI relevancy analysis for a single post. Fire-and-forget from client; progress = loading until request completes. */
export const analyzeRedditBotProjectPost = async (
  rawArgs: z.infer<typeof analyzeProjectPostSchema>,
  context: any
) => {
  if (!context.user) throw new HttpError(401, 'Not authorized');
  await requireAppAccess(context.user.id, APP_KEYS.REDDIT_BOT, context.user.isAdmin);

  const args = ensureArgsSchemaOrThrowHttpError(analyzeProjectPostSchema, rawArgs);

  const projectPost = await context.entities.RedditBotProjectPost.findUnique({
    where: { id: args.projectPostId },
    include: { project: true, post: true },
  });
  if (!projectPost) throw new HttpError(404, 'Project post not found');
  ensureProjectAccess(projectPost.project, context.user.id, context.user.isAdmin);

  const settings = await getSettings(context.entities);
  const openrouterKey = await getDecryptedOpenRouterApiKey(context.entities);
  const aiConfigured =
    settings.ai.enabled &&
    (settings.ai.engine === 'openrouter'
      ? !!openrouterKey?.trim() && !!settings.ai.openrouter.model?.trim()
      : !!settings.ai.ollama.baseUrl?.trim() && !!settings.ai.ollama.model?.trim());
  if (!aiConfigured) {
    throw new HttpError(400, 'AI not configured. Configure Ollama or OpenRouter in Admin → Reddit credits.');
  }

  const relevancyOptions =
    settings.ai.engine === 'openrouter'
      ? {
          engine: 'openrouter' as const,
          baseUrl: settings.ai.openrouter.baseUrl?.trim() || 'https://openrouter.ai/api/v1',
          apiKey: openrouterKey!.trim(),
          model: settings.ai.openrouter.model!.trim(),
          disableThinking: settings.ai.openrouter.disableThinking,
        }
      : {
          engine: 'ollama' as const,
          baseUrl: settings.ai.ollama.baseUrl!.trim(),
          model: settings.ai.ollama.model!.trim(),
          disableThinking: settings.ai.ollama.disableThinking,
        };

  await context.entities.RedditBotProjectPost.update({
    where: { id: args.projectPostId },
    data: { aiAnalysisStatus: 'IN_PROGRESS' },
  });

  const postText = `${projectPost.post?.title ?? ''} ${projectPost.post?.content ?? ''}`.trim();
  const productDescription = (projectPost.project as { productDescription?: string })?.productDescription ?? '';

  try {
    const result = await evaluateRelevancy(
      productDescription,
      postText,
      relevancyOptions,
      projectPost.post?.postLink
    );
    await context.entities.RedditBotProjectPost.update({
      where: { id: args.projectPostId },
      data: {
        aiAnalysisStatus: 'COMPLETED',
        status: result.relevant ? 'RELEVANT' : 'DISCARDED',
        painPointSummary: result.painPointSummary ?? null,
        aiReasoning: result.reasoning ?? null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await context.entities.RedditBotProjectPost.update({
      where: { id: args.projectPostId },
      data: { aiAnalysisStatus: 'FAILED', aiAnalysisErrorMessage: message },
    });
    throw new HttpError(500, message);
  }
};

// --- Export TSV (returns rows for client to build TSV; includes id for mark-as-exported)
const getExportPostsSchema = z.object({
  projectId: z.string(),
  status: z.enum(['DOWNLOADED', 'MATCH', 'RELEVANT', 'DISCARDED']).optional(),
  subreddits: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  postedAfter: z.string().datetime().optional(),
  postedBefore: z.string().datetime().optional(),
  fetchedAfter: z.string().datetime().optional(),
  fetchedBefore: z.string().datetime().optional(),
  onlyUnexported: z.boolean().optional(),
  relevantOnly: z.boolean().optional(),
});

export const getRedditBotProjectPostsForExport = async (
  rawArgs: z.infer<typeof getExportPostsSchema>,
  context: any
) => {
  if (!context.user) throw new HttpError(401, 'Not authorized');
  await requireAppAccess(context.user.id, APP_KEYS.REDDIT_BOT, context.user.isAdmin);

  const args = ensureArgsSchemaOrThrowHttpError(getExportPostsSchema, rawArgs);
  const project = await context.entities.RedditBotProject.findUnique({
    where: { id: args.projectId },
  });
  ensureProjectAccess(project, context.user.id, context.user.isAdmin);

  const onlyUnexported = args.onlyUnexported !== false;
  const relevantOnly = args.relevantOnly !== false;

  const where: any = buildPostsWhere({
    projectId: args.projectId,
    status: relevantOnly ? 'RELEVANT' : args.status,
    subreddits: args.subreddits,
    postedAfter: args.postedAfter,
    postedBefore: args.postedBefore,
    fetchedAfter: args.fetchedAfter,
    fetchedBefore: args.fetchedBefore,
  });
  if (onlyUnexported) where.lastExportedAt = null;

  let list = await context.entities.RedditBotProjectPost.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { post: { include: { author: true } } },
  });
  if (args.keywords?.length) {
    list = list.filter((pp: any) => {
      const mk = pp.matchedKeywords as string[] | null;
      if (!mk || !Array.isArray(mk)) return false;
      const mkLower = mk.map((m: string) => m.toLowerCase());
      return args.keywords!.some((k) => mkLower.includes(k.toLowerCase()));
    });
  }
  return list.map((pp: any) => ({
    id: pp.id,
    title: pp.post?.title ?? '',
    content: pp.post?.content ?? '',
    postLink: pp.post?.postLink ?? '',
    authorName: pp.post?.author?.redditUsername ?? '',
    authorLink: pp.post?.author?.profileUrl ?? '',
    status: pp.status,
    painPointSummary: pp.painPointSummary ?? '',
    matchedKeywords: Array.isArray(pp.matchedKeywords) ? pp.matchedKeywords.join(', ') : '',
    subreddit: pp.post?.subreddit ?? '',
    postedAt: pp.post?.postedAt ?? '',
    fetchedAt: pp.createdAt,
  }));
};

const markAsExportedSchema = z.object({
  projectPostIds: z.array(z.string()).min(1),
});

export const markRedditBotProjectPostsAsExported = async (
  rawArgs: z.infer<typeof markAsExportedSchema>,
  context: any
) => {
  if (!context.user) throw new HttpError(401, 'Not authorized');
  await requireAppAccess(context.user.id, APP_KEYS.REDDIT_BOT, context.user.isAdmin);

  const args = ensureArgsSchemaOrThrowHttpError(markAsExportedSchema, rawArgs);
  const first = await context.entities.RedditBotProjectPost.findFirst({
    where: { id: args.projectPostIds[0] },
    include: { project: true },
  });
  if (!first) throw new HttpError(404, 'Project post not found');
  ensureProjectAccess(first.project, context.user.id, context.user.isAdmin);

  await context.entities.RedditBotProjectPost.updateMany({
    where: { id: { in: args.projectPostIds } },
    data: { lastExportedAt: new Date() },
  });
};

// --- Filter counts (contextual: respect other filters)
const getFilterCountsSchema = z.object({
  projectId: z.string(),
  status: z.enum(['DOWNLOADED', 'MATCH', 'RELEVANT', 'DISCARDED']).optional(),
  subreddits: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  postedAfter: z.string().datetime().optional(),
  postedBefore: z.string().datetime().optional(),
  fetchedAfter: z.string().datetime().optional(),
  fetchedBefore: z.string().datetime().optional(),
});

export const getRedditBotProjectPostFilterCounts = async (
  rawArgs: z.infer<typeof getFilterCountsSchema>,
  context: any
) => {
  if (!context.user) throw new HttpError(401, 'Not authorized');
  await requireAppAccess(context.user.id, APP_KEYS.REDDIT_BOT, context.user.isAdmin);

  const args = ensureArgsSchemaOrThrowHttpError(getFilterCountsSchema, rawArgs);
  const project = await context.entities.RedditBotProject.findUnique({
    where: { id: args.projectId },
  });
  ensureProjectAccess(project, context.user.id, context.user.isAdmin);

  const subreddits = (project.subreddits as string[]) || [];
  const keywords = (project.keywords as string[]) || [];

  // statusCounts: apply subreddits, keywords, dates (no status filter)
  const whereForStatus = buildPostsWhere({
    projectId: args.projectId,
    subreddits: args.subreddits,
    keywords: args.keywords,
    postedAfter: args.postedAfter,
    postedBefore: args.postedBefore,
    fetchedAfter: args.fetchedAfter,
    fetchedBefore: args.fetchedBefore,
  });
  let statusRows: { status: string; _count: number }[];
  const hasKeywordFilter = (args.keywords?.length ?? 0) > 0;
  if (hasKeywordFilter) {
    const full = await context.entities.RedditBotProjectPost.findMany({
      where: whereForStatus,
      select: { status: true, matchedKeywords: true },
    });
    const filteredForStatus = full.filter((pp: any) => {
      const mk = pp.matchedKeywords as string[] | null;
      if (!mk || !Array.isArray(mk)) return false;
      const mkLower = mk.map((m: string) => m.toLowerCase());
      return args.keywords!.some((k: string) => mkLower.includes(k.toLowerCase()));
    });
    const statusCountsMap: Record<string, number> = { DOWNLOADED: 0, MATCH: 0, RELEVANT: 0, DISCARDED: 0 };
    filteredForStatus.forEach((pp: any) => {
      statusCountsMap[pp.status] = (statusCountsMap[pp.status] ?? 0) + 1;
    });
    statusRows = Object.entries(statusCountsMap).map(([status, _count]) => ({ status, _count }));
  } else {
    const grouped = await context.entities.RedditBotProjectPost.groupBy({
      by: ['status'],
      where: whereForStatus,
      _count: { id: true },
    });
    statusRows = grouped.map((g: { status: string; _count: { id: number } }) => ({ status: g.status, _count: g._count.id }));
  }

  const statusCounts: Record<string, number> = { all: 0, DOWNLOADED: 0, MATCH: 0, RELEVANT: 0, DISCARDED: 0 };
  statusRows.forEach((r) => {
    statusCounts[r.status] = r._count;
    statusCounts.all += r._count;
  });

  // subredditCounts: apply status, keywords, dates (no subreddits)
  const whereForSubreddit = buildPostsWhere({
    projectId: args.projectId,
    status: args.status,
    subreddits: undefined,
    keywords: args.keywords,
    postedAfter: args.postedAfter,
    postedBefore: args.postedBefore,
    fetchedAfter: args.fetchedAfter,
    fetchedBefore: args.fetchedBefore,
  });
  let subList = await context.entities.RedditBotProjectPost.findMany({
    where: whereForSubreddit,
    select: { post: { select: { subreddit: true } } },
  });
  if (hasKeywordFilter) {
    const fullSub = await context.entities.RedditBotProjectPost.findMany({
      where: whereForSubreddit,
      select: { id: true, post: { select: { subreddit: true } }, matchedKeywords: true },
    });
    subList = fullSub
      .filter((pp: any) => {
        const mk = pp.matchedKeywords as string[] | null;
        if (!mk || !Array.isArray(mk)) return false;
        const mkLower = mk.map((m: string) => m.toLowerCase());
        return args.keywords!.some((k: string) => mkLower.includes(k.toLowerCase()));
      })
      .map((pp: any) => ({ post: { subreddit: pp.post.subreddit } }));
  }
  const subredditCounts: Record<string, number> = {};
  subList.forEach((row: any) => {
    const s = row.post?.subreddit ?? '';
    if (!s) return;
    const canonical = subreddits.find((ps) => ps.toLowerCase() === s.toLowerCase()) ?? s;
    subredditCounts[canonical] = (subredditCounts[canonical] ?? 0) + 1;
  });

  // keywordCounts: apply status, subreddits, dates (no keywords)
  const whereForKeyword = buildPostsWhere({
    projectId: args.projectId,
    status: args.status,
    subreddits: args.subreddits,
    keywords: undefined,
    postedAfter: args.postedAfter,
    postedBefore: args.postedBefore,
    fetchedAfter: args.fetchedAfter,
    fetchedBefore: args.fetchedBefore,
  });
  const keywordList = await context.entities.RedditBotProjectPost.findMany({
    where: whereForKeyword,
    select: { matchedKeywords: true },
  });
  const keywordCounts: Record<string, number> = {};
  keywords.forEach((k) => { keywordCounts[k] = 0; });
  keywordList.forEach((pp: any) => {
    const mk = pp.matchedKeywords as string[] | null;
    if (!mk || !Array.isArray(mk)) return;
    mk.forEach((m: string) => {
      const canonical = keywords.find((k) => k.toLowerCase() === m.toLowerCase());
      if (canonical) keywordCounts[canonical] = (keywordCounts[canonical] ?? 0) + 1;
    });
  });
  const totalForKeywordAll = keywordList.length;

  return { statusCounts, subredditCounts, keywordCounts, totalForKeywordAll };
};

// --- Schedules
export const getRedditBotSchedulesByProject = async (
  args: { projectId: string },
  context: any
) => {
  if (!context.user) throw new HttpError(401, 'Not authorized');
  await requireAppAccess(context.user.id, APP_KEYS.REDDIT_BOT, context.user.isAdmin);

  const project = await context.entities.RedditBotProject.findUnique({
    where: { id: args.projectId },
  });
  ensureProjectAccess(project, context.user.id, context.user.isAdmin);

  return context.entities.RedditBotSchedule.findMany({
    where: { projectId: args.projectId },
    orderBy: { createdAt: 'desc' },
  }) as Promise<RedditBotSchedule[]>;
};

const scheduleSchema = z.object({
  projectId: z.string(),
  enabled: z.boolean().optional(),
  cronExpression: z.string().optional().nullable(),
  runAtTime: z.string().optional().nullable(),
  config: z.record(z.any()).optional().nullable(),
});

const createScheduleSchema = scheduleSchema.omit({}).extend({
  projectId: z.string(),
  enabled: z.boolean().default(true),
  cronExpression: z.string().optional().nullable(),
  runAtTime: z.string().optional().nullable(),
  config: z.record(z.any()).optional().nullable(),
});

export const createRedditBotSchedule = async (
  rawArgs: z.infer<typeof createScheduleSchema>,
  context: any
) => {
  if (!context.user) throw new HttpError(401, 'Not authorized');
  await requireAppAccess(context.user.id, APP_KEYS.REDDIT_BOT, context.user.isAdmin);

  const args = ensureArgsSchemaOrThrowHttpError(createScheduleSchema, rawArgs);
  const project = await context.entities.RedditBotProject.findUnique({
    where: { id: args.projectId },
  });
  ensureProjectAccess(project, context.user.id, context.user.isAdmin);

  const nextRun = computeNextRunAt(args.cronExpression, args.runAtTime, args.config);

  return context.entities.RedditBotSchedule.create({
    data: {
      projectId: args.projectId,
      userId: context.user.id,
      enabled: args.enabled ?? true,
      cronExpression: args.cronExpression ?? null,
      runAtTime: args.runAtTime ?? null,
      config: args.config ?? null,
      nextRunAt: nextRun,
    },
  }) as Promise<RedditBotSchedule>;
};

function computeNextRunAt(
  cronExpression: string | null | undefined,
  runAtTime: string | null | undefined,
  config: any
): Date | null {
  const now = new Date();
  if (runAtTime) {
    const [h, m] = runAtTime.split(':').map(Number);
    const next = new Date(now);
    next.setUTCHours(h ?? 0, m ?? 0, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }
  if (cronExpression) {
    const next = new Date(now);
    next.setUTCHours(next.getUTCHours() + 1, 0, 0, 0);
    return next;
  }
  return null;
}

const updateScheduleSchema = z.object({
  id: z.string(),
  enabled: z.boolean().optional(),
  cronExpression: z.string().optional().nullable(),
  runAtTime: z.string().optional().nullable(),
  config: z.record(z.any()).optional().nullable(),
});

export const updateRedditBotSchedule = async (
  rawArgs: z.infer<typeof updateScheduleSchema>,
  context: any
) => {
  if (!context.user) throw new HttpError(401, 'Not authorized');
  await requireAppAccess(context.user.id, APP_KEYS.REDDIT_BOT, context.user.isAdmin);

  const args = ensureArgsSchemaOrThrowHttpError(updateScheduleSchema, rawArgs);
  const schedule = await context.entities.RedditBotSchedule.findUnique({
    where: { id: args.id },
    include: { project: true },
  });
  if (!schedule) throw new HttpError(404, 'Schedule not found');
  ensureProjectAccess(schedule.project, context.user.id, context.user.isAdmin);

  const data: any = {};
  if (args.enabled !== undefined) data.enabled = args.enabled;
  if (args.cronExpression !== undefined) data.cronExpression = args.cronExpression;
  if (args.runAtTime !== undefined) data.runAtTime = args.runAtTime;
  if (args.config !== undefined) data.config = args.config;
  if (args.enabled !== undefined || args.cronExpression !== undefined || args.runAtTime !== undefined) {
    data.nextRunAt = computeNextRunAt(
      args.cronExpression ?? schedule.cronExpression,
      args.runAtTime ?? schedule.runAtTime,
      args.config ?? schedule.config
    );
  }

  return context.entities.RedditBotSchedule.update({
    where: { id: args.id },
    data,
  }) as Promise<RedditBotSchedule>;
};

export const deleteRedditBotSchedule = async (
  args: { id: string },
  context: any
) => {
  if (!context.user) throw new HttpError(401, 'Not authorized');
  await requireAppAccess(context.user.id, APP_KEYS.REDDIT_BOT, context.user.isAdmin);

  const schedule = await context.entities.RedditBotSchedule.findUnique({
    where: { id: args.id },
    include: { project: true },
  });
  if (!schedule) throw new HttpError(404, 'Schedule not found');
  ensureProjectAccess(schedule.project, context.user.id, context.user.isAdmin);

  await context.entities.RedditBotSchedule.delete({
    where: { id: args.id },
  });
};

// --- Jobs
export const getRedditBotJobsByProject = async (
  args: { projectId: string },
  context: any
) => {
  if (!context.user) throw new HttpError(401, 'Not authorized');
  await requireAppAccess(context.user.id, APP_KEYS.REDDIT_BOT, context.user.isAdmin);

  const project = await context.entities.RedditBotProject.findUnique({
    where: { id: args.projectId },
  });
  ensureProjectAccess(project, context.user.id, context.user.isAdmin);

  return context.entities.RedditBotJob.findMany({
    where: { projectId: args.projectId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  }) as Promise<RedditBotJob[]>;
};

export const getRedditBotAiAnalysisRunsByProject = async (
  args: { projectId: string },
  context: any
) => {
  if (!context.user) throw new HttpError(401, 'Not authorized');
  await requireAppAccess(context.user.id, APP_KEYS.REDDIT_BOT, context.user.isAdmin);

  const project = await context.entities.RedditBotProject.findUnique({
    where: { id: args.projectId },
  });
  ensureProjectAccess(project, context.user.id, context.user.isAdmin);

  return context.entities.RedditBotAiAnalysisRun.findMany({
    where: { projectId: args.projectId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
};

const runExplorationSchema = z.object({
  projectId: z.string(),
  subreddits: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  relativeDateRange: z.object({
    start: z.string(),
    end: z.string(),
    bufferMinutes: z.number().min(0).optional(),
  }),
  maxPostsToExplore: z.number().int().positive().optional(),
  maxLeadsToFind: z.number().int().positive().optional(),
  strictKeywordSearch: z.boolean().optional(),
});

export const runRedditBotExploration = async (
  rawArgs: z.infer<typeof runExplorationSchema>,
  context: any
) => {
  if (!context.user) throw new HttpError(401, 'Not authorized');
  await requireAppAccess(context.user.id, APP_KEYS.REDDIT_BOT, context.user.isAdmin);

  const args = ensureArgsSchemaOrThrowHttpError(runExplorationSchema, rawArgs);
  const project = await context.entities.RedditBotProject.findUnique({
    where: { id: args.projectId },
  });
  ensureProjectAccess(project, context.user.id, context.user.isAdmin);

  const subreddits = args.subreddits?.length ? args.subreddits : (project!.subreddits as string[]) || [];
  const keywords = args.keywords?.length ? args.keywords : (project!.keywords as string[]) || [];

  const jobConfig = {
    subreddits,
    keywords,
    relativeDateRange: {
      start: args.relativeDateRange.start,
      end: args.relativeDateRange.end,
      bufferMinutes: args.relativeDateRange.bufferMinutes,
    },
    maxPostsToExplore: args.maxPostsToExplore ?? undefined,
    maxLeadsToFind: args.maxLeadsToFind ?? undefined,
    strictKeywordSearch: args.strictKeywordSearch,
  };

  const job = await context.entities.RedditBotJob.create({
    data: {
      projectId: args.projectId,
      status: 'RUNNING',
      uniqueCount: 0,
      keywordMatchCount: 0,
      config: jobConfig,
    },
  });

  await redditExplorationJob.submit({
    projectId: args.projectId,
    userId: context.user.id,
    jobId: job.id,
    options: {
      subreddits,
      keywords,
      relativeDateRange: args.relativeDateRange,
      maxPostsToExplore: args.maxPostsToExplore,
      maxLeadsToFind: args.maxLeadsToFind,
      strictKeywordSearch: args.strictKeywordSearch,
    },
  });

  return job.id;
};

export const killRedditBotJob = async (
  args: { jobId: string },
  context: any
) => {
  if (!context.user) throw new HttpError(401, 'Not authorized');
  await requireAppAccess(context.user.id, APP_KEYS.REDDIT_BOT, context.user.isAdmin);

  const job = await context.entities.RedditBotJob.findUnique({
    where: { id: args.jobId },
    include: { project: true },
  });
  if (!job) throw new HttpError(404, 'Job not found');
  ensureProjectAccess(job.project, context.user.id, context.user.isAdmin);
  if (job.status !== 'RUNNING') throw new HttpError(400, 'Job is not running');

  const now = new Date();
  await context.entities.RedditBotJob.update({
    where: { id: args.jobId },
    data: { stopRequestedAt: now, status: 'KILLED', completedAt: now },
  });
  // Marking KILLED immediately so the UI updates even if the worker is no longer running (e.g. after deploy).
};

export const killRedditAiAnalysisRun = async (
  args: { runId: string },
  context: any
) => {
  if (!context.user) throw new HttpError(401, 'Not authorized');
  await requireAppAccess(context.user.id, APP_KEYS.REDDIT_BOT, context.user.isAdmin);

  const run = await context.entities.RedditBotAiAnalysisRun.findUnique({
    where: { id: args.runId },
    include: { project: true },
  });
  if (!run) throw new HttpError(404, 'AI analysis run not found');
  ensureProjectAccess(run.project, context.user.id, context.user.isAdmin);
  if (run.status !== 'RUNNING') throw new HttpError(400, 'Run is not running');

  const now = new Date();
  await context.entities.RedditBotAiAnalysisRun.update({
    where: { id: args.runId },
    data: { stopRequestedAt: now, status: 'KILLED' },
  });
  // Marking KILLED immediately so the UI updates even if the worker is no longer running (e.g. after deploy).
};

export const getRedditAiAnalysisProspectiveCount = async (
  args: {
    projectId: string;
    includeAlreadyProcessed?: boolean;
    status?: string;
    subreddits?: string[];
    keywords?: string[];
    postedAfter?: string;
    postedBefore?: string;
  },
  context: any
) => {
  if (!context.user) throw new HttpError(401, 'Not authorized');
  await requireAppAccess(context.user.id, APP_KEYS.REDDIT_BOT, context.user.isAdmin);

  const project = await context.entities.RedditBotProject.findUnique({
    where: { id: args.projectId },
  });
  ensureProjectAccess(project, context.user.id, context.user.isAdmin);

  const statuses = args.includeAlreadyProcessed
    ? (['NOT_REQUESTED', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'] as const)
    : (['NOT_REQUESTED', 'PENDING'] as const);

  const where = buildPostsWhere({
    projectId: args.projectId,
    status: args.status,
    subreddits: args.subreddits,
    postedAfter: args.postedAfter,
    postedBefore: args.postedBefore,
  });
  where.aiAnalysisStatus = { in: statuses };

  const projectKeywords = (project!.keywords as string[]) || [];
  let count: number;

  if (args.keywords?.length) {
    const all = await context.entities.RedditBotProjectPost.findMany({
      where,
      select: { matchedKeywords: true },
    });
    count = all.filter((pp: { matchedKeywords: unknown }) => {
      const mk = (pp.matchedKeywords as string[]) ?? [];
      return mk.some((m) => args.keywords!.some((k) => k.toLowerCase() === m.toLowerCase()));
    }).length;
  } else {
    count = await context.entities.RedditBotProjectPost.count({ where });
  }

  return { count };
};

export const triggerRedditAiAnalysis = async (
  args: {
    projectId: string;
    includeAlreadyProcessed?: boolean;
    status?: string;
    subreddits?: string[];
    keywords?: string[];
    postedAfter?: string;
    postedBefore?: string;
  },
  context: any
) => {
  if (!context.user) throw new HttpError(401, 'Not authorized');
  await requireAppAccess(context.user.id, APP_KEYS.REDDIT_BOT, context.user.isAdmin);

  const project = await context.entities.RedditBotProject.findUnique({
    where: { id: args.projectId },
  });
  ensureProjectAccess(project, context.user.id, context.user.isAdmin);

  const statusesToProcess = args.includeAlreadyProcessed
    ? (['NOT_REQUESTED', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'] as const)
    : (['NOT_REQUESTED', 'PENDING'] as const);

  const filterSnapshot = {
    status: args.status,
    subreddits: args.subreddits,
    keywords: args.keywords,
    postedAfter: args.postedAfter,
    postedBefore: args.postedBefore,
    includeAlreadyProcessed: args.includeAlreadyProcessed,
  };

  const where = buildPostsWhere({
    projectId: args.projectId,
    status: args.status,
    subreddits: args.subreddits,
    postedAfter: args.postedAfter,
    postedBefore: args.postedBefore,
  });
  where.aiAnalysisStatus = { in: statusesToProcess };

  const projectKeywords = (project!.keywords as string[]) || [];
  let totalToProcess: number;

  if (args.keywords?.length) {
    const all = await context.entities.RedditBotProjectPost.findMany({
      where,
      select: { matchedKeywords: true },
    });
    totalToProcess = all.filter((pp: { matchedKeywords: unknown }) => {
      const mk = (pp.matchedKeywords as string[]) ?? [];
      return mk.some((m) => args.keywords!.some((k) => k.toLowerCase() === m.toLowerCase()));
    }).length;
  } else {
    totalToProcess = await context.entities.RedditBotProjectPost.count({ where });
  }

  if (totalToProcess === 0) {
    throw new HttpError(
      400,
      args.includeAlreadyProcessed
        ? 'No posts to process. Run an exploration first to add posts.'
        : 'No posts to process. All posts have already been analyzed or are in progress. Run an exploration first to add posts, use the sparkle icon on individual posts, or enable "Also process already completed/failed" to re-run.'
    );
  }

  const run = await context.entities.RedditBotAiAnalysisRun.create({
    data: {
      projectId: args.projectId,
      triggerSource: 'manual',
      filterSnapshot: filterSnapshot as any,
      status: 'RUNNING',
      totalToProcess,
      processedCount: 0,
    },
  });

  await redditAiAnalysisJob.submit({
    runId: run.id,
    projectId: args.projectId,
    includeAlreadyProcessed: args.includeAlreadyProcessed ?? false,
    filterSnapshot: filterSnapshot as any,
  });

  return { runId: run.id, totalToProcess };
};
