import { useState } from 'react';
import { Link } from 'wasp/client/router';
import { useQuery, useAction } from 'wasp/client/operations';
import { getProjectById, getCharactersByProject, importTsvData } from 'wasp/client/operations';
import type { Project, Character } from 'wasp/entities';
import { Button } from '../client/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../client/components/ui/card';
import { Loader2, Wand2, Settings, ArrowLeft, Upload } from 'lucide-react';
import { useParams } from 'react-router';
import { TsvImport } from './components/TsvImport';
import toast from 'react-hot-toast';
import type { ParsedCharacter, ParsedScene } from './utils/tsvParser';

export default function ProjectOverview() {
  const { projectId } = useParams<{ projectId: string }>();
  const [showTsvImport, setShowTsvImport] = useState(false);
  
  // Ensure projectId exists before making the query
  const { data: project, isLoading, error } = useQuery(
    getProjectById, 
    { projectId: projectId! },
    { 
      enabled: !!projectId,
      retry: false 
    }
  );

  const { data: characters = [] } = useQuery(
    getCharactersByProject,
    { projectId: projectId! },
    {
      enabled: !!projectId,
    }
  );

  const importTsvDataFn = useAction(importTsvData);

  const handleAutomaticMode = () => {
    // TODO: Implement automatic mode
    console.log('Automatic mode not implemented yet');
  };

  const handleTsvImport = async (data: {
    storyTitle: string;
    storyDescription?: string;
    characters: ParsedCharacter[];
    scenes: ParsedScene[];
  }) => {
    if (!projectId) return;

    try {
      const result = await importTsvDataFn({
        projectId,
        storyTitle: data.storyTitle,
        storyDescription: data.storyDescription,
        characters: data.characters,
        scenes: data.scenes,
      });

      toast.success(
        `Import complete! Created ${result.charactersCreated} characters, ${result.scenesCreated} scenes, ${result.shotsCreated} shots. Reused ${result.charactersReused} existing characters.`
      );
      setShowTsvImport(false);
    } catch (error: any) {
      toast.error(error.message || 'Import failed. Please try again.');
      throw error; // Re-throw so TsvImport can handle it
    }
  };

  // Show error if no projectId
  if (!projectId) {
    return (
      <div className='py-10 lg:mt-10'>
        <div className='mx-auto max-w-7xl px-6 lg:px-8'>
          <div className='text-center'>
            <p className='text-red-500'>Invalid project ID</p>
            <Link to='/sokafilm' className='text-primary hover:underline'>
              Back to Projects
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className='py-10 lg:mt-10'>
        <div className='mx-auto max-w-7xl px-6 lg:px-8'>
          <div className='flex justify-center'>
            <Loader2 className='h-8 w-8 animate-spin' />
          </div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className='py-10 lg:mt-10'>
        <div className='mx-auto max-w-7xl px-6 lg:px-8'>
          <div className='text-center'>
            <p className='text-red-500'>
              {error ? `Error: ${error.message}` : 'Project not found'}
            </p>
            <Link to='/sokafilm' className='text-primary hover:underline'>
              Back to Projects
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Use the name field from the Project entity
  const projectName = project.name || 'Untitled Project';
  const projectDescription = project.description || null;

  return (
    <div className='py-10 lg:mt-10'>
      <div className='mx-auto max-w-7xl px-6 lg:px-8'>
        {/* Header */}
        <div className='mb-8'>
          <Link to='/sokafilm' className='inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4'>
            <ArrowLeft className='h-4 w-4' />
            Back to Projects
          </Link>
          <h1 className='text-3xl font-bold tracking-tight text-foreground'>
            {projectName}
          </h1>
          {projectDescription && (
            <p className='mt-2 text-muted-foreground'>{projectDescription}</p>
          )}
        </div>

        {/* TSV Import Section */}
        {showTsvImport ? (
          <TsvImport
            projectId={projectId}
            existingCharacters={characters as Character[]}
            onImport={handleTsvImport}
            onCancel={() => setShowTsvImport(false)}
          />
        ) : (
          <>
            {/* Project Options */}
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto'>
              {/* Automatic Mode */}
              <Card className='hover:shadow-lg transition-shadow cursor-pointer' onClick={handleAutomaticMode}>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Wand2 className='h-5 w-5 text-primary' />
                    Enter a story prompt and go automatic
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className='text-muted-foreground'>
                    Provide a story prompt and let AI generate characters, scenes, and shots automatically.
                  </p>
                </CardContent>
              </Card>

              {/* Manual Mode */}
              <Card className='hover:shadow-lg transition-shadow'>
                <Link to={`/sokafilm/project/${projectId}/overview` as any} className='block'>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                      <Settings className='h-5 w-5 text-primary' />
                      Go full manual
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className='text-muted-foreground'>
                      Create and manage all project elements manually - characters, stories, scenes, and shots.
                    </p>
                  </CardContent>
                </Link>
              </Card>

              {/* TSV Import Mode */}
              <Card className='hover:shadow-lg transition-shadow cursor-pointer' onClick={() => setShowTsvImport(true)}>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Upload className='h-5 w-5 text-primary' />
                    Import from TSV
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className='text-muted-foreground'>
                    Paste a TSV with characters, props, scenes, and shots to bulk-import a complete story.
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
