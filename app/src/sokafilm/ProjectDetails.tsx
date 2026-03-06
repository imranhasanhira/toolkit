import React, { useState, useEffect } from 'react';
import { Link } from 'wasp/client/router';
import { useParams, useNavigate, useLocation } from 'react-router';
import { useQuery } from 'wasp/client/operations';
import { 
  getProjectById, 
  getCharactersByProject, 
  getStoriesByProject,
  getScenesByStory
} from 'wasp/client/operations';
import type { Project, Character, Story, Scene } from 'wasp/entities';
import { Button } from '../client/components/ui/button';
import { Loader2, Users, BookOpen, Settings, FolderOpen, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import { StoryOverview } from './components/StoryOverview';
import { CharactersOverview } from './components/CharactersOverview';
import { ProjectAiSettings } from './components/ProjectAiSettings';
import { StoryDetails } from './components/StoryDetails';

export default function ProjectDetails() {
  const { projectId, storyId } = useParams<{ projectId: string; storyId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  const { data: project, isLoading: projectLoading } = useQuery(getProjectById, { projectId: projectId! });
  const { data: characters, isLoading: charactersLoading, refetch: refetchCharacters } = useQuery(getCharactersByProject, { projectId: projectId! });
  const { data: stories, isLoading: storiesLoading, refetch: refetchStories } = useQuery(getStoriesByProject, { projectId: projectId! });

  // Initialize activeTab from URL or default to 'stories'
  const [activeTab, setActiveTab] = useState<'characters' | 'stories' | 'settings'>(() => {
    const urlParams = new URLSearchParams(location.search);
    return (urlParams.get('tab') as 'characters' | 'stories' | 'settings') || 'stories';
  });
  
  // Shared editing state for characters
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [editingCharacterName, setEditingCharacterName] = useState('');
  const [editingCharacterDescription, setEditingCharacterDescription] = useState('');
  
  // Shared editing state for stories
  const [editingStoryId, setEditingStoryId] = useState<string | null>(null);
  const [editingStoryTitle, setEditingStoryTitle] = useState('');
  const [editingStoryDescription, setEditingStoryDescription] = useState('');
  const [editingStoryScript, setEditingStoryScript] = useState('');

  // Story selection state
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  // Scene selection state (lifted so breadcrumb can show scene title)
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);

  const { data: scenes = [] } = useQuery(
    getScenesByStory,
    { storyId: selectedStory?.id ?? '' },
    { enabled: !!selectedStory?.id }
  );

  // Handle story selection when storyId changes
  useEffect(() => {
    if (storyId && stories) {
      const story = stories.find((s: Story) => s.id === storyId);
      if (story) {
        setSelectedStory(story);
      }
    } else {
      setSelectedStory(null);
    }
  }, [storyId, stories]);

  // Clear selected scene when story changes
  useEffect(() => {
    setSelectedScene(null);
  }, [selectedStory?.id]);

  const projectName = project?.name || 'Loading...';
  const projectDescription = (project as any)?.description;

  // Function to update active tab and URL
  const updateActiveTab = (tab: 'characters' | 'stories' | 'settings') => {
    setActiveTab(tab);
    // Update URL to preserve tab state
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    navigate(url.pathname + url.search, { replace: true });
  };

  if (projectLoading || charactersLoading || storiesLoading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='text-center'>
          <Loader2 className='h-8 w-8 animate-spin mx-auto mb-4' />
          <p>Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className='py-10 lg:mt-10'>
        <div className='mx-auto max-w-7xl px-6 lg:px-8'>
          <div className='text-center'>
            <p className='text-red-500'>Project not found</p>
            <Link to='/sokafilm' className='text-primary hover:underline'>
              Back to Projects
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Previous/next scene for breadcrumb navigation (scenes ordered by serial)
  const sceneIndex = selectedScene ? scenes.findIndex((s: Scene) => s.id === selectedScene.id) : -1;
  const prevScene = sceneIndex > 0 ? scenes[sceneIndex - 1] : null;
  const nextScene = sceneIndex >= 0 && sceneIndex < scenes.length - 1 ? scenes[sceneIndex + 1] : null;

  // Single-line breadcrumb: Projects (icon) > Project > Story? > Scene? [prev] [next]
  const breadcrumb = (
    <nav className='flex items-center gap-1.5 text-sm text-muted-foreground mb-6 flex-wrap'>
      <Link to='/sokafilm' className='inline-flex items-center gap-1 hover:text-foreground transition-colors'>
        <FolderOpen className='h-4 w-4' aria-hidden />
        <span>Projects</span>
      </Link>
      <ChevronRight className='h-4 w-4 flex-shrink-0' />
      {selectedStory || selectedScene ? (
        <Link
          to={`/sokafilm/project/${projectId}/overview` as any}
          onClick={(e) => { e.preventDefault(); setSelectedStory(null); setSelectedScene(null); navigate(`/sokafilm/project/${projectId}/overview`); }}
          className='hover:text-foreground transition-colors'
        >
          {projectName}
        </Link>
      ) : (
        <span className='text-foreground font-medium'>{projectName}</span>
      )}
      {selectedStory && (
        <>
          <ChevronRight className='h-4 w-4 flex-shrink-0' />
          {selectedScene ? (
            <button
              type='button'
              onClick={() => setSelectedScene(null)}
              className='hover:text-foreground transition-colors'
            >
              {selectedStory.title || 'Story'}
            </button>
          ) : (
            <span className='text-foreground font-medium'>{selectedStory.title || 'Story'}</span>
          )}
          {selectedScene && (
            <>
              <ChevronRight className='h-4 w-4 flex-shrink-0' />
              <div className='inline-flex flex-col items-center gap-0'>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-5 w-5 text-muted-foreground hover:text-foreground'
                  disabled={!prevScene}
                  onClick={() => prevScene && setSelectedScene(prevScene)}
                  title='Previous scene'
                  aria-label='Previous scene'
                >
                  <ChevronUp className='h-3.5 w-3.5' />
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-5 w-5 text-muted-foreground hover:text-foreground'
                  disabled={!nextScene}
                  onClick={() => nextScene && setSelectedScene(nextScene)}
                  title='Next scene'
                  aria-label='Next scene'
                >
                  <ChevronDown className='h-3.5 w-3.5' />
                </Button>
              </div>
              <span className='text-foreground font-medium'>{selectedScene.title || 'Scene'}</span>
            </>
          )}
        </>
      )}
    </nav>
  );

  return (
    <div className='py-10 lg:mt-10'>
      <div className='mx-auto max-w-7xl px-6 lg:px-8'>
        {breadcrumb}

        {/* Main Content */}
        <div className='w-full'>
          {/* Show story details if a story is selected */}
          {selectedStory ? (
            <div>
              <StoryDetails
                story={selectedStory}
                projectId={projectId!}
                selectedScene={selectedScene}
                setSelectedScene={setSelectedScene}
              />
            </div>
          ) : (
            <>
              {/* Tab Controls */}
              <div className='flex space-x-1 mb-6'>
                <Button
                  variant={activeTab === 'stories' ? 'default' : 'outline'}
                  onClick={() => updateActiveTab('stories')}
                  className='flex items-center gap-2'
                >
                  <BookOpen className='h-4 w-4' />
                  Stories
                </Button>
                <Button
                  variant={activeTab === 'characters' ? 'default' : 'outline'}
                  onClick={() => updateActiveTab('characters')}
                  className='flex items-center gap-2'
                >
                  <Users className='h-4 w-4' />
                  Characters
                </Button>
                <Button
                  variant={activeTab === 'settings' ? 'default' : 'outline'}
                  onClick={() => updateActiveTab('settings')}
                  className='flex items-center gap-2'
                >
                  <Settings className='h-4 w-4' />
                  AI Settings
                </Button>
              </div>

              {/* Tab Content */}
              <div className='space-y-6'>
                {/* Stories Tab */}
                {activeTab === 'stories' && (
                  <StoryOverview 
                    projectId={projectId!} 
                    stories={stories || []} 
                    refetchStories={refetchStories} 
                    editingStoryId={editingStoryId}
                    setEditingStoryId={setEditingStoryId}
                    editingStoryTitle={editingStoryTitle}
                    setEditingStoryTitle={setEditingStoryTitle}
                    editingStoryDescription={editingStoryDescription}
                    setEditingStoryDescription={setEditingStoryDescription}
                    editingStoryScript={editingStoryScript}
                    setEditingStoryScript={setEditingStoryScript}
                  />
                )}

                {/* Characters Tab */}
                {activeTab === 'characters' && (
                  <CharactersOverview 
                    projectId={projectId!} 
                    characters={characters || []} 
                    refetchCharacters={refetchCharacters} 
                    editingCharacterId={editingCharacterId}
                    setEditingCharacterId={setEditingCharacterId}
                    editingCharacterName={editingCharacterName}
                    setEditingCharacterName={setEditingCharacterName}
                    editingCharacterDescription={editingCharacterDescription}
                    setEditingCharacterDescription={setEditingCharacterDescription}
                  />
                )}

                {/* AI Settings Tab */}
                {activeTab === 'settings' && (
                  <ProjectAiSettings 
                    project={project}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}