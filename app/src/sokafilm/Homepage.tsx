import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from 'wasp/client/operations';
import { createProject, deleteProject, getAllProjectsByUser, getCharactersByProject, getStoriesByProject } from 'wasp/client/operations';
import type { Project } from 'wasp/entities';
import { Button } from '../client/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../client/components/ui/card';
import { Input } from '../client/components/ui/input';
import { Label } from '../client/components/ui/label';
import { Plus, Loader2, Trash2, Settings, FileImage } from 'lucide-react';
import { cn } from '../client/utils';
import { Link, routes } from 'wasp/client/router';
import { MediaDisplay } from './components/MediaDisplay';

export default function Homepage() {
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const { t } = useTranslation('sokafilm');

  const { data: projects, isLoading, refetch, error } = useQuery(getAllProjectsByUser);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    
    try {
      setIsCreating(true);
      await createProject({ 
        name: newProjectName,
        description: newProjectDescription || undefined
      });
      setNewProjectName('');
      setNewProjectDescription('');
      setIsCreating(false);
      refetch();
    } catch (error) {
      console.error('Error creating project:', error);
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm(t('home.confirmDelete'))) {
      return;
    }
    
    try {
      await deleteProject({ id: projectId });
      refetch();
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  // Show error if projects query fails
  if (error) {
    return (
      <div className='py-10 lg:mt-10'>
        <div className='mx-auto max-w-7xl px-6 lg:px-8'>
          <div className='text-center'>
            <p className='text-red-500'>{t('home.errorLoading', { message: error.message })}</p>
            <Button onClick={() => refetch()} className='mt-4'>
              {t('home.tryAgain')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='py-10 lg:mt-10'>
      <div className='mx-auto max-w-7xl px-6 px-8'>
        {/* Header */}
        <div className='mb-8'>
          <h1 className='text-3xl font-bold tracking-tight text-foreground'>
            {t('home.title')}
          </h1>
          <p className='mt-2 text-muted-foreground'>
            {t('home.subtitle')}
          </p>
        </div>

        {/* Create Project Form */}
        <div className='mb-8 p-6 border rounded-lg bg-muted/50'>
          <h3 className='text-lg font-semibold mb-4'>{t('home.createSection')}</h3>
          <div className='space-y-4'>
            <div>
              <Label htmlFor='name'>{t('home.projectName')}</Label>
              <Input
                id='name'
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder={t('home.projectNamePlaceholder')}
                className='mt-1'
              />
            </div>
            <div>
              <Label htmlFor='description'>{t('home.description')}</Label>
              <Input
                id='description'
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                placeholder={t('home.descriptionPlaceholder')}
                className='mt-1'
              />
            </div>
            <Button 
              onClick={handleCreateProject} 
              disabled={!newProjectName.trim() || isCreating}
              className='w-full'
            >
              {isCreating ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  {t('home.creating')}
                </>
              ) : (
                <>
                  <Plus className='mr-2 h-4 w-4' />
                  {t('home.create')}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Projects Grid */}
        <div className='mt-8'>
          {isLoading ? (
            <div className='flex justify-center'>
              <Loader2 className='h-8 w-8 animate-spin' />
            </div>
          ) : projects && projects.length > 0 ? (
            <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'>
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onDelete={() => handleDeleteProject(project.id)}
                />
              ))}
            </div>
          ) : (
            <div className='text-center text-muted-foreground'>
              <p>{t('home.empty')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ProjectCardProps {
  project: Project;
  onDelete: () => void;
}

function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const { t } = useTranslation('sokafilm');
  const projectName = project.name || t('projectCard.untitled');
  const projectDescription = project.description || null;
  
  // Check if project has characters or stories with proper error handling
  const { data: characters = [], error: charactersError } = useQuery(getCharactersByProject, { projectId: project.id });
  const { data: stories = [], error: storiesError } = useQuery(getStoriesByProject, { projectId: project.id });
  
  // Ignore errors for these queries as they're not critical for the main functionality
  const hasContent = (characters && characters.length > 0) || (stories && stories.length > 0);
  
  const targetRoute = hasContent 
    ? `/sokafilm/project/${project.id}/overview`
    : `/sokafilm/project/${project.id}`;
  
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on buttons
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    window.location.href = targetRoute;
  };
  
  const handleSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `/sokafilm/project/${project.id}/overview?tab=settings`;
  };
  
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };
  
  return (
    <Card 
      className='hover:shadow-lg transition-shadow cursor-pointer'
      onClick={handleCardClick}
    >
      {/* Project Thumbnail */}
      <div className='p-4 pb-0'>
        <MediaDisplay
          fileUuid={project.thumbnailUuid}
          alt={t('projectCard.thumbnailAlt', { name: projectName })}
          className="w-full h-32 rounded-lg overflow-hidden"
          fallbackIcon={<FileImage className="h-12 w-12 text-muted-foreground" />}
        />
      </div>
      
      <CardHeader>
        <CardTitle className='flex items-center justify-between'>
          <span className='truncate'>{projectName}</span>
          <div className='flex gap-2'>
            <Button
              variant='ghost'
              size='sm'
              onClick={handleSettingsClick}
              className='h-8 w-8 p-0'
            >
              <Settings className='h-4 w-4' />
            </Button>
            <Button
              variant='ghost'
              size='sm'
              onClick={handleDeleteClick}
              className='h-8 w-8 p-0 text-destructive hover:text-destructive'
            >
              <Trash2 className='h-4 w-4' />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {projectDescription && (
          <p className='text-sm text-muted-foreground mb-2'>
            {projectDescription}
          </p>
        )}
        <p className='text-sm text-muted-foreground'>
          {t('projectCard.created', { date: new Date(project.createdAt).toLocaleDateString() })}
        </p>
      </CardContent>
    </Card>
  );
}
