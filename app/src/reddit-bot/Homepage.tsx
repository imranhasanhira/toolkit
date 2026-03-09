import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useAction } from 'wasp/client/operations';
import {
  createRedditBotProject,
  deleteRedditBotProject,
  getRedditBotProjects,
  getMyRedditCredit,
} from 'wasp/client/operations';
import type { RedditBotProject } from 'wasp/entities';
import { routes } from 'wasp/client/router';
import { Button } from '../client/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../client/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../client/components/ui/dialog';
import { Input } from '../client/components/ui/input';
import { Label } from '../client/components/ui/label';
import { Textarea } from '../client/components/ui/textarea';
import { Plus, Loader2, Trash2 } from 'lucide-react';
import { useAutoRefresh, AutoRefreshToggle } from './useAutoRefresh';

export default function RedditBotHomepage() {
  const navigate = useNavigate();
  const { autoRefresh, toggleAutoRefresh, queryOpts } = useAutoRefresh();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [projectIdToDelete, setProjectIdToDelete] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [subredditsStr, setSubredditsStr] = useState('');
  const [keywordsStr, setKeywordsStr] = useState('');

  const { data: projects, isLoading, refetch, error } = useQuery(getRedditBotProjects, queryOpts);
  const { data: credit } = useQuery(getMyRedditCredit, queryOpts);
  const createProject = useAction(createRedditBotProject);
  const deleteProject = useAction(deleteRedditBotProject);

  const resetCreateForm = () => {
    setName('');
    setDescription('');
    setProductDescription('');
    setSubredditsStr('');
    setKeywordsStr('');
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    const subreddits = subredditsStr
      .split(/[\s,]+/)
      .map((s) => s.trim().replace(/^r\//, ''))
      .filter(Boolean);
    const keywords = keywordsStr
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      setIsCreating(true);
      const project = await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        productDescription: productDescription.trim() || undefined,
        subreddits,
        keywords,
      });
      resetCreateForm();
      setCreateDialogOpen(false);
      refetch();
      navigate(routes.RedditBotProjectRoute.build({ params: { projectId: (project as RedditBotProject).id } }));
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreating(false);
    }
  };

  const handleConfirmDelete = async (projectId: string) => {
    try {
      await deleteProject({ id: projectId });
      setProjectIdToDelete(null);
      refetch();
    } catch (e) {
      console.error(e);
    }
  };

  if (error) {
    return (
      <div className="py-10 lg:mt-10">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <p className="text-red-500">Error: {error.message}</p>
          <Button onClick={() => refetch()} className="mt-4">Try again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-10 lg:mt-10">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">Reddit Bot</h1>
              <AutoRefreshToggle enabled={autoRefresh} onToggle={toggleAutoRefresh} />
            </div>
            <p className="mt-2 text-muted-foreground">
              Lead generation from Reddit. Create a project to explore subreddits and find leads.
            </p>
          </div>
          {credit != null && (
            <div className="rounded-md border bg-muted/30 px-4 py-2 text-sm">
              <span className="text-muted-foreground">Reddit credits: </span>
              <span className="font-medium">{Number(credit.balance)} left</span>
              <span className="text-muted-foreground"> ({Number(credit.totalUsed)} used total)</span>
            </div>
          )}
        </div>

        <div className="mt-8">
          {isLoading ? (
            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <Card
                className="flex cursor-pointer flex-col items-center justify-center border-dashed py-12 transition-colors hover:border-primary/50 hover:bg-muted/50"
                onClick={() => setCreateDialogOpen(true)}
              >
                <Plus className="h-10 w-10 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium text-muted-foreground">New project</p>
              </Card>
              {projects?.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onOpen={() => navigate(routes.RedditBotProjectRoute.build({ params: { projectId: project.id } }))}
                  onDelete={() => setProjectIdToDelete(project.id)}
                />
              ))}
            </div>
          )}
          {!isLoading && projects?.length === 0 && (
            <p className="mt-4 text-center text-muted-foreground">
              Click &quot;New project&quot; to create your first project.
            </p>
          )}
        </div>

        <Dialog
          open={projectIdToDelete != null}
          onOpenChange={(open) => {
            if (!open) setProjectIdToDelete(null);
          }}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete project</DialogTitle>
              <DialogDescription>
                This will permanently delete the project and all its posts, schedules, and job history. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setProjectIdToDelete(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => projectIdToDelete && handleConfirmDelete(projectIdToDelete)}
              >
                Delete project
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>New project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label htmlFor="create-name">Project name</Label>
                <Input
                  id="create-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. SaaS leads"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="create-description">Description (optional)</Label>
                <Textarea
                  id="create-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short description"
                  className="mt-1 min-h-[80px]"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="create-productDescription">Product description (for matching leads)</Label>
                <Textarea
                  id="create-productDescription"
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder="What your product does / who it's for"
                  className="mt-1 min-h-[80px]"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="create-subreddits">Subreddits (comma or space separated)</Label>
                <Input
                  id="create-subreddits"
                  value={subredditsStr}
                  onChange={(e) => setSubredditsStr(e.target.value)}
                  placeholder="e.g. webdev, startups, SaaS"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="create-keywords">Keywords (comma or space separated)</Label>
                <Input
                  id="create-keywords"
                  value={keywordsStr}
                  onChange={(e) => setKeywordsStr(e.target.value)}
                  placeholder="e.g. pricing, churn, onboarding"
                  className="mt-1"
                />
              </div>
              <Button
                onClick={handleCreate}
                disabled={!name.trim() || isCreating}
                className="w-full"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create project
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  onOpen,
  onDelete,
}: {
  project: RedditBotProject;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const subreddits = (project.subreddits as string[]) || [];
  const keywords = (project.keywords as string[]) || [];
  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-lg"
      onClick={onOpen}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="truncate text-lg">{project.name}</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {project.description && (
          <p className="text-sm text-muted-foreground">{project.description}</p>
        )}
        {project.productDescription && (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{project.productDescription}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          r/{subreddits.slice(0, 3).join(', r/')}
          {subreddits.length > 3 ? '…' : ''} · {keywords.slice(0, 3).join(', ')}
          {keywords.length > 3 ? '…' : ''}
        </p>
      </CardContent>
    </Card>
  );
}
