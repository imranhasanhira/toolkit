import { Link } from 'react-router';
import { Button } from '../../client/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '../../client/components/ui/tabs';
import { ChevronRight, Calendar, List, Clock, LayoutGrid, Pencil } from 'lucide-react';
import { AutoRefreshToggle } from '../useAutoRefresh';
import { routes } from 'wasp/client/router';

type Props = {
  project: { name: string };
  projectCredit: { creditsUsed: unknown } | null | undefined;
  onEditClick: () => void;
  autoRefresh: boolean;
  toggleAutoRefresh: () => void;
  activeTab: string;
  onTabChange: (value: string) => void;
  children: React.ReactNode;
};

export function ProjectDetailShell({
  project,
  projectCredit,
  onEditClick,
  autoRefresh,
  toggleAutoRefresh,
  activeTab,
  onTabChange,
  children,
}: Props) {
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <nav
          className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
          aria-label="Breadcrumb"
        >
          <Link to={routes.RedditBotRoute.to} className="hover:text-foreground transition-colors">
            Reddit Bot
          </Link>
          <ChevronRight className="h-4 w-4 shrink-0" />
          <h1 className="truncate text-foreground font-semibold text-base">{project.name}</h1>
          {projectCredit != null && (
            <>
              <span className="mx-1.5">·</span>
              <span className="text-muted-foreground text-sm">
                Credits used (this project):{' '}
                <span className="font-medium text-foreground">
                  {Number(projectCredit.creditsUsed).toFixed(2)}
                </span>
              </span>
            </>
          )}
        </nav>
        <div className="flex items-center gap-2">
          <AutoRefreshToggle enabled={autoRefresh} onToggle={toggleAutoRefresh} />
          <Button variant="outline" size="sm" onClick={onEditClick}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit project
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={onTabChange} className="mt-6">
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
        {children}
      </Tabs>
    </>
  );
}
