import { useParams, useSearchParams, Link } from 'react-router';
import { useQuery, useAction } from 'wasp/client/operations';
import {
  getRedditBotProjectById,
  getRedditBotProjectPosts,
  getRedditBotProjectPostsForExport,
  getRedditBotProjectPostFilterCounts,
  getRedditBotJobsByProject,
  getRedditBotAiAnalysisRunsByProject,
  getRedditBotSchedulesByProject,
  getRedditBotProjectCreditUsed,
  killRedditAiAnalysisRun,
  runRedditBotExploration,
  killRedditBotJob,
  triggerRedditAiAnalysis,
  getRedditAiAnalysisProspectiveCount,
  updateRedditBotProjectPostStatus,
  analyzeRedditBotProjectPost,
  markRedditBotProjectPostsAsExported,
  createRedditBotSchedule,
  updateRedditBotSchedule,
  deleteRedditBotSchedule,
  getMyRedditCredit,
  getRedditAiConfigStatus,
  updateRedditBotProject,
  deleteRedditBotProjectPosts,
} from 'wasp/client/operations';
import { routes } from 'wasp/client/router';
import { Button } from '../client/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../client/components/ui/card';
import { Input } from '../client/components/ui/input';
import { Label } from '../client/components/ui/label';
import { Textarea } from '../client/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../client/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../client/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../client/components/ui/select';
import { Switch } from '../client/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../client/components/ui/tabs';
import { Checkbox } from '../client/components/ui/checkbox';
import { ChevronDown, ChevronRight, ChevronUp, Loader2, Play, Square, Download, Trash2, Calendar, List, Clock, LayoutGrid, Pencil, Sparkles, Check, X } from 'lucide-react';
import { useState, useEffect, useRef, Fragment, useMemo } from 'react';
import { useAutoRefresh, AutoRefreshToggle } from './useAutoRefresh';
import { formatDuration } from '../shared/utils';

import ExplorationFiltersForm, { type ExplorationFiltersValue } from './ExplorationFiltersForm';

function formatJobDuration(createdAt: string | Date, completedAt: string | Date | null | undefined): string | null {
  if (!completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(createdAt).getTime();
  if (ms < 0) return null;
  return formatDuration(ms);
}

type JobConfig = {
  subreddits?: string[];
  keywords?: string[];
  relativeDateRange?: { start: string; end: string; bufferMinutes?: number };
  maxPostsToExplore?: number;
  maxLeadsToFind?: number;
  strictKeywordSearch?: boolean;
};

const POSTS_PAGE_SIZE_KEY = 'reddit-bot-posts-page-size';
const PAGE_SIZE_OPTIONS = [20, 50, 100, 200, 500] as const;

const POST_STATUS_COLOR: Record<string, string> = {
  DOWNLOADED: 'bg-muted text-muted-foreground',
  MATCH: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  RELEVANT: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  DISCARDED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const JOB_STATUS_COLOR: Record<string, string> = {
  RUNNING: 'text-blue-600 dark:text-blue-400',
  COMPLETED: 'text-green-600 dark:text-green-400',
  FAILED: 'text-red-600 dark:text-red-400',
  KILLED: 'text-amber-600 dark:text-amber-400',
};

const AI_RUN_STATUS_COLOR: Record<string, string> = {
  RUNNING: 'text-blue-600 dark:text-blue-400',
  COMPLETED: 'text-green-600 dark:text-green-400',
  FAILED: 'text-red-600 dark:text-red-400',
  KILLED: 'text-amber-600 dark:text-amber-400',
};

function formatJobConfigSummary(config: JobConfig | null | undefined): string {
  if (!config) return 'Exploration (no details)';
  const parts: string[] = [];
  if (config.subreddits?.length) {
    parts.push(config.subreddits.map((s) => (s === 'all' ? 'all' : `r/${s}`)).join(', '));
  }
  if (config.keywords?.length) {
    parts.push(config.keywords.join(', '));
  }
  if (config.relativeDateRange) {
    const { start, end } = config.relativeDateRange;
    parts.push(`${start} → ${end}`);
  }
  if (config.maxPostsToExplore || config.maxLeadsToFind) {
    const limits: string[] = [];
    if (config.maxPostsToExplore) limits.push(`max ${config.maxPostsToExplore} posts`);
    if (config.maxLeadsToFind) limits.push(`max ${config.maxLeadsToFind} leads`);
    parts.push(limits.join(', '));
  }
  if (config.strictKeywordSearch === false) parts.push('all posts (keyword match)');
  return parts.length ? parts.join(' · ') : 'Exploration';
}

const TAB_VALUES = ['home', 'posts', 'schedules', 'jobs'] as const;

export default function RedditBotProjectDetail() {
  const { projectId } = useParams();
  const { autoRefresh, toggleAutoRefresh, queryOpts } = useAutoRefresh();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(() =>
    tabFromUrl && TAB_VALUES.includes(tabFromUrl as typeof TAB_VALUES[number]) ? tabFromUrl : 'home'
  );

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && TAB_VALUES.includes(t as typeof TAB_VALUES[number]) && t !== activeTab) setActiveTab(t);
  }, [searchParams, activeTab]);

  const setActiveTabWithUrl = (value: string) => {
    setActiveTab(value);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', value);
      return next;
    });
  };
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [filters, setFilters] = useState<{
    status?: 'DOWNLOADED' | 'MATCH' | 'RELEVANT' | 'DISCARDED';
    subreddits?: string[];
    keywords?: string[];
    postedFrom?: string;
    postedTo?: string;
  }>({});
  const [postsSortBy, setPostsSortBy] = useState<'postedAt' | 'createdAt'>('postedAt');
  const [postsOrder, setPostsOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);

  const { data: project, isLoading: projectLoading, error: projectError, refetch: refetchProject } = useQuery(
    getRedditBotProjectById,
    { projectId: projectId! },
    queryOpts
  );
  const [postsPageSize, setPostsPageSizeState] = useState<number>(() => {
    if (typeof window === 'undefined') return 20;
    const v = localStorage.getItem(POSTS_PAGE_SIZE_KEY);
    const n = v ? parseInt(v, 10) : 20;
    return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n) ? n : 20;
  });
  const setPostsPageSize = (size: number) => {
    setPostsPageSizeState(size);
    try { localStorage.setItem(POSTS_PAGE_SIZE_KEY, String(size)); } catch (_) {}
    setPostsCursor(null);
    setPostsCursorHistory([]);
  };
  const [postsCursor, setPostsCursor] = useState<string | null>(null);
  const [postsCursorHistory, setPostsCursorHistory] = useState<string[]>([]);
  const postsQueryArgs = useMemo(
    () => ({
      projectId: projectId ?? '',
      status: filters.status,
      subreddits: filters.subreddits,
      keywords: filters.keywords,
      postedAfter: filters.postedFrom ? `${filters.postedFrom}T00:00:00.000Z` : undefined,
      postedBefore: filters.postedTo ? `${filters.postedTo}T23:59:59.999Z` : undefined,
      sortBy: postsSortBy,
      order: postsOrder,
      cursor: postsCursor ?? undefined,
      take: postsPageSize,
    }),
    [
      projectId,
      filters.status,
      filters.subreddits,
      filters.keywords,
      filters.postedFrom,
      filters.postedTo,
      postsSortBy,
      postsOrder,
      postsCursor,
      postsPageSize,
    ]
  );
  const { data: postsData, refetch: refetchPosts } = useQuery(getRedditBotProjectPosts, postsQueryArgs, queryOpts);
  const posts = postsData?.items ?? [];
  const postsTotal = postsData?.total ?? 0;
  const postsNextCursor = postsData?.nextCursor ?? null;
  const postsStartIndex = postsCursorHistory.length * postsPageSize;
  const postsEndIndex = Math.min(postsStartIndex + posts.length, postsTotal);

  const filterCountsArgs = useMemo(
    () =>
      projectId
        ? {
            projectId,
            status: filters.status,
            subreddits: filters.subreddits,
            keywords: filters.keywords,
            postedAfter: filters.postedFrom ? `${filters.postedFrom}T00:00:00.000Z` : undefined,
            postedBefore: filters.postedTo ? `${filters.postedTo}T23:59:59.999Z` : undefined,
          }
        : null,
    [projectId, filters.status, filters.subreddits, filters.keywords, filters.postedFrom, filters.postedTo]
  );
  const { data: filterCounts } = useQuery(
    getRedditBotProjectPostFilterCounts,
    filterCountsArgs ?? { projectId: '' },
    { enabled: !!filterCountsArgs?.projectId && activeTab === 'posts', ...queryOpts }
  );
  const markAsExported = useAction(markRedditBotProjectPostsAsExported);
  const subredditsAllCount = filterCounts?.subredditCounts
    ? Object.values(filterCounts.subredditCounts).reduce((a, b) => a + b, 0)
    : 0;
  const keywordsAllCount = filterCounts?.totalForKeywordAll ?? 0;

  type ExportArgs = {
    projectId: string;
    status?: 'DOWNLOADED' | 'MATCH' | 'RELEVANT' | 'DISCARDED';
    subreddits?: string[];
    keywords?: string[];
    postedAfter?: string;
    postedBefore?: string;
    fetchedAfter?: string;
    fetchedBefore?: string;
    onlyUnexported?: boolean;
    relevantOnly?: boolean;
    projectPostIds?: string[];
  };
  const [exportArgs, setExportArgs] = useState<ExportArgs | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportOnlyUnexported, setExportOnlyUnexported] = useState(true);
  const [exportRelevantOnly, setExportRelevantOnly] = useState(true);
  const { data: exportData } = useQuery(getRedditBotProjectPostsForExport, exportArgs ?? { projectId: projectId ?? '' }, { enabled: !!exportArgs && !!projectId, ...queryOpts });

  const { data: jobs = [], refetch: refetchJobs } = useQuery(getRedditBotJobsByProject, {
    projectId: projectId!,
  }, queryOpts);
  const { data: aiRuns = [], refetch: refetchAiRuns } = useQuery(getRedditBotAiAnalysisRunsByProject, {
    projectId: projectId!,
  }, queryOpts);
  const killAiRun = useAction(killRedditAiAnalysisRun);
  const { data: schedules = [], refetch: refetchSchedules } = useQuery(
    getRedditBotSchedulesByProject,
    { projectId: projectId! },
    queryOpts
  );
  const { data: credit } = useQuery(getMyRedditCredit, queryOpts);
  const { data: projectCredit } = useQuery(getRedditBotProjectCreditUsed, {
    projectId: projectId!,
  }, queryOpts);
  const { data: aiConfig } = useQuery(getRedditAiConfigStatus, queryOpts);

  const runExplore = useAction(runRedditBotExploration);
  const killJob = useAction(killRedditBotJob);
  const triggerAiAnalysis = useAction(triggerRedditAiAnalysis);
  const updateStatus = useAction(updateRedditBotProjectPostStatus);
  const analyzePost = useAction(analyzeRedditBotProjectPost);
  const createSchedule = useAction(createRedditBotSchedule);
  const updateSchedule = useAction(updateRedditBotSchedule);
  const deleteSchedule = useAction(deleteRedditBotSchedule);
  const updateProject = useAction(updateRedditBotProject);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editProductDescription, setEditProductDescription] = useState('');
  const [editSubredditsStr, setEditSubredditsStr] = useState('');
  const [editKeywordsStr, setEditKeywordsStr] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [exploring, setExploring] = useState(false);
  const [runningAiAnalysis, setRunningAiAnalysis] = useState(false);
  const [scheduleRunAt, setScheduleRunAt] = useState('09:00');
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  // Home tab exploration filters (initialized from project when loaded)
  const [exploreFilters, setExploreFilters] = useState<ExplorationFiltersValue>({
    selectedSubreddits: [],
    selectedKeywords: [],
    dateRange: { start: '-24h', end: 'now', bufferMinutes: 1 },
    maxPosts: '',
    maxLeads: '',
    strictKeywordSearch: true,
  });
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [scheduleEditFilters, setScheduleEditFilters] = useState<ExplorationFiltersValue | null>(null);
  const [scheduleIdToDelete, setScheduleIdToDelete] = useState<string | null>(null);
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);
  const [analyzingPostId, setAnalyzingPostId] = useState<string | null>(null);
  const [aiAnalysisMessage, setAiAnalysisMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [runAiDialogOpen, setRunAiDialogOpen] = useState(false);
  const [exploreWithRunningJobDialogOpen, setExploreWithRunningJobDialogOpen] = useState(false);
  const [runAiForceIncludeProcessed, setRunAiForceIncludeProcessed] = useState(false);
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);

  const { data: aiProspectiveCount } = useQuery(
    getRedditAiAnalysisProspectiveCount,
    {
      projectId: projectId ?? '',
      includeAlreadyProcessed: runAiForceIncludeProcessed,
      status: filters.status,
      subreddits: filters.subreddits,
      keywords: filters.keywords,
      postedAfter: filters.postedFrom ? `${filters.postedFrom}T00:00:00.000Z` : undefined,
      postedBefore: filters.postedTo ? `${filters.postedTo}T23:59:59.999Z` : undefined,
    },
    { enabled: !!projectId && runAiDialogOpen }
  );

  const prevEditDialogOpen = useRef(false);
  const prevScheduleOpen = useRef(false);

  const latestJob = jobs[0];
  const isJobRunning = latestJob?.status === 'RUNNING';
  const isAiRunRunning = (aiRuns as any[]).some((r) => r.status === 'RUNNING');

  useEffect(() => {
    if (autoRefresh && (isJobRunning || isAiRunRunning)) {
      const t = setInterval(() => {
        refetchJobs();
        refetchAiRuns();
      }, 3000);
      return () => clearInterval(t);
    }
  }, [autoRefresh, isJobRunning, isAiRunRunning, refetchJobs, refetchAiRuns]);

  const hasPendingOrInProgressAi = posts.some(
    (pp: any) => pp.aiAnalysisStatus === 'PENDING' || pp.aiAnalysisStatus === 'IN_PROGRESS'
  );
  // Only poll posts when on Posts tab and there is pending/in-progress AI (avoid hammering the server when tab not visible)
  useEffect(() => {
    if (autoRefresh && activeTab === 'posts' && hasPendingOrInProgressAi) {
      const t = setInterval(refetchPosts, 5000);
      return () => clearInterval(t);
    }
  }, [autoRefresh, activeTab, hasPendingOrInProgressAi, refetchPosts]);

  // Clear selected posts when filters or pagination change
  useEffect(() => {
    setSelectedPostIds([]);
  }, [filters.status, filters.subreddits, filters.keywords, filters.postedFrom, filters.postedTo, postsSortBy, postsOrder, postsCursor]);

  // Default Home filters to full project subreddits/keywords when project loads or changes
  useEffect(() => {
    if (project) {
      const subs = (project.subreddits as string[]) || [];
      const kws = (project.keywords as string[]) || [];
      setExploreFilters((prev) => ({ ...prev, selectedSubreddits: subs, selectedKeywords: kws }));
    }
  }, [project?.id]);

  useEffect(() => {
    setPostsCursor(null);
    setPostsCursorHistory([]);
  }, [filters.status, filters.subreddits, filters.keywords, filters.postedFrom, filters.postedTo, postsSortBy, postsOrder]);

  useEffect(() => {
    if (!exportArgs || !exportData) return;
    const headers = ['title', 'content', 'postLink', 'authorName', 'authorLink', 'status', 'painPointSummary', 'matchedKeywords', 'subreddit', 'postedAt', 'fetchedAt'];
    const escape = (v: unknown) => String(v ?? '').replace(/[\t\r\n]+/g, ' ');
    const row = (r: Record<string, unknown>) => [
      escape(r.title),
      escape(r.content).slice(0, 500),
      escape(r.postLink),
      escape(r.authorName),
      escape(r.authorLink),
      escape(r.status),
      escape(r.painPointSummary),
      escape(r.matchedKeywords),
      escape(r.subreddit),
      r.postedAt instanceof Date ? r.postedAt.toISOString() : r.postedAt != null ? new Date(r.postedAt as string).toISOString() : '',
      r.fetchedAt instanceof Date ? r.fetchedAt.toISOString() : r.fetchedAt != null ? new Date(r.fetchedAt as string).toISOString() : '',
    ];
    const tsv = [headers.join('\t'), ...exportData.map((r: Record<string, unknown>) => row(r).join('\t'))].join('\n');
    const blob = new Blob([tsv], { type: 'text/tab-separated-values' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `reddit-bot-posts-${exportArgs.projectId.slice(0, 8)}.tsv`;
    a.click();
    URL.revokeObjectURL(a.href);
    const ids = exportData.map((r: Record<string, unknown>) => r.id as string).filter(Boolean);
    if (ids.length > 0) {
      markAsExported({ projectPostIds: ids }).then(() => refetchPosts());
    }
    setExportArgs(null);
  }, [exportArgs, exportData, markAsExported, refetchPosts]);


  // Populate edit form only when edit dialog opens (not on refetch), so user input isn't lost on focus/blur
  useEffect(() => {
    const justOpened = editDialogOpen && !prevEditDialogOpen.current;
    prevEditDialogOpen.current = editDialogOpen;
    if (justOpened && project) {
      setEditName(project.name);
      setEditDescription(project.description ?? '');
      setEditProductDescription(project.productDescription ?? '');
      setEditSubredditsStr(((project.subreddits as string[]) || []).join(', '));
      setEditKeywordsStr(((project.keywords as string[]) || []).join(', '));
    }
  }, [editDialogOpen, project]);

  // Populate schedule form only when schedule dialog opens
  useEffect(() => {
    const justOpened = scheduleOpen && !prevScheduleOpen.current;
    prevScheduleOpen.current = scheduleOpen;
    if (!justOpened || !project) return;
    const subs = (project.subreddits as string[]) || [];
    const kws = (project.keywords as string[]) || [];
    if (editingScheduleId) {
      const s = schedules.find((x: any) => x.id === editingScheduleId);
      if (s) {
        const c = (s.config as Record<string, unknown>) || {};
        setScheduleRunAt(String(s.runAtTime ?? '09:00'));
        setScheduleEnabled(s.enabled ?? true);
        const range = (c.relativeDateRange as { start?: string; end?: string; bufferMinutes?: number }) || { start: '-24h', end: 'now' };
        setScheduleEditFilters({
          selectedSubreddits: (c.subreddits as string[])?.length ? (c.subreddits as string[]) : subs,
          selectedKeywords: (c.keywords as string[])?.length ? (c.keywords as string[]) : kws,
          dateRange: { start: range.start ?? '-24h', end: range.end ?? 'now', bufferMinutes: range.bufferMinutes ?? 1 },
          maxPosts: (c.maxPostsToExplore as number) ? String(c.maxPostsToExplore) : '',
          maxLeads: (c.maxLeadsToFind as number) ? String(c.maxLeadsToFind) : '',
          strictKeywordSearch: (c.strictKeywordSearch as boolean) !== false,
        });
      }
    } else {
      setScheduleEditFilters(null);
    }
  }, [scheduleOpen, editingScheduleId, project, schedules]);

  const handleSaveEdit = async () => {
    if (!projectId || !project || !editName.trim()) return;
    const subreddits = editSubredditsStr
      .split(/[\s,]+/)
      .map((s) => s.trim().replace(/^r\//, ''))
      .filter(Boolean);
    const keywords = editKeywordsStr
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    setSavingEdit(true);
    try {
      await updateProject({
        id: projectId,
        name: editName.trim(),
        description: editDescription.trim() || null,
        productDescription: editProductDescription.trim() ?? '',
        subreddits,
        keywords,
      });
      setEditDialogOpen(false);
      refetchProject();
    } catch (e) {
      console.error(e);
    } finally {
      setSavingEdit(false);
    }
  };

  const buildConfigFromFilters = (f: ExplorationFiltersValue) => ({
    subreddits: f.selectedSubreddits.length ? f.selectedSubreddits : undefined,
    keywords: f.selectedKeywords.length ? f.selectedKeywords : undefined,
    relativeDateRange: f.dateRange,
    maxPostsToExplore: f.maxPosts ? parseInt(f.maxPosts, 10) : undefined,
    maxLeadsToFind: f.maxLeads ? parseInt(f.maxLeads, 10) : undefined,
    strictKeywordSearch: f.strictKeywordSearch,
  });

  const runExploreNow = async () => {
    if (!projectId || !project) return;
    setExploring(true);
    setExploreWithRunningJobDialogOpen(false);
    try {
      const config = buildConfigFromFilters(exploreFilters);
      await runExplore({
        projectId,
        subreddits: config.subreddits ?? (project.subreddits as string[]) ?? [],
        keywords: config.keywords ?? (project.keywords as string[]) ?? [],
        relativeDateRange: config.relativeDateRange,
        maxPostsToExplore: config.maxPostsToExplore,
        maxLeadsToFind: config.maxLeadsToFind,
        strictKeywordSearch: config.strictKeywordSearch,
      });
      setActiveTabWithUrl('jobs');
      refetchJobs();
    } catch (e) {
      console.error(e);
    } finally {
      setExploring(false);
    }
  };

  const handleRunExplore = () => {
    if (isJobRunning) {
      setExploreWithRunningJobDialogOpen(true);
    } else {
      runExploreNow();
    }
  };

  const handleKillJob = async () => {
    if (!latestJob?.id) return;
    try {
      await killJob({ jobId: latestJob.id });
      refetchJobs();
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportClick = () => {
    if (!projectId) return;
    if (selectedPostIds.length > 0) {
      // Export exactly the selected posts (current selection), bypassing the dialog.
      setExportArgs({
        projectId,
        projectPostIds: selectedPostIds,
      });
    } else {
      setExportDialogOpen(true);
    }
  };
  const handleConfirmExport = () => {
    if (!projectId) return;
    if (selectedPostIds.length > 0) {
      setExportArgs({
        projectId,
        projectPostIds: selectedPostIds,
      });
    } else {
      setExportArgs({
        projectId,
        status: filters.status,
        subreddits: filters.subreddits?.length ? filters.subreddits : undefined,
        keywords: filters.keywords?.length ? filters.keywords : undefined,
        postedAfter: filters.postedFrom ? `${filters.postedFrom}T00:00:00.000Z` : undefined,
        postedBefore: filters.postedTo ? `${filters.postedTo}T23:59:59.999Z` : undefined,
        fetchedAfter: undefined,
        fetchedBefore: undefined,
        onlyUnexported: exportOnlyUnexported,
        relevantOnly: exportRelevantOnly,
      });
    }
    setExportDialogOpen(false);
  };

  const handleAddSchedule = async () => {
    if (!projectId || !project) return;
    try {
      const config = buildConfigFromFilters(exploreFilters);
      await createSchedule({
        projectId,
        enabled: scheduleEnabled,
        runAtTime: scheduleRunAt,
        config,
      });
      setScheduleOpen(false);
      setEditingScheduleId(null);
      refetchSchedules();
      setActiveTabWithUrl('schedules');
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateSchedule = async () => {
    if (!editingScheduleId || !scheduleEditFilters) return;
    try {
      const config = buildConfigFromFilters(scheduleEditFilters);
      await updateSchedule({
        id: editingScheduleId,
        enabled: scheduleEnabled,
        runAtTime: scheduleRunAt,
        config,
      });
      setScheduleOpen(false);
      setEditingScheduleId(null);
      refetchSchedules();
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleSchedule = async (schedule: any, enabled: boolean) => {
    try {
      await updateSchedule({ id: schedule.id, enabled });
      refetchSchedules();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      await deleteSchedule({ id });
      setScheduleIdToDelete(null);
      refetchSchedules();
    } catch (e) {
      console.error(e);
    }
  };

  if (projectLoading || !projectId) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  if (projectError || !project) {
    return (
      <div className="py-10 px-6">
        <p className="text-red-500">{projectError?.message ?? 'Project not found'}</p>
        <Button asChild variant="link" className="mt-4">
          <Link to={routes.RedditBotRoute.to}>Back to Reddit Bot</Link>
        </Button>
      </div>
    );
  }

  const subreddits = (project.subreddits as string[]) || [];
  const keywords = (project.keywords as string[]) || [];

  return (
    <div className="py-10">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <nav
            className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
            aria-label="Breadcrumb"
          >
            <Link
              to={routes.RedditBotRoute.to}
              className="hover:text-foreground transition-colors"
            >
              Reddit Bot
            </Link>
            <ChevronRight className="h-4 w-4 shrink-0" />
            <h1 className="truncate text-foreground font-semibold text-base">{project.name}</h1>
            {projectCredit != null && (
              <>
                <span className="mx-1.5">·</span>
                <span className="text-muted-foreground text-sm">
                  Credits used (this project): <span className="font-medium text-foreground">{Number(projectCredit.creditsUsed).toFixed(2)}</span>
                </span>
              </>
            )}
          </nav>
          <div className="flex items-center gap-2">
            <AutoRefreshToggle enabled={autoRefresh} onToggle={toggleAutoRefresh} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditDialogOpen(true)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit project
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTabWithUrl} className="mt-6">
          <TabsList className="grid w-full max-w-md grid-cols-4">
            <TabsTrigger value="home" className="cursor-pointer">
              <LayoutGrid className="mr-2 h-4 w-4" />
              Home
            </TabsTrigger>
            <TabsTrigger value="posts" className="cursor-pointer">
              <List className="mr-2 h-4 w-4" />
              Posts
            </TabsTrigger>
            <TabsTrigger value="schedules" className="cursor-pointer">
              <Calendar className="mr-2 h-4 w-4" />
              Schedules
            </TabsTrigger>
            <TabsTrigger value="jobs" className="cursor-pointer">
              <Clock className="mr-2 h-4 w-4" />
              Jobs
            </TabsTrigger>
          </TabsList>

          {/* Home: two-pane layout — left: exploration filters; right: project/product description */}
          <TabsContent value="home" className="mt-4">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Exploration filters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ExplorationFiltersForm
                    subreddits={subreddits}
                    keywords={keywords}
                    value={exploreFilters}
                    onChange={setExploreFilters}
                  />
                  {credit != null && (
                    <p className="text-sm text-muted-foreground">
                      This run uses {Number(credit.creditPerApiCall ?? 1)} credit per API call.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3 pt-2 border-t">
                    <Button
                      onClick={handleRunExplore}
                      disabled={exploring || (credit != null && Number(credit.balance) < Number(credit.creditPerApiCall ?? 1))}
                      title={isJobRunning ? 'A job is already running; you can start another after confirming' : undefined}
                    >
                      {exploring ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Starting...
                        </>
                      ) : (
                        <>
                          <Play className="mr-2 h-4 w-4" />
                          Explore
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingScheduleId(null);
                        setScheduleOpen(true);
                      }}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      Schedule
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <div className="space-y-3">
                {project.description && (
                  <div>
                    <h3 className="text-sm font-medium text-foreground mb-1">Project</h3>
                    <p className="text-muted-foreground whitespace-pre-wrap text-sm">{project.description}</p>
                  </div>
                )}
                {project.productDescription && (
                  <div>
                    <h3 className="text-sm font-medium text-foreground mb-1">Product</h3>
                    <p className="text-muted-foreground whitespace-pre-wrap text-sm">{project.productDescription}</p>
                  </div>
                )}
                {!project.description && !project.productDescription && (
                  <p className="text-muted-foreground text-sm">Edit project to add a description and product description.</p>
                )}
              </div>
            </div>
            {latestJob && latestJob.status === 'RUNNING' && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between rounded border p-3">
                    <span>
                      Current job: <strong>{latestJob.status}</strong>
                      <span className="ml-2 text-muted-foreground">
                        {(latestJob as any).keywordMatchCount ?? 0} matched, {(latestJob as any).uniqueCount ?? 0} unique, {(latestJob as any).totalProcessed ?? 0} total
                      </span>
                    </span>
                    <Button variant="destructive" size="sm" onClick={handleKillJob}>
                      <Square className="mr-2 h-4 w-4" />
                      Kill
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Posts */}
          <TabsContent value="posts">
        <Card>
          <CardHeader className="flex flex-col gap-3">
            <div className="flex flex-row flex-wrap items-center justify-end gap-2">
              <div className="flex flex-wrap gap-2">
                <Select
                  value={filters.status ?? 'all'}
                  onValueChange={(v) =>
                    setFilters((f) => ({
                      ...f,
                      status: v === 'all' ? undefined : (v as 'DOWNLOADED' | 'MATCH' | 'RELEVANT' | 'DISCARDED'),
                    }))
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue>
                      Status: {filters.status === 'DOWNLOADED' ? `Downloaded (${filterCounts?.statusCounts?.DOWNLOADED ?? 0})` : filters.status === 'MATCH' ? `Match (${filterCounts?.statusCounts?.MATCH ?? 0})` : filters.status === 'RELEVANT' ? `Relevant (${filterCounts?.statusCounts?.RELEVANT ?? 0})` : filters.status === 'DISCARDED' ? `Discarded (${filterCounts?.statusCounts?.DISCARDED ?? 0})` : `All (${filterCounts?.statusCounts?.all ?? 0})`}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All ({filterCounts?.statusCounts?.all ?? 0})</SelectItem>
                    <SelectItem value="DOWNLOADED">Downloaded ({filterCounts?.statusCounts?.DOWNLOADED ?? 0})</SelectItem>
                    <SelectItem value="MATCH">Match ({filterCounts?.statusCounts?.MATCH ?? 0})</SelectItem>
                    <SelectItem value="RELEVANT">Relevant ({filterCounts?.statusCounts?.RELEVANT ?? 0})</SelectItem>
                    <SelectItem value="DISCARDED">Discarded ({filterCounts?.statusCounts?.DISCARDED ?? 0})</SelectItem>
                  </SelectContent>
                </Select>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="min-w-[10rem] justify-between">
                      Subreddits: {!filters.subreddits?.length ? `All (${subredditsAllCount})` : `${filters.subreddits.map((s) => `r/${s}`).join(', ')} (${filters.subreddits.length})`}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                    <DropdownMenuCheckboxItem
                      checked={!filters.subreddits?.length}
                      onCheckedChange={(checked) => {
                        if (checked) setFilters((f) => ({ ...f, subreddits: undefined }));
                      }}
                      onSelect={(e) => e.preventDefault()}
                    >
                      All ({subredditsAllCount})
                    </DropdownMenuCheckboxItem>
                    {subreddits.map((s) => (
                      <DropdownMenuCheckboxItem
                        key={s}
                        checked={filters.subreddits?.includes(s) ?? false}
                        onCheckedChange={(checked) => {
                          setFilters((f) => {
                            const current = f.subreddits ?? [];
                            if (checked) {
                              return { ...f, subreddits: current.includes(s) ? current : [...current, s] };
                            }
                            const next = current.filter((x) => x !== s);
                            return { ...f, subreddits: next.length ? next : undefined };
                          });
                        }}
                        onSelect={(e) => e.preventDefault()}
                      >
                        r/{s} ({filterCounts?.subredditCounts?.[s] ?? 0})
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="min-w-[10rem] justify-between">
                      Keywords: {!filters.keywords?.length ? `All (${keywordsAllCount})` : `${filters.keywords.join(', ')} (${filters.keywords.length})`}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                    <DropdownMenuCheckboxItem
                      checked={!filters.keywords?.length}
                      onCheckedChange={(checked) => {
                        if (checked) setFilters((f) => ({ ...f, keywords: undefined }));
                      }}
                      onSelect={(e) => e.preventDefault()}
                    >
                      All ({keywordsAllCount})
                    </DropdownMenuCheckboxItem>
                    {keywords.map((k) => (
                      <DropdownMenuCheckboxItem
                        key={k}
                        checked={filters.keywords?.includes(k) ?? false}
                        onCheckedChange={(checked) => {
                          setFilters((f) => {
                            const current = f.keywords ?? [];
                            if (checked) {
                              return { ...f, keywords: current.includes(k) ? current : [...current, k] };
                            }
                            const next = current.filter((x) => x !== k);
                            return { ...f, keywords: next.length ? next : undefined };
                          });
                        }}
                        onSelect={(e) => e.preventDefault()}
                      >
                        {k} ({filterCounts?.keywordCounts?.[k] ?? 0})
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground text-xs">Posted:</span>
                  <Input
                    type="date"
                    value={filters.postedFrom ?? ''}
                    onChange={(e) => setFilters((f) => ({ ...f, postedFrom: e.target.value || undefined }))}
                    className="h-8 w-36"
                  />
                  <span className="text-muted-foreground text-xs">–</span>
                  <Input
                    type="date"
                    value={filters.postedTo ?? ''}
                    onChange={(e) => setFilters((f) => ({ ...f, postedTo: e.target.value || undefined }))}
                    className="h-8 w-36"
                  />
                </div>
                {aiConfig?.configured === false && (
                  <span className="text-muted-foreground text-xs">Configure Ollama in Admin → Reddit credits to run AI analysis.</span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={runningAiAnalysis || !projectId || aiConfig?.configured === false}
                  onClick={async () => {
                    if (!projectId) return;
                    if (selectedPostIds.length === 1) {
                      setAiAnalysisMessage(null);
                      setRunningAiAnalysis(true);
                      try {
                        const id = selectedPostIds[0];
                        await analyzePost({ projectPostId: id });
                        await refetchPosts();
                        await refetchAiRuns();
                        setAiAnalysisMessage({
                          type: 'success',
                          text: 'AI analysis completed for the selected post.',
                        });
                        setTimeout(() => setAiAnalysisMessage(null), 5000);
                      } catch (err: unknown) {
                        const message =
                          err && typeof err === 'object' && 'message' in err
                            ? String((err as { message: string }).message)
                            : 'Failed to run AI analysis on the selected post.';
                        setAiAnalysisMessage({ type: 'error', text: message });
                      } finally {
                        setRunningAiAnalysis(false);
                      }
                    } else if (selectedPostIds.length > 1) {
                      // Multiple selected -> run via background job using current filters.
                      setRunAiDialogOpen(true);
                    } else {
                      // No selection -> run job based on filters as before.
                      setRunAiDialogOpen(true);
                    }
                  }}
                >
                  {runningAiAnalysis ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {selectedPostIds.length === 1 ? 'Run AI on selected' : 'Run AI analysis'}
                </Button>
                {aiAnalysisMessage && (
                  <span className={aiAnalysisMessage.type === 'error' ? 'text-destructive text-sm' : 'text-muted-foreground text-sm'}>
                    {aiAnalysisMessage.text}
                  </span>
                )}
                <Select
                  value={String(postsPageSize)}
                  onValueChange={(v) => setPostsPageSize(parseInt(v, 10))}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={handleExportClick} disabled={!!exportArgs}>
                  {exportArgs ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  {exportArgs ? 'Exporting…' : 'Export TSV'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed" style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr className="border-b">
                    <th className="p-2 w-8">
                      <Checkbox
                        aria-label="Select all posts on this page"
                        checked={
                          posts.length === 0
                            ? false
                            : posts.every((pp: any) => selectedPostIds.includes(pp.id))
                            ? true
                            : posts.some((pp: any) => selectedPostIds.includes(pp.id))
                            ? 'indeterminate'
                            : false
                        }
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedPostIds(Array.from(new Set([...selectedPostIds, ...posts.map((pp: any) => pp.id)])));
                          } else {
                            const currentIds = new Set(posts.map((pp: any) => pp.id));
                            setSelectedPostIds((ids) => ids.filter((id) => !currentIds.has(id)));
                          }
                        }}
                      />
                    </th>
                    <th className="text-left p-2 whitespace-nowrap">
                      <button
                        type="button"
                        className="flex items-center gap-0.5 hover:text-foreground"
                        onClick={() => {
                          if (postsSortBy === 'postedAt') setPostsOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
                          else { setPostsSortBy('postedAt'); setPostsOrder('desc'); }
                        }}
                      >
                        Posted
                        {postsSortBy === 'postedAt' && (postsOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </button>
                    </th>
                    <th className="text-left p-2">Title</th>
                    <th className="text-left p-2">Author</th>
                    <th className="text-left p-2">Subreddit</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Matched</th>
                    <th className="text-left p-2">AI</th>
                    <th className="text-left p-2 whitespace-nowrap">
                      <button
                        type="button"
                        className="flex items-center gap-0.5 hover:text-foreground"
                        onClick={() => {
                          if (postsSortBy === 'createdAt') setPostsOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
                          else { setPostsSortBy('createdAt'); setPostsOrder('desc'); }
                        }}
                      >
                        Fetched
                        {postsSortBy === 'createdAt' && (postsOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((pp: any) => (
                    <Fragment key={pp.id}>
                      <tr
                        key={pp.id}
                        className={`border-b ${expandedPostId === pp.id ? 'bg-muted/30' : ''} cursor-pointer hover:bg-muted/50`}
                        onClick={() => setExpandedPostId((id) => (id === pp.id ? null : pp.id))}
                      >
                      <td className="p-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          aria-label="Select post"
                          checked={selectedPostIds.includes(pp.id)}
                          onCheckedChange={(checked) => {
                            setSelectedPostIds((ids) =>
                              checked ? [...ids, pp.id] : ids.filter((id) => id !== pp.id)
                            );
                          }}
                        />
                      </td>
                      <td className="p-2 text-muted-foreground whitespace-nowrap text-xs tabular-nums">
                        {pp.post?.postedAt ? new Date(pp.post.postedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </td>
                      <td className="p-2 max-w-xs truncate" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <a
                            href={pp.post?.postLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {pp.post?.title}
                          </a>
                          {pp.lastExportedAt && (
                            <span
                              className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                              title="This post has been exported"
                            >
                              Exported
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2" onClick={(e) => e.stopPropagation()}>
                        <a
                          href={pp.post?.author?.profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {pp.post?.author?.redditUsername}
                        </a>
                      </td>
                      <td className="p-2" onClick={(e) => e.stopPropagation()}>
                        {pp.post?.subreddit ? (
                          <a
                            href={pp.post.subreddit === 'all' ? 'https://reddit.com' : `https://reddit.com/r/${encodeURIComponent(pp.post.subreddit)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            r/{pp.post.subreddit}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-2" onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={pp.status}
                          onValueChange={(v) =>
                            updateStatus({
                              projectPostId: pp.id,
                              status: v as 'DOWNLOADED' | 'MATCH' | 'RELEVANT' | 'DISCARDED',
                            }).then(() => refetchPosts())
                          }
                        >
                          <SelectTrigger className={`w-28 h-8 ${POST_STATUS_COLOR[pp.status] ?? ''}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DOWNLOADED">Downloaded</SelectItem>
                            <SelectItem value="MATCH">Match</SelectItem>
                            <SelectItem value="RELEVANT">Relevant</SelectItem>
                            <SelectItem value="DISCARDED">Discarded</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        {Array.isArray(pp.matchedKeywords) && pp.matchedKeywords.length > 0
                          ? pp.matchedKeywords.join(', ')
                          : '—'}
                      </td>
                      <td className="p-2" onClick={(e) => e.stopPropagation()}>
                        <span className="inline-flex items-center gap-1.5">
                          {analyzingPostId === pp.id ? (
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                          ) : pp.aiAnalysisStatus === 'PENDING' || pp.aiAnalysisStatus === 'IN_PROGRESS' ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : pp.aiAnalysisStatus === 'COMPLETED' ? (
                            pp.painPointSummary ? (
                              <span title="AI summary"><Check className="h-4 w-4 shrink-0 text-green-600" /></span>
                            ) : (
                              <span title="No pain point summary"><X className="h-4 w-4 shrink-0 text-muted-foreground" /></span>
                            )
                          ) : pp.aiAnalysisStatus === 'FAILED' ? (
                            <span title={pp.aiAnalysisErrorMessage ?? 'Analysis failed'}><X className="h-4 w-4 shrink-0 text-destructive" /></span>
                          ) : null}
                          {analyzingPostId !== pp.id && aiConfig?.configured !== false && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              title="Run AI analysis on this post"
                              onClick={() => {
                                setAnalyzingPostId(pp.id);
                                analyzePost({ projectPostId: pp.id })
                                  .then(() => refetchPosts())
                                  .catch(() => refetchPosts())
                                  .finally(() => setAnalyzingPostId(null));
                              }}
                            >
                              <Sparkles className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                            </Button>
                          )}
                        </span>
                      </td>
                      <td className="p-2 text-muted-foreground whitespace-nowrap text-xs tabular-nums">
                        {pp.createdAt ? new Date(pp.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </td>
                    </tr>
                    {expandedPostId === pp.id && (
                      <tr className="border-b bg-muted/20">
                        <td colSpan={9} className="p-4 align-top">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm max-w-full">
                            <div className="min-w-0">
                              <h4 className="font-medium mb-1">Post</h4>
                              <p className="text-muted-foreground text-xs mb-1">
                                {pp.post?.title && <span className="font-medium text-foreground">{pp.post.title}</span>}
                                {pp.post?.postLink && (
                                  <a href={pp.post.postLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">Link</a>
                                )}
                                {pp.post?.author?.redditUsername && (
                                  <span className="ml-1">by u/{pp.post.author.redditUsername}</span>
                                )}
                              </p>
                              <p className="text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
                                {pp.post?.content || '—'}
                              </p>
                            </div>
                            <div className="min-w-0 space-y-3">
                              <div>
                                <h4 className="font-medium mb-1">Pain point / Intent</h4>
                                <p className="text-muted-foreground whitespace-pre-wrap">
                                  {pp.painPointSummary || '—'}
                                </p>
                              </div>
                              {pp.aiReasoning && (
                                <div>
                                  <h4 className="font-medium mb-1">AI Reasoning</h4>
                                  <p className="text-muted-foreground whitespace-pre-wrap">
                                    {pp.aiReasoning}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            {postsTotal > 0 && (
              <div className="flex items-center justify-between gap-4 py-3 border-t text-sm text-muted-foreground">
                <span className="tabular-nums">
                  Showing {posts.length === 0 ? 0 : postsStartIndex + 1}–{postsEndIndex} of {postsTotal}
                  {selectedPostIds.length > 0 && ` · ${selectedPostIds.length} selected`}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={selectedPostIds.length === 0 || !projectId}
                    onClick={async () => {
                      if (!projectId || selectedPostIds.length === 0) return;
                      const confirmed = window.confirm(
                        `Delete ${selectedPostIds.length} selected post(s) from this project? This cannot be undone.`
                      );
                      if (!confirmed) return;
                      try {
                        await deleteRedditBotProjectPosts({
                          projectId,
                          projectPostIds: selectedPostIds,
                        });
                        setSelectedPostIds([]);
                        await refetchPosts();
                      } catch (err) {
                        console.error('Failed to delete selected posts', err);
                        alert('Failed to delete selected posts. See console for details.');
                      }
                    }}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Delete selected
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={postsCursorHistory.length === 0}
                    onClick={() => {
                      const prev = postsCursorHistory[postsCursorHistory.length - 1];
                      setPostsCursorHistory((h) => h.slice(0, -1));
                      setPostsCursor(prev === '' || prev == null ? null : prev);
                    }}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!postsNextCursor}
                    onClick={() => {
                      setPostsCursorHistory((h) => [...h, postsCursor ?? '']);
                      setPostsCursor(postsNextCursor);
                    }}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
            {posts.length === 0 && (
              <p className="text-muted-foreground py-4 text-center">No posts yet. Run an exploration.</p>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          {/* Schedules */}
          <TabsContent value="schedules">
        <Card>
          <CardHeader>
            <CardTitle>Scheduled jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {schedules.map((s: any) => (
                <li
                  key={s.id}
                  className="flex flex-col gap-1.5 rounded border p-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span>Daily at {s.runAtTime ?? s.cronExpression ?? '—'}</span>
                      <span className="text-muted-foreground ml-2">
                        Next: {s.nextRunAt ? new Date(s.nextRunAt).toLocaleString() : '—'}
                      </span>
                    </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingScheduleId(s.id);
                        setScheduleOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Switch
                      checked={s.enabled}
                      onCheckedChange={(v) => handleToggleSchedule(s, v)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setScheduleIdToDelete(s.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {formatJobConfigSummary(s.config)}
                  </p>
                </li>
              ))}
            </ul>
            {schedules.length === 0 && (
              <p className="text-muted-foreground py-2">No schedules. Add one from the Home tab (Schedule button) to run explorations automatically.</p>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          {/* Jobs */}
          <TabsContent value="jobs">
        <Card>
          <CardHeader>
            <CardTitle>Jobs</CardTitle>
            <p className="text-muted-foreground text-sm">Exploration jobs and AI analysis runs in one timeline. Expand for details. Use Kill to stop a running job or run.</p>
          </CardHeader>
          <CardContent>
            {(() => {
              const jobItems = (jobs as any[]).map((j) => ({ type: 'job' as const, id: j.id, createdAt: new Date(j.createdAt).getTime(), data: j }));
              const runItems = (aiRuns as any[]).map((r) => ({ type: 'aiRun' as const, id: r.id, createdAt: new Date(r.createdAt).getTime(), data: r }));
              const activities = [...jobItems, ...runItems].sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);
              const timestampClass = 'text-muted-foreground text-xs tabular-nums whitespace-nowrap';
              const statusColumnClass = 'w-24 shrink-0 text-left';

              return activities.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center">No exploration jobs or AI runs yet. Run an exploration from Home or Run AI analysis from Posts.</p>
              ) : (
                <ul className="space-y-1">
                  {activities.map((item) => {
                    const isJob = item.type === 'job';
                    const key = `${item.type}-${item.id}`;
                    const expanded = expandedActivityId === key;
                    if (isJob) {
                      const j = item.data;
                      const config = j.config as JobConfig | null | undefined;
                      const subredditsLine = config?.subreddits?.length
                        ? config.subreddits.map((s: string) => (s === 'all' ? 'all' : `r/${s}`)).join(', ')
                        : null;
                      const keywordsLine = config?.keywords?.length ? config.keywords.join(', ') : null;
                      const dateRange = config?.relativeDateRange
                        ? `${config.relativeDateRange.start} → ${config.relativeDateRange.end}`
                        : null;
                      const creditsLine =
                        j.redditCreditsUsed != null || j.redditApiCalls != null
                          ? `${Number(j.redditCreditsUsed ?? 0)} credits (${Number(j.redditApiCalls ?? 0)} API calls)`
                          : null;
                      const statusColor = JOB_STATUS_COLOR[j.status] ?? '';
                      return (
                        <li key={key} className="border rounded-md overflow-hidden">
                          <div
                            className="flex items-center gap-3 p-2 text-sm cursor-pointer hover:bg-muted/50"
                            onClick={() => setExpandedActivityId(expanded ? null : key)}
                          >
                            <span className={`font-medium ${statusColumnClass} ${statusColor}`}>{j.status}</span>
                            <span className="flex items-center gap-2 min-w-0 flex-1">
                              <span className={timestampClass}>{new Date(j.createdAt).toLocaleString()}</span>
                              <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                              <span className="rounded px-1.5 py-0.5 text-xs bg-muted shrink-0">Exploration</span>
                              {j.status === 'RUNNING' && j.stopRequestedAt && (
                                <span className="text-amber-600 dark:text-amber-500 text-xs shrink-0">(stop requested)</span>
                              )}
                              <span className="text-muted-foreground truncate">
                                {(j as any).keywordMatchCount ?? 0} matched, {(j as any).uniqueCount ?? 0} unique, {(j as any).totalProcessed ?? 0} total
                                {formatJobDuration(j.createdAt, j.completedAt) != null && ` · ${formatJobDuration(j.createdAt, j.completedAt)}`}
                              </span>
                            </span>
                            <span className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                              {j.status === 'RUNNING' && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  disabled={!!j.stopRequestedAt}
                                  onClick={() => killJob({ jobId: j.id }).then(() => { refetchJobs(); refetchAiRuns(); })}
                                >
                                  <Square className="mr-1 h-3 w-3" />
                                  {j.stopRequestedAt ? 'Stopping…' : 'Kill'}
                                </Button>
                              )}
                            </span>
                          </div>
                          {expanded && (
                            <div className="px-2 pb-2 pt-0 text-sm border-t bg-muted/20 space-y-1">
                              {subredditsLine && <p className="text-muted-foreground text-xs">{subredditsLine}</p>}
                              {keywordsLine && <p className="text-muted-foreground text-xs">{keywordsLine}</p>}
                              {(dateRange || creditsLine) && (
                                <p className="text-muted-foreground text-xs">{[dateRange, creditsLine].filter(Boolean).join(' · ')}</p>
                              )}
                              {j.errorMessage && <p className="text-destructive text-xs">{j.errorMessage}</p>}
                            </div>
                          )}
                        </li>
                      );
                    } else {
                      const r = item.data;
                      const statusColor = AI_RUN_STATUS_COLOR[r.status] ?? '';
                      const linkedJob = r.explorationJobId ? (jobs as any[]).find((j) => j.id === r.explorationJobId) : null;
                      return (
                        <li key={key} className="border rounded-md overflow-hidden">
                          <div
                            className="flex items-center gap-3 p-2 text-sm cursor-pointer hover:bg-muted/50"
                            onClick={() => setExpandedActivityId(expanded ? null : key)}
                          >
                            <span className={`font-medium ${statusColumnClass} ${statusColor}`}>{r.status}</span>
                            <span className="flex items-center gap-2 min-w-0 flex-1">
                              <span className={timestampClass}>{new Date(r.createdAt).toLocaleString()}</span>
                              <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                              <span className="rounded px-1.5 py-0.5 text-xs bg-muted shrink-0">AI analysis</span>
                              {r.status === 'RUNNING' && r.stopRequestedAt && (
                                <span className="text-amber-600 dark:text-amber-500 text-xs shrink-0">(stop requested)</span>
                              )}
                              {r.triggerSource === 'exploration' && (
                                <span className="text-muted-foreground text-xs shrink-0">
                                  {linkedJob
                                    ? `from exploration ${new Date(linkedJob.createdAt).toLocaleString()}`
                                    : `from exploration job`}
                                </span>
                              )}
                              <span className="text-muted-foreground truncate">
                                {r.processedCount} / {r.totalToProcess}
                                {formatJobDuration(r.createdAt, (r as any).completedAt) != null &&
                                  ` · ${formatJobDuration(r.createdAt, (r as any).completedAt)}`}
                              </span>
                            </span>
                            <span className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                              {r.status === 'RUNNING' && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  disabled={!!r.stopRequestedAt}
                                  onClick={() => killAiRun({ runId: r.id }).then(() => { refetchAiRuns(); refetchJobs(); })}
                                >
                                  <Square className="mr-1 h-3 w-3" />
                                  {r.stopRequestedAt ? 'Stopping…' : 'Kill'}
                                </Button>
                              )}
                            </span>
                          </div>
                          {expanded && (
                            <div className="px-2 pb-2 pt-0 text-sm border-t bg-muted/20 space-y-1">
                              {r.triggerSource && (
                                <p className="text-muted-foreground text-xs">
                                  Trigger: {r.triggerSource === 'exploration' ? 'from exploration job' : 'manual'}
                                  {linkedJob && (
                                    <span> (exploration at {new Date(linkedJob.createdAt).toLocaleString()})</span>
                                  )}
                                </p>
                              )}
                              {r.errorMessage && <p className="text-destructive text-xs">{r.errorMessage}</p>}
                            </div>
                          )}
                        </li>
                      );
                    }
                  })}
                </ul>
              );
            })()}
          </CardContent>
        </Card>
          </TabsContent>
        </Tabs>

        <Dialog
          open={scheduleOpen}
          onOpenChange={(open) => {
            setScheduleOpen(open);
            if (!open) {
              setEditingScheduleId(null);
              setScheduleEditFilters(null);
            }
          }}
        >
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingScheduleId ? 'Edit schedule' : 'New schedule'}</DialogTitle>
              <DialogDescription>
                {editingScheduleId
                  ? 'Update exploration filters, run time, and enabled state for this schedule.'
                  : 'Schedule an exploration using the current Home tab filters. Choose a daily run time.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {editingScheduleId && scheduleEditFilters && (
                <ExplorationFiltersForm
                  subreddits={subreddits}
                  keywords={keywords}
                  value={scheduleEditFilters}
                  onChange={setScheduleEditFilters}
                  compact
                  isSchedule
                />
              )}
              {!editingScheduleId && (
                <p className="text-muted-foreground text-sm">
                  The schedule will use the exploration filters currently configured on the Home tab.
                </p>
              )}
              <div>
                <Label className="text-sm">Daily at (UTC)</Label>
                <Input
                  type="time"
                  value={scheduleRunAt}
                  onChange={(e) => setScheduleRunAt(e.target.value)}
                  className="mt-1 h-8"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={scheduleEnabled}
                  onCheckedChange={setScheduleEnabled}
                />
                <Label className="text-sm">Enabled</Label>
              </div>
              {editingScheduleId ? (
                <Button onClick={handleUpdateSchedule} className="w-full">
                  Update schedule
                </Button>
              ) : (
                <Button onClick={handleAddSchedule} className="w-full">
                  Create schedule
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={scheduleIdToDelete != null}
          onOpenChange={(open) => {
            if (!open) setScheduleIdToDelete(null);
          }}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete schedule</DialogTitle>
              <DialogDescription>
                This schedule will stop running. You can add a new one anytime from the Home tab. Delete this schedule?
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setScheduleIdToDelete(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => scheduleIdToDelete && handleDeleteSchedule(scheduleIdToDelete)}
              >
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Export TSV</DialogTitle>
              <DialogDescription>
                Export posts as a tab-separated file. Other filters (subreddits, keywords, dates) always apply.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Scope</Label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="export-scope"
                      checked={exportRelevantOnly}
                      onChange={() => setExportRelevantOnly(true)}
                      className="rounded-full"
                    />
                    <span className="text-sm">Relevant only (default)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="export-scope"
                      checked={!exportRelevantOnly}
                      onChange={() => setExportRelevantOnly(false)}
                      className="rounded-full"
                    />
                    <span className="text-sm">All (current status filter applies)</span>
                  </label>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportOnlyUnexported}
                  onChange={(e) => setExportOnlyUnexported(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Export only posts not yet exported (default)</span>
              </label>
              <p className="text-muted-foreground text-xs">Uncheck to include already exported posts.</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleConfirmExport}>
                  Export
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={runAiDialogOpen} onOpenChange={setRunAiDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Run AI analysis</DialogTitle>
              <DialogDescription>
                Process posts with AI to evaluate relevancy and extract pain points. By default only posts not yet analyzed (or pending) are included.
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm font-medium pt-2">
              {aiProspectiveCount?.count != null
                ? `${aiProspectiveCount.count} post${aiProspectiveCount.count === 1 ? '' : 's'} will be analyzed`
                : 'Counting posts…'}
            </p>
            <div className="space-y-4 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch
                  checked={runAiForceIncludeProcessed}
                  onCheckedChange={setRunAiForceIncludeProcessed}
                />
                <span className="text-sm">Also process posts already completed or failed (re-run AI)</span>
              </label>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRunAiDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={runningAiAnalysis || !projectId || (aiProspectiveCount?.count ?? 0) === 0}
                  onClick={async () => {
                    if (!projectId) return;
                    setAiAnalysisMessage(null);
                    setRunningAiAnalysis(true);
                    try {
                      const result = await triggerAiAnalysis({
                        projectId,
                        includeAlreadyProcessed: runAiForceIncludeProcessed,
                        status: filters.status,
                        subreddits: filters.subreddits,
                        keywords: filters.keywords,
                        postedAfter: filters.postedFrom ? `${filters.postedFrom}T00:00:00.000Z` : undefined,
                        postedBefore: filters.postedTo ? `${filters.postedTo}T23:59:59.999Z` : undefined,
                      });
                      setRunAiDialogOpen(false);
                      refetchPosts();
                      refetchAiRuns();
                      setAiAnalysisMessage({
                        type: 'success',
                        text: result?.totalToProcess != null ? `AI analysis started for ${result.totalToProcess} post(s). See Jobs tab.` : 'AI analysis started. See Jobs tab.',
                      });
                      setTimeout(() => setAiAnalysisMessage(null), 5000);
                    } catch (err: unknown) {
                      const message = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Failed to start AI analysis.';
                      setAiAnalysisMessage({ type: 'error', text: message });
                    } finally {
                      setRunningAiAnalysis(false);
                    }
                  }}
                >
                  {runningAiAnalysis ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Start
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={exploreWithRunningJobDialogOpen} onOpenChange={setExploreWithRunningJobDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Already a running job</DialogTitle>
              <DialogDescription asChild>
                <span>
                  There is already an exploration job running.{' '}
                  <Button
                    variant="link"
                    className="h-auto p-0 text-primary underline"
                    onClick={() => {
                      setExploreWithRunningJobDialogOpen(false);
                      setActiveTabWithUrl('jobs');
                    }}
                  >
                    View jobs
                  </Button>
                  {' '}Do you still want to start a new one?
                </span>
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setExploreWithRunningJobDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={runExploreNow}>
                Run anyway
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit project</DialogTitle>
              <DialogDescription className="sr-only">Edit project name, description, and settings.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label htmlFor="edit-name">Project name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. SaaS leads"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Description (optional)</Label>
                <Textarea
                  id="edit-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Short description"
                  className="mt-1 min-h-[80px]"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="edit-productDescription">Product description (for matching leads)</Label>
                <Textarea
                  id="edit-productDescription"
                  value={editProductDescription}
                  onChange={(e) => setEditProductDescription(e.target.value)}
                  placeholder="What your product does / who it's for"
                  className="mt-1 min-h-[80px]"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="edit-subreddits">Subreddits (comma or space separated)</Label>
                <Input
                  id="edit-subreddits"
                  value={editSubredditsStr}
                  onChange={(e) => setEditSubredditsStr(e.target.value)}
                  placeholder="e.g. webdev, startups, SaaS"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-keywords">Keywords (comma or space separated)</Label>
                <Input
                  id="edit-keywords"
                  value={editKeywordsStr}
                  onChange={(e) => setEditKeywordsStr(e.target.value)}
                  placeholder="e.g. pricing, churn, onboarding"
                  className="mt-1"
                />
              </div>
              <Button
                onClick={handleSaveEdit}
                disabled={!editName.trim() || savingEdit}
                className="w-full"
              >
                {savingEdit ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
