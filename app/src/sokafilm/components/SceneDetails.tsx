import React, { useState, useEffect } from 'react';
import { Button } from '../../client/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../client/components/ui/card';
import { Input } from '../../client/components/ui/input';
import { Label } from '../../client/components/ui/label';
import { Textarea } from '../../client/components/ui/textarea';
import { Edit2, Wand2, Loader2, FileImage, Plus, Sparkles, RefreshCw, Film, ChevronDown, ChevronUp, ImageIcon, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Scene, Character, Shot } from 'wasp/entities';
import { updateScene, getCharactersByProject, getScenesByStory, generateShotTitlesAI, generateShotDetailsAI, createShot, generateSceneOverviewImage, getStoryCharacters, addCharactersToScene, removeCharacterFromScene, generateShotThumbnail } from 'wasp/client/operations';
import { useQuery, useAction } from 'wasp/client/operations';
import { SceneDetailsDialogues } from './SceneDetailsDialogues';
import { CharacterList } from './CharacterList';
import { SceneShots, type SceneContextForCopy } from './SceneShots';
import { MediaDisplay } from './MediaDisplay';

interface SceneDetailsProps {
  scene: Scene;
  onBack: () => void;
  projectId: string;
  storyId: string; // Add storyId to refetch scene data
  aspectRatioId?: string | null;
}

export function SceneDetails({ scene, onBack, projectId, storyId, aspectRatioId }: SceneDetailsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(scene.title || '');
  const [editDescription, setEditDescription] = useState(scene.description || '');
  const [editSummary, setEditSummary] = useState(scene.summary || '');
  const [isUpdating, setIsUpdating] = useState(false);

  // Shot generation states - Enhanced with inline details and retry
  const [isGeneratingShotTitles, setIsGeneratingShotTitles] = useState(false);
  const [generatedShots, setGeneratedShots] = useState<Array<{
    title: string;
    sequence: number;
    description?: string;
    isProcessed?: boolean;
    isGenerating?: boolean;
    error?: string;
  }> | null>(null);
  const [hasAcceptedShotTitles, setHasAcceptedShotTitles] = useState(false);
  const [isGeneratingAllThumbnails, setIsGeneratingAllThumbnails] = useState(false);
  const [isCreatingShots, setIsCreatingShots] = useState(false);
  const [createdShotsCount, setCreatedShotsCount] = useState(0);
  const [shotGenerationPrompt, setShotGenerationPrompt] = useState('');

  // Image generation states
  const [isGeneratingOverviewImage, setIsGeneratingOverviewImage] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [currentAssetUuid, setCurrentAssetUuid] = useState<string | null>(null);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);



  // Fetch story characters (characters available in the story)
  const { data: storyCharacters = [] } = useQuery(getStoryCharacters, { storyId });

  // Fetch updated scene data to get current character associations
  const { data: updatedScenes = [], refetch: refetchScenes } = useQuery(getScenesByStory, { storyId });
  const updatedScene = updatedScenes.find((s: Scene) => s.id === scene.id) || scene;

  // Get current characters in the scene from updated data
  const currentCharacterIds = (updatedScene as any).sceneCharacters?.map((sc: any) => sc.character.id) || [];
  const currentCharacters = storyCharacters.filter((char: Character) => currentCharacterIds.includes(char.id));
  const availableCharacters = storyCharacters.filter((char: Character) => !currentCharacterIds.includes(char.id));

  // Action hooks for character management
  const addCharactersToSceneFn = useAction(addCharactersToScene);
  const removeCharacterFromSceneFn = useAction(removeCharacterFromScene);

  const handleSave = async () => {
    if (!editTitle.trim()) return;

    setIsUpdating(true);
    try {
      const updatedScene = await updateScene({
        id: scene.id,
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        summary: editSummary.trim() || undefined
      });
      setIsEditing(false);
      // Update local state with the returned updated scene
      Object.assign(scene, updatedScene);
      // Also update the edit form state
      setEditTitle(updatedScene.title || '');
      setEditDescription(updatedScene.description || '');
      setEditSummary(updatedScene.summary || '');
    } catch (error) {
      console.error('Error updating scene:', error);
      toast.error('Failed to update scene. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditTitle(scene.title);
    setEditDescription(scene.description || '');
    setEditSummary(scene.summary || '');
  };

  const toggleDescriptionExpansion = () => {
    setIsDescriptionExpanded(prev => !prev);
  };

  const truncateText = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  // Handle overview image generation using DrawThings HTTP API
  const handleGenerateOverviewImage = async () => {
    if (!scene.description && !scene.title) {
      toast.error('Please add a scene description or title before generating an overview image.');
      return;
    }

    setIsGeneratingOverviewImage(true);
    setGenerationProgress(0);

    try {
      const result = await generateSceneOverviewImage({
        sceneId: scene.id
      });

      // The file UUID is now immediately available, and generation happens asynchronously
      setCurrentAssetUuid(result.fileUuid);
      setGenerationProgress(100);

      // Refetch scenes to show the new overview image (may show loading state initially)
      refetchScenes();

      // Show success message indicating the generation has been queued
      toast.success(`Overview image generation started! Status: ${result.status}`);
    } catch (error) {
      console.error('Error generating overview image:', error);

      let errorMessage = 'Failed to generate overview image. Please try again.';

      if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as { message: string }).message;

        // Provide more specific error messages
        if (message.includes('DrawThings server is not running')) {
          errorMessage = 'AI image generation service is not available. Please ensure the DrawThings server is running on port 7860.';
        } else if (message.includes('Cannot connect to AI image generation service')) {
          errorMessage = 'Cannot connect to AI image generation service. Please check if the service is running and accessible.';
        } else if (message.includes('No image data received')) {
          errorMessage = 'AI service did not return valid image data. Please try again.';
        } else if (message.includes('Scene must have a title or description')) {
          errorMessage = 'Scene must have a title or description to generate an image.';
        } else {
          errorMessage = `Image generation failed: ${message}`;
        }
      }

      toast.error(errorMessage);
    } finally {
      setIsGeneratingOverviewImage(false);
      setCurrentAssetUuid(null);
    }
  };

  // Stage 1: Generate shot titles only
  const handleGenerateShotTitles = async () => {
    if (!scene.title && !scene.description) {
      toast.error('Scene must have title or description to generate shots.');
      return;
    }

    setIsGeneratingShotTitles(true);
    try {
      const result = await generateShotTitlesAI({
        sceneId: scene.id,
        sceneDescription: scene.description || scene.title,
        userPrompt: shotGenerationPrompt.trim() || undefined
      });

      // Initialize shots with titles only, details will be generated after user approval
      const initialShots = result.shots.map(shot => ({
        ...shot,
        isProcessed: false,
        isGenerating: false
      }));

      setGeneratedShots(initialShots);
      setHasAcceptedShotTitles(false); // Reset acceptance state
    } catch (error) {
      console.error('Error generating shot titles:', error);
      let errorMessage = 'Failed to generate shot titles. Please try again.';
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = (error as { message: string }).message;
      }
      toast.error(errorMessage);
    } finally {
      setIsGeneratingShotTitles(false);
    }
  };

  const handleRegenerateShotTitles = async () => {
    await handleGenerateShotTitles();
  };

  // Generate details for all shots after user approval (always serial)
  const handleGenerateAllShotDetails = async () => {
    if (!generatedShots || generatedShots.length === 0) return;

    // Mark as accepted
    setHasAcceptedShotTitles(true);

    // Generate details for all shots serially (one by one)
    for (let i = 0; i < generatedShots.length; i++) {
      await generateShotDetails(i);
    }
  };

  // Generate details for a specific shot with retry logic
  const generateShotDetails = async (shotIndex: number, retryCount = 0) => {
    if (!generatedShots) return;

    const maxRetries = 2;

    // Update shot state to show it's generating
    setGeneratedShots(prev => prev ? prev.map((shot, index) =>
      index === shotIndex
        ? { ...shot, isGenerating: true, error: undefined }
        : shot
    ) : null);

    try {
      const shot = generatedShots[shotIndex];
      // Prepare all shot titles for context
      const allShotTitles = generatedShots.map(s => ({
        title: s.title,
        sequence: s.sequence
      }));

      const shotDetails = await generateShotDetailsAI({
        sceneId: scene.id,
        shotSequence: shot.sequence,
        shotTitle: shot.title,
        allShotTitles: allShotTitles, // Pass the shot context from frontend
        userPrompt: undefined
      });

      // Update shot with generated details
      setGeneratedShots(prev => prev ? prev.map((s, index) =>
        index === shotIndex
          ? {
            ...s,
            description: shotDetails.description,
            isProcessed: true,
            isGenerating: false,
            error: undefined
          }
          : s
      ) : null);

    } catch (error) {
      console.error(`Error generating details for shot ${shotIndex + 1}:`, error);

      // If we haven't exceeded max retries, try again
      if (retryCount < maxRetries) {
        console.log(`Retrying shot ${shotIndex + 1} (attempt ${retryCount + 2}/${maxRetries + 1})`);
        setTimeout(() => {
          generateShotDetails(shotIndex, retryCount + 1);
        }, 1000 * (retryCount + 1)); // Exponential backoff
      } else {
        // Mark as failed after max retries
        const errorMessage = error && typeof error === 'object' && 'message' in error
          ? (error as { message: string }).message
          : 'Failed to generate details';

        setGeneratedShots(prev => prev ? prev.map((s, index) =>
          index === shotIndex
            ? {
              ...s,
              isProcessed: false,
              isGenerating: false,
              error: errorMessage
            }
            : s
        ) : null);
      }
    }
  };

  // Manual retry for a specific shot
  const handleRetryShotDetails = async (shotIndex: number) => {
    await generateShotDetails(shotIndex);
  };

  // Generate thumbnails for all shots in the scene
  const handleGenerateAllShotThumbnails = async () => {
    const shots = (updatedScene as any).shots || [];
    if (shots.length === 0) {
      toast.error('No shots available to generate thumbnails for.');
      return;
    }

    setIsGeneratingAllThumbnails(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const shot of shots) {
        try {
          await generateShotThumbnail({
            shotId: shot.id,
            aspectRatioId: aspectRatioId || undefined
          });
          successCount++;
        } catch (error) {
          console.error(`Error generating thumbnail for shot ${shot.title}:`, error);
          errorCount++;
        }
      }

      // Show results
      if (successCount > 0) {
        toast.success(`Successfully queued ${successCount} shot thumbnail(s) for generation!`);
        if (errorCount > 0) {
          toast.error(`${errorCount} shot thumbnail(s) failed to queue.`);
        }
      } else {
        toast.error('Failed to queue any shot thumbnails for generation.');
      }

      // Refresh scenes to show updated data
      refetchScenes();
    } catch (error) {
      console.error('Error in batch thumbnail generation:', error);
      toast.error('Failed to process thumbnail generation requests.');
    } finally {
      setIsGeneratingAllThumbnails(false);
    }
  };

  // Create actual shots from generated data
  const handleCreateShots = async () => {
    if (!generatedShots || generatedShots.length === 0) return;

    // Only create shots that have been successfully processed
    const processedShots = generatedShots.filter(shot => shot.isProcessed && shot.description);

    if (processedShots.length === 0) {
      toast.error('No shots with details available to create. Please generate shot details first.');
      return;
    }

    setIsCreatingShots(true);
    setCreatedShotsCount(0);
    let actualCreatedCount = 0;

    try {
      // Get current shots to calculate next sequence
      const currentShots = (updatedScene as any).shots || [];

      // Create shots one by one to show progress
      for (let i = 0; i < processedShots.length; i++) {
        const shotData = processedShots[i];
        const nextSequence = currentShots.length + i + 1;

        try {
          await createShot({
            sceneId: scene.id,
            title: shotData.title,
            description: shotData.description || '',
            sequence: nextSequence
          });

          actualCreatedCount++;
          setCreatedShotsCount(actualCreatedCount);
        } catch (error) {
          console.error(`Error creating shot ${i + 1}:`, error);
          // Continue with next shot even if one fails
        }

        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Reset generation state
      setGeneratedShots(null);
      setShotGenerationPrompt('');

      // Refresh scene data
      refetchScenes();

      toast.success(`Successfully created ${actualCreatedCount} shots!`);
    } catch (error) {
      console.error('Error creating shots:', error);
      let errorMessage = 'Failed to create shots. Please try again.';
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = (error as { message: string }).message;
      }
      toast.error(errorMessage);
    } finally {
      setIsCreatingShots(false);
      setCreatedShotsCount(0);
    }
  };

  const handleCancelShotGeneration = () => {
    setGeneratedShots(null);
    setShotGenerationPrompt('');
    setCreatedShotsCount(0);
    setHasAcceptedShotTitles(false);
  };

  if (isEditing) {
    return (
      <div className='space-y-6'>
        <div className='flex justify-between items-center'>
          <h2 className='text-2xl font-bold'>Edit Scene</h2>
        </div>

        <Card>
          <CardContent className='pt-6'>
            <div className='space-y-4'>
              <div>
                <Label htmlFor='edit-scene-title'>Title</Label>
                <Input
                  id='edit-scene-title'
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder='Enter scene title'
                  className='mt-1'
                />
              </div>
              <div>
                <Label htmlFor='edit-scene-summary'>Summary (Optional)</Label>
                <Textarea
                  id='edit-scene-summary'
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  placeholder='Enter scene summary'
                  className='mt-1'
                />
              </div>
              <div>
                <Label htmlFor='edit-scene-description'>Description (Optional)</Label>
                <Textarea
                  id='edit-scene-description'
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder='Enter scene description'
                  className='mt-1'
                />
              </div>
              <div className='flex gap-2'>
                <Button onClick={handleSave} disabled={!editTitle.trim() || isUpdating}>
                  {isUpdating ? (
                    <>
                      <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
                <Button variant='outline' onClick={handleCancel} disabled={isUpdating}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              {/* Scene Image */}
              <div className='flex-shrink-0 relative'>
                {updatedScene.overviewImageUuid ? (
                  <MediaDisplay
                    fileUuid={updatedScene.overviewImageUuid}
                    className='h-16 w-16 rounded object-cover'
                  />
                ) : (
                  <div className='h-16 w-16 rounded bg-gray-100 flex items-center justify-center'>
                    <FileImage className='h-8 w-8 text-gray-400' />
                  </div>
                )}



                {/* Generation Progress Indicator */}
                {isGeneratingOverviewImage && (
                  <div className="absolute inset-0 bg-black/50 rounded flex items-center justify-center">
                    <div className="text-white text-xs font-medium">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                      Generating...
                    </div>
                  </div>
                )}
              </div>

              {/* Scene Title and Serial */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className='text-xl'>{updatedScene.title}</span>
                  <Button
                    onClick={handleGenerateOverviewImage}
                    size="sm"
                    variant="outline"
                    disabled={isGeneratingOverviewImage}
                    className="ml-2"
                  >
                    {isGeneratingOverviewImage ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        {updatedScene.overviewImageUuid ? 'Regenerate Overview' : 'Generate Overview'}
                      </>
                    )}
                  </Button>
                </div>
                <div className='text-sm text-muted-foreground'>
                  Serial: {updatedScene.serial}
                </div>
              </div>
            </div>
            <Button onClick={() => setIsEditing(true)} variant='outline' size='sm'>
              <Edit2 className='h-4 w-4 mr-2' />
              Edit Scene
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Always show summary section, even if empty */}
          <div className='mb-4'>
            <h3 className='text-sm font-medium text-muted-foreground mb-2'>Summary</h3>
            {scene.summary && scene.summary.trim() ? (
              <div className='text-sm bg-gray-50 p-3 rounded whitespace-pre-wrap'>
                {scene.summary}
              </div>
            ) : (
              <div className='text-sm text-gray-400 italic p-3 bg-gray-50 rounded'>No summary available</div>
            )}
          </div>

          {/* Always show description section, even if empty */}
          <div className='mb-4'>
            <div className='flex items-center gap-2 mb-2'>
              <h3 className='text-sm font-medium text-muted-foreground'>Description</h3>
              <button
                type='button'
                onClick={async () => {
                  const text = scene.description?.trim() || '';
                  if (text) {
                    await navigator.clipboard.writeText(text);
                    toast.success('Description copied to clipboard');
                  } else {
                    toast.error('No description to copy');
                  }
                }}
                className='p-1 rounded hover:bg-gray-200 text-muted-foreground hover:text-foreground'
                title='Copy description'
                aria-label='Copy description'
              >
                <Copy className='h-4 w-4' />
              </button>
            </div>
            {scene.description && scene.description.trim() ? (
              <div>
                <div className='text-sm bg-gray-50 p-3 rounded whitespace-pre-wrap'>
                  {isDescriptionExpanded
                    ? scene.description
                    : truncateText(scene.description)
                  }
                </div>
                {scene.description.length > 150 && (
                  <button
                    onClick={toggleDescriptionExpansion}
                    className='text-xs text-blue-600 hover:text-blue-800 mt-2 flex items-center gap-1'
                  >
                    {isDescriptionExpanded ? (
                      <>
                        <ChevronUp className='h-3 w-3' />
                        See less
                      </>
                    ) : (
                      <>
                        <ChevronDown className='h-3 w-3' />
                        See more
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : (
              <div className='text-sm text-gray-400 italic p-3 bg-gray-50 rounded'>No description available</div>
            )}
          </div>

          {/* Characters Section */}
          <CharacterList
            title="Characters in Scene"
            currentCharacters={currentCharacters}
            availableCharacters={availableCharacters}
            onAddCharacters={async (characterIds: string[]) => {
              try {
                await addCharactersToSceneFn({
                  sceneId: scene.id,
                  characterIds: characterIds
                });
                refetchScenes();
              } catch (error) {
                console.error('Error adding characters to scene:', error);
                toast.error('Failed to add characters to scene. Please try again.');
              }
            }}
            onRemoveCharacter={async (characterId: string) => {
              try {
                await removeCharacterFromSceneFn({
                  sceneId: scene.id,
                  characterId: characterId
                });
                refetchScenes();
              } catch (error) {
                console.error('Error removing character from scene:', error);
                toast.error('Failed to remove character from scene. Please try again.');
              }
            }}
            emptyMessage="No characters assigned to this scene yet."
          />

          {/* Shots Section with Generation */}
          <div className='mb-6'>
            <div className='flex gap-2 mb-2 items-center'>
              <h3 className='text-sm font-medium text-muted-foreground flex items-center gap-2'>
                <Film className='h-4 w-4' />
                Shots in Scene ({((updatedScene as any).shots || []).length})
              </h3>
              <Button
                onClick={handleGenerateShotTitles}
                disabled={isGeneratingShotTitles || (!scene.title && !scene.description)}
                variant='outline'
                size='sm'
              >
                {isGeneratingShotTitles ? (
                  <>
                    <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className='h-4 w-4 mr-2' />
                    Generate Shots
                  </>
                )}
              </Button>
              <Button
                onClick={handleGenerateAllShotThumbnails}
                disabled={isGeneratingAllThumbnails || ((updatedScene as any).shots || []).length === 0}
                variant='outline'
                size='sm'
              >
                {isGeneratingAllThumbnails ? (
                  <>
                    <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileImage className='h-4 w-4 mr-2' />
                    Generate Shot Thumbnails
                  </>
                )}
              </Button>
            </div>
            <p className='text-xs text-muted-foreground mb-3'>
              AI shot generation creates cinematically diverse shots for effective storytelling.
            </p>

            {/* Generated Shots with Inline Details */}
            {generatedShots && (
              <div className='mb-6'>
                <Card>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                      <Sparkles className='h-5 w-5' />
                      Generated Shots ({generatedShots.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='space-y-4 mb-4'>
                      {generatedShots.map((shot, index) => (
                        <div key={index} className='border rounded-lg p-4 bg-gray-50'>
                          {/* Shot Title with Status */}
                          <div className='flex items-center justify-between mb-3'>
                            <div className='font-medium'>Shot {shot.sequence}: {shot.title}</div>
                            <div className='flex items-center gap-2'>
                              {shot.isGenerating && (
                                <div className='flex items-center text-blue-600 text-sm'>
                                  <Loader2 className='h-4 w-4 mr-1 animate-spin' />
                                  Generating...
                                </div>
                              )}
                              {shot.isProcessed && !shot.isGenerating && (
                                <div className='text-green-600 text-sm'>✓ Complete</div>
                              )}
                              {shot.error && !shot.isGenerating && (
                                <>
                                  <div className='text-red-600 text-sm'>⚠ Failed</div>
                                  <Button
                                    onClick={() => handleRetryShotDetails(index)}
                                    size='sm'
                                    variant='outline'
                                    className='h-6 px-2 text-xs'
                                  >
                                    <RefreshCw className='h-3 w-3 mr-1' />
                                    Retry
                                  </Button>
                                </>
                              )}
                              {isCreatingShots && index < createdShotsCount && (
                                <div className='text-blue-600 text-sm'>✓ Created</div>
                              )}
                              {isCreatingShots && index === createdShotsCount && (
                                <Loader2 className='h-4 w-4 animate-spin text-blue-600' />
                              )}
                            </div>
                          </div>

                          {/* Shot Details (shown inline) */}
                          {shot.description && (
                            <div className='bg-white p-3 rounded border mb-2'>
                              <div className='text-sm text-muted-foreground mb-1'>Description:</div>
                              <div className='text-sm whitespace-pre-wrap'>{shot.description}</div>
                            </div>
                          )}

                          {shot.error && (
                            <div className='bg-red-50 border border-red-200 p-2 rounded mt-2'>
                              <div className='text-red-700 text-xs'>{shot.error}</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className='space-y-3'>
                      <div>
                        <Label htmlFor='shot-generation-prompt'>Modify prompt (optional)</Label>
                        <Input
                          id='shot-generation-prompt'
                          value={shotGenerationPrompt}
                          onChange={(e) => setShotGenerationPrompt(e.target.value)}
                          placeholder='Enter specific instructions to modify the generation...'
                          className='mt-1'
                        />
                      </div>

                      <div className='flex gap-2'>
                        <Button
                          onClick={handleGenerateAllShotDetails}
                          disabled={generatedShots.some(s => s.isGenerating)}
                          className='bg-green-600 hover:bg-green-700'
                        >
                          {generatedShots.some(s => s.isGenerating) ? (
                            <>
                              <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                              Creating Details...
                            </>
                          ) : hasAcceptedShotTitles && generatedShots.some(s => s.isProcessed) ? (
                            'Recreate Details'
                          ) : hasAcceptedShotTitles ? (
                            'Create Details'
                          ) : (
                            'Accept & Create Details'
                          )}
                        </Button>

                        {/* Create Ready Shots Button - positioned right after details button */}
                        {generatedShots.some(shot => shot.isProcessed && shot.description) && (
                          <Button
                            onClick={handleCreateShots}
                            disabled={isCreatingShots}
                            className='bg-blue-600 hover:bg-blue-700'
                          >
                            {isCreatingShots ? (
                              <>
                                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                                Creating Shots ({createdShotsCount}/{generatedShots.filter(s => s.isProcessed && s.description).length})
                              </>
                            ) : (
                              <>
                                <Film className='h-4 w-4 mr-2' />
                                Create Ready Shots ({generatedShots.filter(s => s.isProcessed && s.description).length})
                              </>
                            )}
                          </Button>
                        )}

                        {!hasAcceptedShotTitles && (
                          <Button
                            onClick={handleRegenerateShotTitles}
                            disabled={isGeneratingShotTitles || generatedShots.some(s => s.isGenerating)}
                            variant='outline'
                          >
                            {isGeneratingShotTitles ? (
                              <>
                                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                                Regenerating...
                              </>
                            ) : (
                              'Regenerate Shots'
                            )}
                          </Button>
                        )}
                        <Button
                          onClick={handleCancelShotGeneration}
                          disabled={generatedShots.some(s => s.isGenerating)}
                          variant='outline'
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Existing Shots */}
            <SceneShots
              sceneId={scene.id}
              shots={(updatedScene as any).shots || []}
              aspectRatioId={aspectRatioId}
              onShotsChange={refetchScenes}
              sceneContext={{
                sceneTitle: updatedScene.title ?? undefined,
                sceneDescription: updatedScene.description ?? undefined,
                overviewImageUuid: (updatedScene as any).overviewImageUuid ?? null,
                storyCharacterImageByCharacterId: (() => {
                  const story = (updatedScene as any).story;
                  const list = story?.storyCharacters as Array<{ characterId: string; customImageUuid?: string | null }> | undefined;
                  if (!list?.length) return undefined;
                  const map: Record<string, string | null> = {};
                  for (const sc of list) {
                    if (sc.characterId != null) map[sc.characterId] = sc.customImageUuid ?? null;
                  }
                  return map;
                })(),
                sceneCharacters: (updatedScene as any).sceneCharacters,
              }}
            />
          </div>

          {/* Dialogs Section */}
          <SceneDetailsDialogues
            sceneId={scene.id}
            currentCharacters={currentCharacters}
          />

          <div className='flex gap-2'>
            <Button variant='outline' size='sm'>
              <Wand2 className='h-4 w-4 mr-2' />
              Generate AI
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
