import { Button } from '../../client/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../client/components/ui/card';
import { Calendar, Loader2, Play, Square } from 'lucide-react';
import ExplorationFiltersForm, { type ExplorationFiltersValue } from '../ExplorationFiltersForm';

type Props = {
  project: any;
  subreddits: string[];
  keywords: string[];
  credit: { balance: unknown; creditPerApiCall?: unknown } | null | undefined;
  exploreFilters: ExplorationFiltersValue;
  onExploreFiltersChange: (value: ExplorationFiltersValue) => void;
  onRunExplore: () => void;
  onScheduleClick: () => void;
  onKillJob: () => void;
  exploring: boolean;
  isJobRunning: boolean;
  latestJob: any;
};

export function ProjectDetailHomeTab({
  project,
  subreddits,
  keywords,
  credit,
  exploreFilters,
  onExploreFiltersChange,
  onRunExplore,
  onScheduleClick,
  onKillJob,
  exploring,
  isJobRunning,
  latestJob,
}: Props) {
  return (
    <>
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
              onChange={onExploreFiltersChange}
            />
            <div className="flex flex-wrap gap-3 pt-2 border-t">
              <Button
                onClick={onRunExplore}
                disabled={
                  exploring ||
                  (credit != null && Number(credit.balance) < Number(credit.creditPerApiCall ?? 1))
                }
                title={
                  isJobRunning
                    ? 'A job is already running; you can start another after confirming'
                    : undefined
                }
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
              <Button variant="outline" onClick={onScheduleClick}>
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
              <p className="text-muted-foreground whitespace-pre-wrap text-sm">
                {project.productDescription}
              </p>
            </div>
          )}
          {!project.description && !project.productDescription && (
            <p className="text-muted-foreground text-sm">
              Edit project to add a description and product description.
            </p>
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
                  {latestJob.keywordMatchCount ?? 0} matched, {latestJob.uniqueCount ?? 0} unique,{' '}
                  {latestJob.totalProcessed ?? 0} total
                  {(latestJob.aiAnalysisSkippedCount ?? 0) > 0 && `, ${latestJob.aiAnalysisSkippedCount} AI skipped`}
                </span>
              </span>
              <Button variant="destructive" size="sm" onClick={onKillJob}>
                <Square className="mr-2 h-4 w-4" />
                Kill
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
