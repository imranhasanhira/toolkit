import { useState } from 'react';
import { Button } from '../../client/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../client/components/ui/card';
import { ChevronRight, Square } from 'lucide-react';
import { JOB_STATUS_COLOR, AI_RUN_STATUS_COLOR, type JobConfig, formatJobDuration } from './projectDetailConstants';

type Props = {
  jobs: any[];
  aiRuns: any[];
  refetchJobs: () => void;
  refetchAiRuns: () => void;
  onKillJob: (args: { jobId: string }) => Promise<void>;
  onKillAiRun: (args: { runId: string }) => Promise<void>;
};

export function ProjectDetailJobsTab({
  jobs,
  aiRuns,
  refetchJobs,
  refetchAiRuns,
  onKillJob,
  onKillAiRun,
}: Props) {
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);

  const jobItems = jobs.map((j: any) => ({ type: 'job' as const, id: j.id, createdAt: new Date(j.createdAt).getTime(), data: j }));
  const runItems = aiRuns.map((r: any) => ({ type: 'aiRun' as const, id: r.id, createdAt: new Date(r.createdAt).getTime(), data: r }));
  const activities = [...jobItems, ...runItems].sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);
  const timestampClass = 'text-muted-foreground text-xs tabular-nums whitespace-nowrap';
  const statusColumnClass = 'w-24 shrink-0 text-left';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jobs</CardTitle>
        <p className="text-muted-foreground text-sm">
          Exploration jobs and AI analysis runs in one timeline. Expand for details. Use Kill to stop a running job or run.
        </p>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center">
            No exploration jobs or AI runs yet. Run an exploration from Home or Run AI analysis from Posts.
          </p>
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
                          {j.keywordMatchCount ?? 0} matched, {j.uniqueCount ?? 0} unique, {j.totalProcessed ?? 0} total
                          {formatJobDuration(j.createdAt, j.completedAt) != null && ` · ${formatJobDuration(j.createdAt, j.completedAt)}`}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {j.status === 'RUNNING' && (
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={!!j.stopRequestedAt}
                            onClick={() =>
                              onKillJob({ jobId: j.id }).then(() => {
                                refetchJobs();
                                refetchAiRuns();
                              })
                            }
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
                const linkedJob = r.explorationJobId ? jobs.find((j) => j.id === r.explorationJobId) : null;
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
                              : 'from exploration job'}
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
                            onClick={() =>
                              onKillAiRun({ runId: r.id }).then(() => {
                                refetchAiRuns();
                                refetchJobs();
                              })
                            }
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
        )}
      </CardContent>
    </Card>
  );
}
