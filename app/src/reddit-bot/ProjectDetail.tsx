import { useParams, useSearchParams, Link } from 'react-router';
import { useQuery, useAction } from 'wasp/client/operations';
import {
  getRedditBotProjectById,
  getRedditBotJobsByProject,
  getRedditBotAiAnalysisRunsByProject,
  getRedditBotSchedulesByProject,
  getRedditBotProjectCreditUsed,
  killRedditAiAnalysisRun,
  runRedditBotExploration,
  killRedditBotJob,
  createRedditBotSchedule,
  updateRedditBotSchedule,
  deleteRedditBotSchedule,
  getMyRedditCredit,
  getRedditAiConfigStatus,
  updateRedditBotProject,
} from 'wasp/client/operations';
import { routes } from 'wasp/client/router';
import { Button } from '../client/components/ui/button';
import { TabsContent } from '../client/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAutoRefresh, AutoRefreshToggle } from './useAutoRefresh';
import {
  TAB_VALUES,
  formatJobConfigSummary,
} from './projectDetail/projectDetailConstants';
import { ProjectDetailJobsTab } from './projectDetail/ProjectDetailJobsTab';
import { ProjectDetailSchedulesTab } from './projectDetail/ProjectDetailSchedulesTab';
import { ProjectDetailHomeTab } from './projectDetail/ProjectDetailHomeTab';
import { ProjectDetailPostsTab } from './projectDetail/ProjectDetailPostsTab';
import { ProjectDetailShell } from './projectDetail/ProjectDetailShell';
import { EditProjectDialog } from './projectDetail/dialogs/EditProjectDialog';
import { ScheduleDialog } from './projectDetail/dialogs/ScheduleDialog';
import { DeleteScheduleDialog } from './projectDetail/dialogs/DeleteScheduleDialog';
import { ExploreWithRunningJobDialog } from './projectDetail/dialogs/ExploreWithRunningJobDialog';

import ExplorationFiltersForm, { type ExplorationFiltersValue } from './ExplorationFiltersForm';

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

  const { data: project, isLoading: projectLoading, error: projectError, refetch: refetchProject } = useQuery(
    getRedditBotProjectById,
    { projectId: projectId! },
    queryOpts
  );
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
  const [exploreWithRunningJobDialogOpen, setExploreWithRunningJobDialogOpen] = useState(false);

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

  // Default Home filters to full project subreddits/keywords when project loads or changes
  useEffect(() => {
    if (project) {
      const subs = (project.subreddits as string[]) || [];
      const kws = (project.keywords as string[]) || [];
      setExploreFilters((prev) => ({ ...prev, selectedSubreddits: subs, selectedKeywords: kws }));
    }
  }, [project?.id]);

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
        <ProjectDetailShell
          project={project}
          projectCredit={projectCredit}
          onEditClick={() => setEditDialogOpen(true)}
          autoRefresh={autoRefresh}
          toggleAutoRefresh={toggleAutoRefresh}
          activeTab={activeTab}
          onTabChange={setActiveTabWithUrl}
        >
          {/* Home — lazy-mounted */}
          <TabsContent value="home" className="mt-4">
            {activeTab === 'home' && (
              <ProjectDetailHomeTab
                project={project}
                subreddits={subreddits}
                keywords={keywords}
                credit={credit}
                exploreFilters={exploreFilters}
                onExploreFiltersChange={setExploreFilters}
                onRunExplore={handleRunExplore}
                onScheduleClick={() => {
                  setEditingScheduleId(null);
                  setScheduleOpen(true);
                }}
                onKillJob={handleKillJob}
                exploring={exploring}
                isJobRunning={isJobRunning}
                latestJob={latestJob}
              />
            )}
          </TabsContent>

          {/* Posts — lazy-mounted; tab owns all posts state, queries, and Export/Run AI dialogs */}
          <TabsContent value="posts" className="mt-4">
            {activeTab === 'posts' && (
              <ProjectDetailPostsTab
                projectId={projectId}
                project={project}
                aiConfig={aiConfig}
                refetchAiRuns={refetchAiRuns}
                queryOpts={queryOpts}
                autoRefresh={autoRefresh}
              />
            )}
          </TabsContent>

          {/* Schedules — lazy-mounted */}
          <TabsContent value="schedules" className="mt-4">
            {activeTab === 'schedules' && (
              <ProjectDetailSchedulesTab
                schedules={schedules}
                onEditSchedule={(id) => {
                  setEditingScheduleId(id);
                  setScheduleOpen(true);
                }}
                onDeleteSchedule={setScheduleIdToDelete}
                onToggleSchedule={handleToggleSchedule}
              />
            )}
          </TabsContent>

          {/* Jobs — lazy-mounted so content is built only when tab is active */}
          <TabsContent value="jobs" className="mt-4">
            {activeTab === 'jobs' && (
              <ProjectDetailJobsTab
                jobs={jobs ?? []}
                aiRuns={aiRuns ?? []}
                refetchJobs={refetchJobs}
                refetchAiRuns={refetchAiRuns}
                onKillJob={(args) => killJob(args)}
                onKillAiRun={(args) => killAiRun(args)}
              />
            )}
          </TabsContent>
        </ProjectDetailShell>

        <ScheduleDialog
          open={scheduleOpen}
          onOpenChange={(open) => {
            setScheduleOpen(open);
            if (!open) {
              setEditingScheduleId(null);
              setScheduleEditFilters(null);
            }
          }}
          editingScheduleId={editingScheduleId}
          subreddits={subreddits}
          keywords={keywords}
          scheduleEditFilters={scheduleEditFilters}
          setScheduleEditFilters={setScheduleEditFilters}
          scheduleRunAt={scheduleRunAt}
          setScheduleRunAt={setScheduleRunAt}
          scheduleEnabled={scheduleEnabled}
          setScheduleEnabled={setScheduleEnabled}
          onUpdate={handleUpdateSchedule}
          onAdd={handleAddSchedule}
        />

        <DeleteScheduleDialog
          open={scheduleIdToDelete != null}
          onOpenChange={(open) => {
            if (!open) setScheduleIdToDelete(null);
          }}
          scheduleIdToDelete={scheduleIdToDelete}
          onConfirm={handleDeleteSchedule}
        />

        <ExploreWithRunningJobDialog
          open={exploreWithRunningJobDialogOpen}
          onOpenChange={setExploreWithRunningJobDialogOpen}
          onViewJobs={() => {
            setExploreWithRunningJobDialogOpen(false);
            setActiveTabWithUrl('jobs');
          }}
          onRunAnyway={runExploreNow}
        />

        <EditProjectDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          editName={editName}
          setEditName={setEditName}
          editDescription={editDescription}
          setEditDescription={setEditDescription}
          editProductDescription={editProductDescription}
          setEditProductDescription={setEditProductDescription}
          editSubredditsStr={editSubredditsStr}
          setEditSubredditsStr={setEditSubredditsStr}
          editKeywordsStr={editKeywordsStr}
          setEditKeywordsStr={setEditKeywordsStr}
          savingEdit={savingEdit}
          onSave={handleSaveEdit}
        />
      </div>
    </div>
  );
}
