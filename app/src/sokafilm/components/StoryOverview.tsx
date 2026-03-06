import React, { useState } from 'react';
import { useQuery, useAction } from 'wasp/client/operations';
import { createStory, deleteStory, updateStory, getCharactersByProject, importTsvData } from 'wasp/client/operations';
import type { Story, Character } from 'wasp/entities';
import { Button } from '../../client/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../client/components/ui/card';
import { Label } from '../../client/components/ui/label';
import { Input } from '../../client/components/ui/input';
import { Textarea } from '../../client/components/ui/textarea';
import { Loader2, Plus, Trash2, Edit2, Upload } from 'lucide-react';
import { Link } from 'wasp/client/router';
import toast from 'react-hot-toast';
import { TsvImport } from './TsvImport';
import type { ParsedCharacter, ParsedScene } from '../utils/tsvParser';

interface StoryOverviewProps {
  projectId: string;
  stories: Story[];
  refetchStories: () => Promise<any>;
  editingStoryId: string | null;
  setEditingStoryId: (id: string | null) => void;
  editingStoryTitle: string;
  setEditingStoryTitle: (title: string) => void;
  editingStoryDescription: string;
  setEditingStoryDescription: (description: string) => void;
  editingStoryScript: string;
  setEditingStoryScript: (script: string) => void;
}

export function StoryOverview({ 
  projectId, 
  stories, 
  refetchStories, 
  editingStoryId, 
  setEditingStoryId, 
  editingStoryTitle, 
  setEditingStoryTitle, 
  editingStoryDescription, 
  setEditingStoryDescription, 
  editingStoryScript, 
  setEditingStoryScript 
}: StoryOverviewProps) {
  const [isAddingStory, setIsAddingStory] = useState(false);
  const [showTsvImport, setShowTsvImport] = useState(false);
  const [newStoryTitle, setNewStoryTitle] = useState('');
  const [newStoryDescription, setNewStoryDescription] = useState('');
  const [newStoryScript, setNewStoryScript] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingStoryId, setDeletingStoryId] = useState<string | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [lastAddedStoryTitle, setLastAddedStoryTitle] = useState<string>('');
  const [successMessageType, setSuccessMessageType] = useState<'add' | 'update'>('add');

  const { data: characters = [] } = useQuery(
    getCharactersByProject,
    { projectId },
    { enabled: !!projectId }
  );
  const importTsvDataFn = useAction(importTsvData);
  
  const createStoryFn = createStory;
  const deleteStoryFn = deleteStory;
  const updateStoryFn = updateStory;

  const handleTsvImport = async (data: {
    storyTitle: string;
    storyDescription?: string;
    characters: ParsedCharacter[];
    scenes: ParsedScene[];
  }) => {
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
      await refetchStories();
    } catch (error: any) {
      toast.error(error.message || 'Import failed. Please try again.');
      throw error;
    }
  };

  const handleAddStory = async () => {
    if (!newStoryTitle.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      // Get the next serial number for this project
      const nextSerial = stories.length > 0 
        ? Math.max(...stories.map(s => s.serial)) + 1 
        : 1;
      
      await createStoryFn({
        projectId,
        title: newStoryTitle.trim(),
        description: newStoryDescription.trim() || undefined,
        script: newStoryScript.trim() || undefined,
        serial: nextSerial
      });
      
      setNewStoryTitle('');
      setNewStoryDescription('');
      setNewStoryScript('');
      setIsAddingStory(false);
      
      // Manually refetch the stories to ensure immediate update
      await refetchStories();
      
      // Show success message
      setShowSuccessMessage(true);
      setLastAddedStoryTitle(newStoryTitle.trim());
      setSuccessMessageType('add');
      setTimeout(() => setShowSuccessMessage(false), 3000);
    } catch (error) {
      console.error('Error adding story:', error);
      toast.error('Failed to create story. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    if (!confirm('Are you sure you want to delete this story? This action cannot be undone.')) {
      return;
    }
    
    setDeletingStoryId(storyId);
    
    try {
      await deleteStoryFn({ id: storyId });
      // Manually refetch the stories to ensure immediate update
      await refetchStories();
    } catch (error) {
      console.error('Error deleting story:', error);
      toast.error('Failed to delete story. Please try again.');
    } finally {
      setDeletingStoryId(null);
    }
  };

  const handleEditStory = async () => {
    if (!editingStoryId || !editingStoryTitle.trim()) return;
    
    setIsUpdating(true);
    
    try {
      await updateStoryFn({
        id: editingStoryId,
        title: editingStoryTitle.trim(),
        description: editingStoryDescription.trim() || undefined,
        script: editingStoryScript.trim() || undefined
      });
      
      setEditingStoryId(null);
      setEditingStoryTitle('');
      setEditingStoryDescription('');
      setEditingStoryScript('');
      
      await refetchStories();
      
      setShowSuccessMessage(true);
      setLastAddedStoryTitle(editingStoryTitle.trim());
      setSuccessMessageType('update');
      setTimeout(() => setShowSuccessMessage(false), 3000);
    } catch (error) {
      console.error('Error updating story:', error);
      toast.error('Failed to update story. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const startEditing = (story: Story) => {
    setEditingStoryId(story.id);
    setEditingStoryTitle(story.title || '');
    setEditingStoryDescription(story.description || '');
    setEditingStoryScript(story.script || '');
  };

  const cancelEditing = () => {
    setEditingStoryId(null);
    setEditingStoryTitle('');
    setEditingStoryDescription('');
    setEditingStoryScript('');
  };

  const truncateScript = (script: string, maxLength: number = 100): string => {
    if (script.length <= maxLength) {
      return script;
    }
    return script.slice(0, maxLength) + '...';
  };

  if (showTsvImport) {
    return (
      <div>
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-2xl font-bold'>Import Story from TSV</h2>
        </div>
        <TsvImport
          projectId={projectId}
          existingCharacters={characters as Character[]}
          onImport={handleTsvImport}
          onCancel={() => setShowTsvImport(false)}
        />
      </div>
    );
  }

  return (
    <div>
      <div className='flex justify-between items-center mb-4'>
        <h2 className='text-2xl font-bold'>Stories</h2>
        <div className='flex gap-2'>
          <Button variant='outline' onClick={() => setShowTsvImport(true)}>
            <Upload className='h-4 w-4 mr-2' />
            Import from TSV
          </Button>
          <Button onClick={() => setIsAddingStory(true)}>
            <Plus className='h-4 w-4 mr-2' />
            Add Story
          </Button>
        </div>
      </div>

      {/* Add Story Form */}
      {isAddingStory && (
        <Card className='mb-4'>
          <CardContent className='pt-6'>
            <div className='space-y-4'>
              <div>
                <Label htmlFor='storyTitle'>Title</Label>
                <Input
                  id='storyTitle'
                  value={newStoryTitle}
                  onChange={(e) => setNewStoryTitle(e.target.value)}
                  placeholder='Enter story title'
                  className='mt-1'
                />
              </div>
              <div>
                <Label htmlFor='storyDescription'>Description (Optional)</Label>
                <Textarea
                  id='storyDescription'
                  value={newStoryDescription}
                  onChange={(e) => setNewStoryDescription(e.target.value)}
                  placeholder='Enter story description'
                  className='mt-1'
                />
              </div>
              <div>
                <Label htmlFor='storyScript'>Script (Optional)</Label>
                <Textarea
                  id='storyScript'
                  value={newStoryScript}
                  onChange={(e) => setNewStoryScript(e.target.value)}
                  placeholder='Enter story script'
                  className='mt-1'
                />
              </div>
              <div className='flex gap-2'>
                <Button onClick={handleAddStory} disabled={!newStoryTitle.trim() || isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                      Adding...
                    </>
                  ) : (
                    'Add Story'
                  )}
                </Button>
                <Button variant='outline' onClick={() => setIsAddingStory(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success Message */}
      {showSuccessMessage && (
        <div className='mb-4 p-4 bg-green-50 border border-green-200 rounded-md'>
          <div className='flex items-center'>
            <div className='flex-shrink-0'>
              <svg className='h-5 w-5 text-green-400' viewBox='0 0 20 20' fill='currentColor'>
                <path fillRule='evenodd' d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z' clipRule='evenodd' />
              </svg>
            </div>
            <div className='ml-3'>
              <p className='text-sm font-medium text-green-800'>
                {successMessageType === 'add' ? `Story "${lastAddedStoryTitle || 'Story'}" added successfully!` : `Story "${lastAddedStoryTitle || 'Story'}" updated successfully!`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stories Grid */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
        {stories.map((story) => (
          <div key={story.id}>
            {editingStoryId === story.id ? (
              // Edit Form
              <Card>
                <CardContent className='pt-6'>
                  <div className='space-y-4'>
                    <div>
                      <Label htmlFor={`edit-story-title-${story.id}`}>Title</Label>
                      <Input
                        id={`edit-story-title-${story.id}`}
                        value={editingStoryTitle}
                        onChange={(e) => setEditingStoryTitle(e.target.value)}
                        placeholder='Enter story title'
                        className='mt-1'
                      />
                    </div>
                    <div>
                      <Label htmlFor={`edit-story-description-${story.id}`}>Description (Optional)</Label>
                      <Textarea
                        id={`edit-story-description-${story.id}`}
                        value={editingStoryDescription}
                        onChange={(e) => setEditingStoryDescription(e.target.value)}
                        placeholder='Enter story description'
                        className='mt-1'
                      />
                    </div>
                    <div>
                      <Label htmlFor={`edit-story-script-${story.id}`}>Script (Optional)</Label>
                      <Textarea
                        id={`edit-story-script-${story.id}`}
                        value={editingStoryScript}
                        onChange={(e) => setEditingStoryScript(e.target.value)}
                        placeholder='Enter story script'
                        className='mt-1'
                      />
                    </div>
                    <div className='flex gap-2'>
                      <Button onClick={handleEditStory} disabled={!editingStoryTitle.trim() || isUpdating}>
                        {isUpdating ? (
                          <>
                            <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                            Updating...
                          </>
                        ) : (
                          'Update Story'
                        )}
                      </Button>
                      <Button variant='outline' onClick={cancelEditing} disabled={isUpdating}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              // Normal Display - Clickable Card
              <Link 
                to={`/sokafilm/project/${projectId}/story/${story.id}` as any}
                className='block'
              >
                <Card className='group hover:shadow-md transition-all duration-200 cursor-pointer'>
                  <CardHeader>
                    <CardTitle className='flex items-center justify-between'>
                      <span className='group-hover:text-blue-600 transition-colors'>{story.title || 'Untitled Story'}</span>
                      <div className='flex gap-2'>
                        <Button 
                          variant='ghost' 
                          size='sm'
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            startEditing(story);
                          }}
                          className='opacity-0 group-hover:opacity-100 transition-opacity'
                        >
                          <Edit2 className='h-4 w-4' />
                        </Button>
                        <Button 
                          variant='ghost' 
                          size='sm' 
                          className='text-destructive opacity-0 group-hover:opacity-100 transition-opacity'
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteStory(story.id);
                          }}
                          disabled={deletingStoryId === story.id}
                        >
                          {deletingStoryId === story.id ? (
                            <Loader2 className='h-4 w-4 animate-spin' />
                          ) : (
                            <Trash2 className='h-4 w-4' />
                          )}
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {story.description && (
                      <p className='text-sm text-muted-foreground mb-2'>{story.description}</p>
                    )}
                    {story.script && (
                      <div className='mb-2'>
                        <div className='text-sm text-muted-foreground font-mono bg-gray-50 p-2 rounded'>
                          {truncateScript(story.script, 100)}
                        </div>
                      </div>
                    )}

                  </CardContent>
                </Card>
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
