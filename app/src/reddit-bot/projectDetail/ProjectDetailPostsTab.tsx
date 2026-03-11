import { useState, useEffect, useMemo } from 'react';
import { useQuery, useAction } from 'wasp/client/operations';
import {
  getRedditBotProjectPosts,
  getRedditBotProjectPostsForExport,
  getRedditBotProjectPostFilterCounts,
  getRedditAiAnalysisProspectiveCount,
  updateRedditBotProjectPostStatus,
  analyzeRedditBotProjectPost,
  triggerRedditAiAnalysis,
  markRedditBotProjectPostsAsExported,
  deleteRedditBotProjectPosts,
} from 'wasp/client/operations';
import { Button } from '../../client/components/ui/button';
import { Card, CardContent, CardHeader } from '../../client/components/ui/card';
import { Input } from '../../client/components/ui/input';
import { ConfirmationDialog } from '../../client/components/ui/confirmation-dialog';
import { ExportDialog } from './dialogs/ExportDialog';
import { RunAiAnalysisDialog } from './dialogs/RunAiAnalysisDialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../../client/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../client/components/ui/select';
import { ChevronDown, Download, Info, Loader2, Sparkles } from 'lucide-react';
import { PAGE_SIZE_OPTIONS, POSTS_PAGE_SIZE_KEY } from './projectDetailConstants';
import { PostsTable } from './PostsTable';

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

type FiltersState = {
  status?: 'DOWNLOADED' | 'MATCH' | 'RELEVANT' | 'DISCARDED';
  subreddits?: string[];
  keywords?: string[];
  postedFrom?: string;
  postedTo?: string;
};

type Props = {
  projectId: string | undefined;
  project: any;
  aiConfig: any;
  refetchAiRuns: () => void;
  queryOpts: { refetchOnWindowFocus: boolean };
  autoRefresh: boolean;
};

export function ProjectDetailPostsTab({
  projectId,
  project,
  aiConfig,
  refetchAiRuns,
  queryOpts,
  autoRefresh,
}: Props) {
  const subreddits = (project?.subreddits as string[]) || [];
  const keywords = (project?.keywords as string[]) || [];

  const [filters, setFilters] = useState<FiltersState>({});
  const [postsSortBy, setPostsSortBy] = useState<'postedAt' | 'createdAt'>('postedAt');
  const [postsOrder, setPostsOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [postsPageSize, setPostsPageSizeState] = useState<number>(() => {
    if (typeof window === 'undefined') return 20;
    const v = localStorage.getItem(POSTS_PAGE_SIZE_KEY);
    const n = v ? parseInt(v, 10) : 20;
    return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n) ? n : 20;
  });
  const setPostsPageSize = (size: number) => {
    setPostsPageSizeState(size);
    try {
      localStorage.setItem(POSTS_PAGE_SIZE_KEY, String(size));
    } catch (_) {}
    setPostsCursor(null);
    setPostsCursorHistory([]);
  };
  const [postsCursor, setPostsCursor] = useState<string | null>(null);
  const [postsCursorHistory, setPostsCursorHistory] = useState<string[]>([]);
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [exportArgs, setExportArgs] = useState<ExportArgs | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportOnlyUnexported, setExportOnlyUnexported] = useState(true);
  const [exportRelevantOnly, setExportRelevantOnly] = useState(true);
  const [runAiDialogOpen, setRunAiDialogOpen] = useState(false);
  const [runAiForceIncludeProcessed, setRunAiForceIncludeProcessed] = useState(false);
  const [deleteSelectedDialogOpen, setDeleteSelectedDialogOpen] = useState(false);
  const [analyzingPostId, setAnalyzingPostId] = useState<string | null>(null);
  const [aiAnalysisMessage, setAiAnalysisMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [runningAiAnalysis, setRunningAiAnalysis] = useState(false);

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
  const { data: postsData, refetch: refetchPosts } = useQuery(
    getRedditBotProjectPosts,
    postsQueryArgs,
    queryOpts
  );
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
    { enabled: !!filterCountsArgs?.projectId, ...queryOpts }
  );
  const subredditsAllCount = filterCounts?.subredditCounts
    ? Object.values(filterCounts.subredditCounts).reduce((a: number, b: number) => a + b, 0)
    : 0;
  const keywordsAllCount = filterCounts?.totalForKeywordAll ?? 0;

  const { data: exportData } = useQuery(
    getRedditBotProjectPostsForExport,
    exportArgs ?? { projectId: projectId ?? '' },
    { enabled: !!exportArgs && !!projectId, ...queryOpts }
  );

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

  const markAsExported = useAction(markRedditBotProjectPostsAsExported);
  const updateStatus = useAction(updateRedditBotProjectPostStatus);
  const analyzePost = useAction(analyzeRedditBotProjectPost);
  const triggerAiAnalysis = useAction(triggerRedditAiAnalysis);
  const deleteRedditBotProjectPostsAction = useAction(deleteRedditBotProjectPosts);

  const hasPendingOrInProgressAi = posts.some(
    (pp: any) => pp.aiAnalysisStatus === 'PENDING' || pp.aiAnalysisStatus === 'IN_PROGRESS'
  );
  useEffect(() => {
    if (autoRefresh && hasPendingOrInProgressAi) {
      const t = setInterval(refetchPosts, 5000);
      return () => clearInterval(t);
    }
  }, [autoRefresh, hasPendingOrInProgressAi, refetchPosts]);

  useEffect(() => {
    setSelectedPostIds([]);
  }, [
    filters.status,
    filters.subreddits,
    filters.keywords,
    filters.postedFrom,
    filters.postedTo,
    postsSortBy,
    postsOrder,
    postsCursor,
  ]);

  useEffect(() => {
    setPostsCursor(null);
    setPostsCursorHistory([]);
  }, [
    filters.status,
    filters.subreddits,
    filters.keywords,
    filters.postedFrom,
    filters.postedTo,
    postsSortBy,
    postsOrder,
  ]);

  useEffect(() => {
    if (!exportArgs || !exportData) return;
    const headers = [
      'title',
      'content',
      'postLink',
      'authorName',
      'authorLink',
      'status',
      'painPointSummary',
      'matchedKeywords',
      'subreddit',
      'postedAt',
      'fetchedAt',
    ];
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

  const handleExportClick = () => {
    if (!projectId) return;
    if (selectedPostIds.length > 0) {
      setExportArgs({ projectId, projectPostIds: selectedPostIds });
    } else {
      setExportDialogOpen(true);
    }
  };

  const handleConfirmExport = () => {
    if (!projectId) return;
    if (selectedPostIds.length > 0) {
      setExportArgs({ projectId, projectPostIds: selectedPostIds });
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

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3">
          <div className="flex flex-row flex-wrap items-center justify-start gap-2">
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
                    Status:{' '}
                    {filters.status === 'DOWNLOADED'
                      ? `Downloaded (${filterCounts?.statusCounts?.DOWNLOADED ?? 0})`
                      : filters.status === 'MATCH'
                        ? `Match (${filterCounts?.statusCounts?.MATCH ?? 0})`
                        : filters.status === 'RELEVANT'
                          ? `Relevant (${filterCounts?.statusCounts?.RELEVANT ?? 0})`
                          : filters.status === 'DISCARDED'
                            ? `Discarded (${filterCounts?.statusCounts?.DISCARDED ?? 0})`
                            : `All (${filterCounts?.statusCounts?.all ?? 0})`}
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
                    Subreddits:{' '}
                    {!filters.subreddits?.length
                      ? `All (${subredditsAllCount})`
                      : `${filters.subreddits.map((s) => `r/${s}`).join(', ')} (${filters.subreddits.length})`}
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
                    Keywords:{' '}
                    {!filters.keywords?.length
                      ? `All (${keywordsAllCount})`
                      : `${filters.keywords.join(', ')} (${filters.keywords.length})`}
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
                <span className="text-muted-foreground text-xs">
                  Configure Ollama in Admin → Reddit credits to run AI analysis.
                </span>
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
                    setRunAiDialogOpen(true);
                  } else {
                    setRunAiDialogOpen(true);
                  }
                }}
              className="min-w-[4.5rem]"
              title="Run AI analysis"
              >
                {runningAiAnalysis ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 shrink-0" />
                )}
                <span
                  className="w-5 h-5 flex items-center justify-center shrink-0 text-muted-foreground"
                  title={
                    selectedPostIds.length > 0
                      ? `${selectedPostIds.length} selected item${selectedPostIds.length === 1 ? '' : 's'} will be applied`
                      : undefined
                  }
                >
                  {selectedPostIds.length > 0 ? <Info className="h-3.5 w-3.5" /> : ''}
                </span>
              </Button>
              {aiAnalysisMessage && (
                <span
                  className={
                    aiAnalysisMessage.type === 'error' ? 'text-destructive text-sm' : 'text-muted-foreground text-sm'
                  }
                >
                  {aiAnalysisMessage.text}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportClick}
                disabled={!!exportArgs}
                className="min-w-[4.5rem]"
                title="Export TSV"
              >
                {exportArgs ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 shrink-0" />
                )}
                <span
                  className="w-5 h-5 flex items-center justify-center shrink-0 text-muted-foreground"
                  title={
                    selectedPostIds.length > 0
                      ? `${selectedPostIds.length} selected item${selectedPostIds.length === 1 ? '' : 's'} will be applied`
                      : undefined
                  }
                >
                  {selectedPostIds.length > 0 ? <Info className="h-3.5 w-3.5" /> : ''}
                </span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <PostsTable
            posts={posts}
            selectedPostIds={selectedPostIds}
            setSelectedPostIds={setSelectedPostIds}
            expandedPostId={expandedPostId}
            setExpandedPostId={setExpandedPostId}
            postsSortBy={postsSortBy}
            setPostsSortBy={setPostsSortBy}
            postsOrder={postsOrder}
            setPostsOrder={setPostsOrder}
            updateStatus={updateStatus}
            refetchPosts={refetchPosts}
            analyzingPostId={analyzingPostId}
            setAnalyzingPostId={setAnalyzingPostId}
            analyzePost={analyzePost}
            aiConfig={aiConfig}
            postsTotal={postsTotal}
            postsStartIndex={postsStartIndex}
            postsEndIndex={postsEndIndex}
            postsCursorHistory={postsCursorHistory}
            postsNextCursor={postsNextCursor}
            postsCursor={postsCursor}
            setPostsCursorHistory={setPostsCursorHistory}
            setPostsCursor={setPostsCursor}
            postsPageSize={postsPageSize}
            setPostsPageSize={setPostsPageSize}
            onDeleteSelected={async () => {
              if (projectId && selectedPostIds.length > 0) setDeleteSelectedDialogOpen(true);
            }}
            projectId={projectId}
          />
        </CardContent>
      </Card>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        exportOnlyUnexported={exportOnlyUnexported}
        setExportOnlyUnexported={setExportOnlyUnexported}
        exportRelevantOnly={exportRelevantOnly}
        setExportRelevantOnly={setExportRelevantOnly}
        onConfirm={handleConfirmExport}
      />

      <ConfirmationDialog
        open={deleteSelectedDialogOpen}
        onOpenChange={setDeleteSelectedDialogOpen}
        title="Delete selected posts"
        description={`Delete ${selectedPostIds.length} selected post(s) from this project? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={async () => {
          if (!projectId || selectedPostIds.length === 0) return;
          try {
            await deleteRedditBotProjectPostsAction({
              projectId,
              projectPostIds: selectedPostIds,
            });
            setSelectedPostIds([]);
            await refetchPosts();
          } catch (err) {
            console.error('Failed to delete selected posts', err);
            setAiAnalysisMessage({
              type: 'error',
              text: 'Failed to delete selected posts. See console for details.',
            });
            setTimeout(() => setAiAnalysisMessage(null), 5000);
          }
        }}
      />

      <RunAiAnalysisDialog
        open={runAiDialogOpen}
        onOpenChange={setRunAiDialogOpen}
        runAiForceIncludeProcessed={runAiForceIncludeProcessed}
        setRunAiForceIncludeProcessed={setRunAiForceIncludeProcessed}
        prospectiveCount={aiProspectiveCount?.count}
        running={runningAiAnalysis}
        startDisabled={!projectId || (aiProspectiveCount?.count ?? 0) === 0}
        onStart={async () => {
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
              text:
                result?.totalToProcess != null
                  ? `AI analysis started for ${result.totalToProcess} post(s). See Jobs tab.`
                  : 'AI analysis started. See Jobs tab.',
            });
            setTimeout(() => setAiAnalysisMessage(null), 5000);
          } catch (err: unknown) {
            const message =
              err && typeof err === 'object' && 'message' in err
                ? String((err as { message: string }).message)
                : 'Failed to start AI analysis.';
            setAiAnalysisMessage({ type: 'error', text: message });
          } finally {
            setRunningAiAnalysis(false);
          }
        }}
      />
    </>
  );
}
