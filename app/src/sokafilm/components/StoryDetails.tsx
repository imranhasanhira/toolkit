import React, { useState } from 'react';
import { Button } from '../../client/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../client/components/ui/card';
import { Input } from '../../client/components/ui/input';
import { Label } from '../../client/components/ui/label';
import { Textarea } from '../../client/components/ui/textarea';
import { Edit2, Plus, Loader2, Film, Trash2, FileImage, Sparkles, RefreshCw, ChevronDown, ChevronUp, Zap, FileText, Image, Eye, X, Maximize2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Story, Scene, Character, AspectRatio } from 'wasp/entities';
import { updateStory, createScene, getScenesByStory, deleteScene, enhanceScriptAI, generateSceneTitlesAI, generateSceneDetailsAI, generateSceneOverviewImage, generateShotTitlesAI, generateShotDetailsAI, createShot, generateShotThumbnail, addCharactersToStory, removeCharacterFromStory, getStoryCharacters, getCharactersByProject, getAspectRatios, updateStoryAspectRatio, updateStoryCharacter, generateStoryCharacterImage } from 'wasp/client/operations';

import { useQuery } from 'wasp/client/operations';
import { SceneDetails } from './SceneDetails';
import { MediaDisplay } from './MediaDisplay';
import { ImageGalleryDialog, ImageItem } from '../../client/components/ui/ImageGalleryDialog';
import { CharacterList } from './CharacterList';

interface StoryDetailsProps {
  story: Story;
  projectId: string;
  selectedScene?: Scene | null;
  setSelectedScene?: (scene: Scene | null) => void;
}

export function StoryDetails({ story, projectId, selectedScene: selectedSceneProp, setSelectedScene: setSelectedSceneProp }: StoryDetailsProps) {
  const [internalScene, setInternalScene] = useState<Scene | null>(null);
  const isControlled = setSelectedSceneProp !== undefined;
  const selectedScene = isControlled ? (selectedSceneProp ?? null) : internalScene;
  const setSelectedScene = isControlled ? setSelectedSceneProp! : setInternalScene;

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(story.title || '');
  const [editDescription, setEditDescription] = useState(story.description || '');
  const [editScript, setEditScript] = useState(story.script || '');
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Scene states
  const [isAddingScene, setIsAddingScene] = useState(false);
  const [newSceneTitle, setNewSceneTitle] = useState('');
  const [newSceneDescription, setNewSceneDescription] = useState('');
  const [newSceneSummary, setNewSceneSummary] = useState('');
  const [isCreatingScene, setIsCreatingScene] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  
  // Scene generation states - Enhanced with inline details and retry
  const [isGeneratingTitles, setIsGeneratingTitles] = useState(false);
  const [generatedScenes, setGeneratedScenes] = useState<Array<{ 
    title: string; 
    serial: number; 
    description?: string; 
    summary?: string;
    characters?: string[]; 
    isProcessed?: boolean;
    isGenerating?: boolean;
    error?: string;
  }> | null>(null);
  const [hasAcceptedTitles, setHasAcceptedTitles] = useState(false);
  const [isCreatingScenes, setIsCreatingScenes] = useState(false);
  const [createdScenesCount, setCreatedScenesCount] = useState(0);
  const [generationPrompt, setGenerationPrompt] = useState('');
  const [isScriptExpanded, setIsScriptExpanded] = useState(false);
  
  // Full generation workflow states
  const [isGeneratingFull, setIsGeneratingFull] = useState(false);
  const [fullGenerationProgress, setFullGenerationProgress] = useState({
    step: '',
    current: 0,
    total: 0,
    details: '',
    retryCount: 0,
    substeps: [] as string[],
    startTime: null as Date | null,
    estimatedTimeRemaining: null as number | null
  });

  // Fetch scenes for this story
  const { data: scenes = [], isLoading: scenesLoading, refetch: refetchScenes } = useQuery(getScenesByStory, { storyId: story.id });

  // Fetch aspect ratios
  const { data: aspectRatios = [] } = useQuery(getAspectRatios);
  
  // Get the current story's aspect ratio
  const currentAspectRatio = aspectRatios.find((ar: AspectRatio) => ar.id === (story as any).aspectRatioId) || 
    aspectRatios.find((ar: AspectRatio) => ar.isDefault) || null;

  const handleAspectRatioChange = async (aspectRatioId: string) => {
    try {
      await updateStoryAspectRatio({ storyId: story.id, aspectRatioId });
      toast.success('Aspect ratio updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update aspect ratio');
    }
  };

  // Fetch story characters
  const { data: storyCharacters = [], isLoading: charactersLoading, refetch: refetchCharacters } = useQuery(getStoryCharacters, { storyId: story.id });
  
  // Fetch all project characters for selection
  const { data: projectCharacters = [] } = useQuery(getCharactersByProject, { projectId });

  // Helper function to calculate estimated time remaining
  const calculateEstimatedTimeRemaining = (current: number, startTime: Date | null): number | null => {
    if (!startTime || current <= 0) return null;
    
    const elapsed = Date.now() - startTime.getTime();
    const progressRatio = current / 100;
    
    if (progressRatio === 0) return null;
    
    const estimatedTotalTime = elapsed / progressRatio;
    const estimatedRemaining = estimatedTotalTime - elapsed;
    
    return Math.max(0, estimatedRemaining);
  };

  // Helper function to format time in human-readable format
  const formatTime = (milliseconds: number): string => {
    if (milliseconds < 1000) return '< 1s';
    if (milliseconds < 60000) return `${Math.round(milliseconds / 1000)}s`;
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.round((milliseconds % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const handleSave = async () => {
    if (!editTitle.trim()) return;

    setIsUpdating(true);
    try {
      await updateStory({
        id: story.id,
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        script: editScript.trim() || undefined
      });
      setIsEditing(false);
      // Note: The story object will be updated when the parent component refetches
    } catch (error) {
      console.error('Error updating story:', error);
      toast.error('Failed to update story. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditTitle(story.title || '');
    setEditDescription(story.description || '');
    setEditScript(story.script || '');
  };

  const handleAddScene = async () => {
    if (!newSceneTitle.trim()) return;

    setIsCreatingScene(true);
    try {
      // Calculate the next serial number for the scene
      const nextSerial = scenes.length + 1;
      
              await createScene({
          storyId: story.id,
          title: newSceneTitle.trim(),
          description: newSceneDescription.trim() || undefined,
          summary: newSceneSummary.trim() || undefined,
          serial: nextSerial
        });
      
             // Reset form and close
       setNewSceneTitle('');
       setNewSceneDescription('');
       setNewSceneSummary('');
       setIsAddingScene(false);
      
      // Refresh scenes list
      refetchScenes();
    } catch (error) {
      console.error('Error creating scene:', error);
      toast.error('Failed to create scene. Please try again.');
    } finally {
      setIsCreatingScene(false);
    }
  };

  const handleCancelAddScene = () => {
    setIsAddingScene(false);
    setNewSceneTitle('');
    setNewSceneDescription('');
    setNewSceneSummary('');
  };

  // Character management functions
  const handleAddCharactersToStory = async (characterIds: string[]) => {
    if (characterIds.length === 0) return;

    try {
      await addCharactersToStory({
        storyId: story.id,
        characterIds: characterIds
      });
      
      // Refresh characters list
      refetchCharacters();
      toast.success(`Added ${characterIds.length} character(s) to the story`);
    } catch (error) {
      console.error('Error adding characters to story:', error);
      toast.error('Failed to add characters to story. Please try again.');
    }
  };

  const handleRemoveCharacterFromStory = async (characterId: string) => {
    if (!confirm('Are you sure you want to remove this character from the story?')) {
      return;
    }

    try {
      await removeCharacterFromStory({
        storyId: story.id,
        characterId: characterId
      });
      
      // Refresh characters list
      refetchCharacters();
      toast.success('Character removed from story');
    } catch (error) {
      console.error('Error removing character from story:', error);
      toast.error('Failed to remove character from story. Please try again.');
    }
  };

  const handleUpdateCustomDescription = async (storyCharacterId: string, customDescription: string | null) => {
    try {
      await updateStoryCharacter({
        storyCharacterId,
        customDescription,
      });
      refetchCharacters();
      toast.success('Character customisation updated');
    } catch (error) {
      console.error('Error updating character customisation:', error);
      toast.error('Failed to update character customisation.');
      throw error;
    }
  };

  const handleGenerateStoryCharacterImage = async (storyCharacterId: string) => {
    try {
      await generateStoryCharacterImage({ storyCharacterId });
      refetchCharacters();
      toast.success('Story character image generation started');
    } catch (error) {
      console.error('Error generating story character image:', error);
      toast.error('Failed to generate story character image.');
    }
  };

  const handleDeleteScene = async (sceneId: string) => {
    if (!confirm('Are you sure you want to delete this scene? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteScene({ id: sceneId });
      // Refresh scenes list
      refetchScenes();
    } catch (error) {
      console.error('Error deleting scene:', error);
      toast.error('Failed to delete scene. Please try again.');
    }
  };

  const handleSceneClick = (scene: Scene) => {
    setSelectedScene(scene);
  };

  const handleBackFromScene = () => {
    setSelectedScene(null);
    refetchScenes(); // Refresh to get any updates
  };

  const handleEnhanceScript = async () => {
    if (!story.script || story.script.trim().length === 0) {
      toast.error('No script to enhance. Please add a script first.');
      return;
    }

    console.log('Enhancing script for story:', story.id);
    console.log('Story description for comparison:', story.description);

    setIsEnhancing(true);
    try {
      const result = await enhanceScriptAI({
        projectId: projectId,
        storyId: story.id,
        prompt: 'Please enhance this script to make it more engaging, detailed, and professional while maintaining the original story structure and dialogue:'
      });

      console.log('Enhancement result - Original:', result.originalScript);
      console.log('Enhancement result - Enhanced:', result.enhancedScript);

      // Update the edit script with the enhanced version
      setEditScript(result.enhancedScript);
      
      // Switch to edit mode to show the enhanced script
      setIsEditing(true);
    } catch (error) {
      console.error('Error enhancing script:', error);
      // Extract error message from the server response
      let errorMessage = 'Failed to enhance script. Please try again.';
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = (error as { message: string }).message;
      }
      toast.error(errorMessage);
    } finally {
      setIsEnhancing(false);
    }
  };

  // Stage 1: Generate scene titles only
  const handleGenerateSceneTitles = async () => {
    if (!story.script && !story.description) {
      toast.error('Story must have script or description to generate scenes.');
      return;
    }

    setIsGeneratingTitles(true);
    try {
      const result = await generateSceneTitlesAI({
        storyId: story.id,
        userPrompt: generationPrompt.trim() || undefined
      });

      // Initialize scenes with titles only, details will be generated after user approval
      const initialScenes = result.scenes.map(scene => ({
        ...scene,
        isProcessed: false,
        isGenerating: false
      }));
      
      setGeneratedScenes(initialScenes);
      setHasAcceptedTitles(false); // Reset acceptance state
    } catch (error) {
      console.error('Error generating scene titles:', error);
      let errorMessage = 'Failed to generate scene titles. Please try again.';
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = (error as { message: string }).message;
      }
      toast.error(errorMessage);
    } finally {
      setIsGeneratingTitles(false);
    }
  };

  const handleRegenerateTitles = async () => {
    await handleGenerateSceneTitles();
  };

  // Generate details for all scenes after user approval (always serial)
  const handleGenerateAllDetails = async () => {
    if (!generatedScenes || generatedScenes.length === 0) return;

    // Mark as accepted
    setHasAcceptedTitles(true);

    // Generate details for all scenes serially (one by one)
    for (let i = 0; i < generatedScenes.length; i++) {
      await generateSceneDetails(i);
    }
  };

  // Generate details for a specific scene with retry logic
  const generateSceneDetails = async (sceneIndex: number, retryCount = 0) => {
    if (!generatedScenes) return;

    const maxRetries = 2;
    
    // Update scene state to show it's generating
    setGeneratedScenes(prev => prev ? prev.map((scene, index) => 
      index === sceneIndex 
        ? { ...scene, isGenerating: true, error: undefined }
        : scene
    ) : null);

    try {
      const scene = generatedScenes[sceneIndex];
      // Prepare all scene titles for context
      const allSceneTitles = generatedScenes.map(s => ({
        title: s.title,
        serial: s.serial
      }));
      
      const sceneDetails = await generateSceneDetailsAI({
        storyId: story.id,
        allSceneInfo: generatedScenes.map(s => ({
          title: s.title,
          description: s.description || ''
        })),
        targetSceneIndex: sceneIndex,
        userPrompt: undefined
      });

      // Update scene with generated details
      setGeneratedScenes(prev => prev ? prev.map((s, index) => 
        index === sceneIndex 
          ? { 
              ...s, 
              description: sceneDetails.description,
              characters: sceneDetails.characters,
              isProcessed: true,
              isGenerating: false,
              error: undefined
            }
          : s
      ) : null);

    } catch (error) {
      console.error(`Error generating details for scene ${sceneIndex + 1}:`, error);
      
      // If we haven't exceeded max retries, try again
      if (retryCount < maxRetries) {
        console.log(`Retrying scene ${sceneIndex + 1} (attempt ${retryCount + 2}/${maxRetries + 1})`);
        setTimeout(() => {
          generateSceneDetails(sceneIndex, retryCount + 1);
        }, 1000 * (retryCount + 1)); // Exponential backoff
      } else {
        // Mark as failed after max retries
        const errorMessage = error && typeof error === 'object' && 'message' in error 
          ? (error as { message: string }).message 
          : 'Failed to generate details';
          
        setGeneratedScenes(prev => prev ? prev.map((s, index) => 
          index === sceneIndex 
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

  // Manual retry for a specific scene
  const handleRetryScene = async (sceneIndex: number) => {
    await generateSceneDetails(sceneIndex);
  };

  // Create actual scenes from generated data
  const handleCreateScenes = async () => {
    if (!generatedScenes || generatedScenes.length === 0) return;

    // Only create scenes that have been successfully processed
    const processedScenes = generatedScenes.filter(scene => scene.isProcessed && scene.description);
    
    if (processedScenes.length === 0) {
      toast.error('No scenes with details available to create. Please generate scene details first.');
      return;
    }

    setIsCreatingScenes(true);
    setCreatedScenesCount(0);
    let actualCreatedCount = 0;

    try {
      // Create scenes one by one to show progress
      for (let i = 0; i < processedScenes.length; i++) {
        const sceneData = processedScenes[i];
        const nextSerial = scenes.length + i + 1;
        
        try {
          // Map character names to character IDs
          const characterIds: string[] = [];
          if (sceneData.characters && sceneData.characters.length > 0) {
            for (const characterName of sceneData.characters) {
              const character = storyCharacters.find(char => 
                char.name.toLowerCase() === characterName.toLowerCase()
              );
              if (character) {
                characterIds.push(character.id);
              }
            }
          }

          await createScene({
            storyId: story.id,
            title: sceneData.title,
            description: sceneData.description || '',
            summary: sceneData.summary || '',
            serial: nextSerial,
            characterIds: characterIds.length > 0 ? characterIds : undefined
          });

          actualCreatedCount++;
          setCreatedScenesCount(actualCreatedCount);
        } catch (error) {
          console.error(`Error creating scene ${i + 1}:`, error);
          // Continue with next scene even if one fails
        }
        
        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Reset generation state
      setGeneratedScenes(null);
      setGenerationPrompt('');
      
      // Refresh scenes list
      refetchScenes();
      
      toast.success(`Successfully created ${actualCreatedCount} scenes!`);
    } catch (error) {
      console.error('Error creating scenes:', error);
      let errorMessage = 'Failed to create scenes. Please try again.';
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = (error as { message: string }).message;
      }
      toast.error(errorMessage);
    } finally {
      setIsCreatingScenes(false);
      setCreatedScenesCount(0);
    }
  };

  // Retry utility function with exponential backoff
  const retryWithBackoff = async (
    fn: () => Promise<any>,
    stepName: string = 'operation',
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<any> => {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        console.warn(`${stepName} failed (attempt ${attempt}/${maxRetries}):`, error);
        
        if (attempt === maxRetries) {
          throw error; // Re-throw on final attempt
        }
        
        // Exponential backoff: 1s, 2s, 4s
        const delay = baseDelay * Math.pow(2, attempt - 1);
        setFullGenerationProgress(prev => ({ 
          ...prev, 
          details: `${prev.details} (Retry ${attempt}/${maxRetries - 1} in ${delay/1000}s...)`,
          substeps: [...prev.substeps, `⚠️ ${stepName} failed (attempt ${attempt}/${maxRetries}), retrying in ${delay/1000}s...`]
        }));
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  };

  // Shared function for generating textual content (scenes and shots without images)
  const generateTextualContent = async (progressType: 'textual' | 'full' = 'textual') => {
    if (!story.script && !story.description) {
      toast.error('Story must have script or description to generate content.');
      return null;
    }

    const isFullGeneration = progressType === 'full';
    const progressTitle = isFullGeneration ? 'Full Generation' : 'Textual Generation';
    
    setIsGeneratingFull(true);
    setFullGenerationProgress({ 
      step: `Starting ${progressTitle.toLowerCase()}...`, 
      current: 0, 
      total: 100, 
      details: '', 
      retryCount: 0, 
      substeps: [],
      startTime: new Date(),
      estimatedTimeRemaining: null
    });

    try {
      // Step 1: Generate Scene Titles
      setFullGenerationProgress(prev => ({ 
        ...prev,
        step: 'Generating scene titles', 
        current: 10, 
        details: 'Creating scene breakdown...',
        substeps: [...prev.substeps, '🎬 Starting scene title generation...']
      }));
      
      const sceneTitlesResult = await retryWithBackoff(
        () => generateSceneTitlesAI({
          storyId: story.id,
          userPrompt: generationPrompt || undefined
        }),
        'Scene titles generation'
      );
      
      setFullGenerationProgress(prev => ({ 
        ...prev,
        substeps: [...prev.substeps, `✅ Generated ${sceneTitlesResult.scenes.length} scene titles`]
      }));

      if (!sceneTitlesResult.scenes || sceneTitlesResult.scenes.length === 0) {
        throw new Error('No scenes were generated');
      }

      const sceneCount = sceneTitlesResult.scenes.length;
      const currentProgress = 10;
      const progressPerScene = Math.round((90 - currentProgress) / sceneCount);

      // Step 2: Generate and create each scene with textual content
      for (let i = 0; i < sceneTitlesResult.scenes.length; i++) {
        const sceneTitle = sceneTitlesResult.scenes[i];
        const sceneProgress = Math.round(currentProgress + (i * progressPerScene));
        
        setFullGenerationProgress(prev => ({ 
          ...prev,
          step: `Processing scene ${i + 1}/${sceneCount}`, 
          current: sceneProgress, 
          details: sceneTitle.title,
          substeps: [...prev.substeps, `📝 Generating details for "${sceneTitle.title}"...`]
        }));

        // Generate scene details
        const sceneDetailsResult = await retryWithBackoff(
          () => generateSceneDetailsAI({
            storyId: story.id,
            allSceneInfo: sceneTitlesResult.scenes.map((s: any) => ({
              title: s.title,
              description: ''
            })),
            targetSceneIndex: i,
            userPrompt: undefined
          }),
          `Scene ${i + 1} details generation`
        );
        
        setFullGenerationProgress(prev => ({ 
          ...prev,
          substeps: [...prev.substeps, `✅ Scene details generated`]
        }));

        // Map character names to character IDs
        const characterIds: string[] = [];
        if (sceneDetailsResult.characters && sceneDetailsResult.characters.length > 0) {
          for (const characterName of sceneDetailsResult.characters) {
            const character = storyCharacters.find(char => 
              char.name.toLowerCase() === characterName.toLowerCase()
            );
            if (character) {
              characterIds.push(character.id);
            }
          }
        }

        // Create the scene
        const createdScene = await createScene({
          storyId: story.id,
          title: sceneDetailsResult.title,
          description: sceneDetailsResult.description || '',
          summary: sceneTitle.summary || '',
          serial: sceneTitle.serial,
          characterIds: characterIds.length > 0 ? characterIds : undefined
        });
        
        setFullGenerationProgress(prev => ({ 
          ...prev,
          substeps: [...prev.substeps, `✅ Scene "${sceneDetailsResult.title}" created in database`]
        }));

        // Generate shot titles
        setFullGenerationProgress(prev => ({ 
          ...prev,
          step: `Scene ${i + 1}/${sceneCount}: Generating shots`, 
          current: sceneProgress + Math.round(progressPerScene * 0.4), 
          details: 'Breaking scene into shots...',
          substeps: [...prev.substeps, `🎯 Generating shot titles for scene...`]
        }));
        
        const shotTitlesResult = await retryWithBackoff(
          () => generateShotTitlesAI({
            sceneId: createdScene.id,
            sceneDescription: sceneDetailsResult.description || sceneTitle.title,
            userPrompt: undefined
          }),
          `Scene ${i + 1} shot titles generation`
        );
        
        setFullGenerationProgress(prev => ({ 
          ...prev,
          substeps: [...prev.substeps, `✅ Generated ${shotTitlesResult.shots.length} shot titles`]
        }));

        if (shotTitlesResult.shots && shotTitlesResult.shots.length > 0) {
          // Generate shot details and create shots
          for (let j = 0; j < shotTitlesResult.shots.length; j++) {
            const shotTitle = shotTitlesResult.shots[j];
            
            setFullGenerationProgress(prev => ({ 
              ...prev,
              step: `Scene ${i + 1}/${sceneCount}: Shot ${j + 1}/${shotTitlesResult.shots.length}`, 
              current: sceneProgress + Math.round(progressPerScene * (0.6 + (j / shotTitlesResult.shots.length) * 0.3)), 
              details: shotTitle.title,
              substeps: [...prev.substeps, `📹 Generating details for shot "${shotTitle.title}"...`]
            }));

            // Generate shot details
            const shotDetailsResult = await retryWithBackoff(
              () => generateShotDetailsAI({
                sceneId: createdScene.id,
                shotSequence: shotTitle.sequence,
                shotTitle: shotTitle.title,
                allShotTitles: shotTitlesResult.shots,
                userPrompt: undefined
              }),
              `Scene ${i + 1}, Shot ${j + 1} details generation`
            );
            
            setFullGenerationProgress(prev => ({ 
              ...prev,
              substeps: [...prev.substeps, `✅ Shot details generated`]
            }));

            // Create the shot
            const createdShot = await createShot({
              sceneId: createdScene.id,
              title: shotDetailsResult.title,
              description: shotDetailsResult.description || '',
              sequence: shotTitle.sequence
            });
            
            setFullGenerationProgress(prev => ({ 
              ...prev,
              substeps: [...prev.substeps, `✅ Shot "${shotDetailsResult.title}" created in database`]
            }));
          }
        }
      }

      const completionMessage = isFullGeneration 
        ? `🎉 Full generation completed! Generated ${sceneCount} scenes with complete shot breakdowns!`
        : `🎉 Textual generation completed! Generated ${sceneCount} scenes with complete shot breakdowns!`;

      setFullGenerationProgress(prev => ({ 
        ...prev,
        step: 'Complete!', 
        current: 100, 
        details: `${progressTitle} completed successfully`,
        substeps: [...prev.substeps, completionMessage]
      }));
      
      // Refresh scenes to show all the new content
      refetchScenes();
      
      toast.success(`Successfully generated ${sceneCount} scenes with complete shot breakdowns!`);
      
      return sceneCount;
      
    } catch (error) {
      console.error(`Error in ${progressType} generation:`, error);
      let errorMessage = `Failed to complete ${progressType} generation. Please try again.`;
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = (error as { message: string }).message;
      }
      toast.error(errorMessage);
      
      setFullGenerationProgress(prev => ({ 
        ...prev,
        step: 'Failed', 
        current: 0, 
        details: errorMessage,
        substeps: [...prev.substeps, `❌ Generation failed: ${errorMessage}`]
      }));
      
      setTimeout(() => {
        setFullGenerationProgress({ step: '', current: 0, total: 0, details: '', retryCount: 0, substeps: [], startTime: null, estimatedTimeRemaining: null });
      }, 8000);
      
      return null;
    }
  };

  // Generate textual content only (scenes and shots without images)
  const handleGenerateTextuals = async () => {
    const sceneCount = await generateTextualContent('textual');
    if (sceneCount !== null) {
      // Reset the progress after a short delay
      setTimeout(() => {
        setFullGenerationProgress({ step: '', current: 0, total: 0, details: '', retryCount: 0, substeps: [], startTime: null, estimatedTimeRemaining: null });
      }, 5000);
    }
    setIsGeneratingFull(false);
  };

  // Generate images for existing scenes and shots
  const handleGenerateImages = async () => {
    if (!scenes || scenes.length === 0) {
      toast.error('No scenes found. Please generate textual content first.');
      return;
    }

    setIsGeneratingFull(true);
    setFullGenerationProgress({ 
      step: 'Starting image generation...', 
      current: 0, 
      total: 100, 
      details: '', 
      retryCount: 0, 
      substeps: [],
      startTime: new Date(),
      estimatedTimeRemaining: null
    });

    try {
      const totalScenes = scenes.length;
      let totalShots = 0;
      
      // Count total shots for progress calculation
      for (const scene of scenes) {
        const sceneShots = (scene as any).shots || [];
        totalShots += sceneShots.length;
      }

      const totalOperations = totalScenes + totalShots;
      let completedOperations = 0;

      // Generate scene overview images
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        
        if (!scene.overviewImageUuid) {
          setFullGenerationProgress(prev => ({ 
            ...prev,
            step: `Generating scene ${i + 1}/${totalScenes} overview image`, 
            current: Math.round((completedOperations / totalOperations) * 100), 
            details: scene.title,
            substeps: [...prev.substeps, `🖼️ Generating overview image for "${scene.title}"...`]
          }));
          
          await retryWithBackoff(
            () => generateSceneOverviewImage({
              sceneId: scene.id
            }),
            `Scene ${i + 1} overview image generation`
          );
          
          setFullGenerationProgress(prev => ({ 
            ...prev,
            substeps: [...prev.substeps, `✅ Overview image generated for "${scene.title}"`]
          }));
        }
        completedOperations++;
      }

      // Generate shot thumbnails
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const sceneShots = (scene as any).shots || [];
        
        for (let j = 0; j < sceneShots.length; j++) {
          const shot = sceneShots[j];
          
          const targetAspectRatioId = (story as any).aspectRatioId || currentAspectRatio?.id;
          const hasImageForRatio = targetAspectRatioId && shot.shotImages?.some(
            (img: any) => img.aspectRatioId === targetAspectRatioId
          );
          if (!shot.thumbnailUuid || (targetAspectRatioId && !hasImageForRatio)) {
            setFullGenerationProgress(prev => ({ 
              ...prev,
              step: `Generating shot ${completedOperations + 1}/${totalOperations} thumbnail`, 
              current: Math.round((completedOperations / totalOperations) * 100), 
              details: `${scene.title} - ${shot.title}`,
              substeps: [...prev.substeps, `🎨 Generating thumbnail for shot "${shot.title}"...`]
            }));
            
            await retryWithBackoff(
              () => generateShotThumbnail({
                shotId: shot.id,
                aspectRatioId: targetAspectRatioId || undefined
              }),
              `Scene ${i + 1}, Shot ${j + 1} thumbnail generation`
            );
            
            setFullGenerationProgress(prev => ({ 
              ...prev,
              substeps: [...prev.substeps, `✅ Thumbnail generated for shot "${shot.title}"`]
            }));
          }
          completedOperations++;
        }
      }

      setFullGenerationProgress(prev => ({ 
        ...prev,
        step: 'Complete!', 
        current: 100, 
        details: 'Image generation completed successfully',
        substeps: [...prev.substeps, `🎉 Image generation completed! Generated images for ${totalScenes} scenes and ${totalShots} shots!`]
      }));
      
      // Refresh scenes to show new images
      refetchScenes();
      
      toast.success(`Successfully generated images for ${totalScenes} scenes and ${totalShots} shots!`);
      
      // Reset the progress after a short delay
      setTimeout(() => {
        setFullGenerationProgress({ step: '', current: 0, total: 0, details: '', retryCount: 0, substeps: [], startTime: null, estimatedTimeRemaining: null });
      }, 5000);
      
    } catch (error) {
      console.error('Error in image generation:', error);
      let errorMessage = 'Failed to complete image generation. Please try again.';
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = (error as { message: string }).message;
      }
      toast.error(errorMessage);
      
      setFullGenerationProgress(prev => ({ 
        ...prev,
        step: 'Failed', 
        current: 0, 
        details: errorMessage,
        substeps: [...prev.substeps, `❌ Image generation failed: ${errorMessage}`]
      }));
      
      setTimeout(() => {
        setFullGenerationProgress({ step: '', current: 0, total: 0, details: '', retryCount: 0, substeps: [], startTime: null, estimatedTimeRemaining: null });
      }, 8000);
    } finally {
      setIsGeneratingFull(false);
    }
  };

  // Full generation workflow (textual + images)
  const handleGenerateFull = async () => {
    const sceneCount = await generateTextualContent('full');
    if (sceneCount !== null) {
      // Wait for scenes to be refreshed before proceeding to image generation
      const { data: updatedScenes } = await refetchScenes();
      
      // Verify we have the updated scenes data
      if (!updatedScenes || updatedScenes.length === 0) {
        toast.error('Failed to refresh scenes data. Please try again.');
        return;
      }
      
      // After textual generation, generate images
      await handleGenerateImages();
    }
  };

  const handleCancelGeneration = () => {
    setGeneratedScenes(null);
    setGenerationPrompt('');
    setCreatedScenesCount(0);
    setHasAcceptedTitles(false);
  };

  // If a scene is selected, show scene details
  if (selectedScene) {
    return <SceneDetails scene={selectedScene} onBack={handleBackFromScene} projectId={projectId} storyId={story.id} aspectRatioId={(story as any).aspectRatioId || currentAspectRatio?.id || null} />;
  }

  if (isEditing) {
    return (
      <div className='space-y-6'>
        <div className='flex justify-between items-center'>
          <h2 className='text-2xl font-bold'>Edit Story</h2>
        </div>

        <Card>
          <CardContent className='pt-6'>
            <div className='space-y-4'>
              <div>
                <Label htmlFor='edit-story-title'>Title</Label>
                <Input
                  id='edit-story-title'
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder='Enter story title'
                  className='mt-1'
                />
              </div>
              <div>
                <Label htmlFor='edit-story-description'>Description (Optional)</Label>
                <Textarea
                  id='edit-story-description'
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder='Enter story description'
                  className='mt-1'
                />
              </div>
              <div>
                <Label htmlFor='edit-story-script'>Script (Optional)</Label>
                <Textarea
                  id='edit-story-script'
                  value={editScript}
                  onChange={(e) => setEditScript(e.target.value)}
                  placeholder='Enter story script'
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

  if (isAddingScene) {
    return (
      <div className='space-y-6'>
        <div className='flex justify-between items-center'>
          <h2 className='text-2xl font-bold'>Add New Scene</h2>
        </div>

        <Card>
          <CardContent className='pt-6'>
            <div className='space-y-4'>
              <div>
                <Label htmlFor='new-scene-title'>Scene Title</Label>
                <Input
                  id='new-scene-title'
                  value={newSceneTitle}
                  onChange={(e) => setNewSceneTitle(e.target.value)}
                  placeholder='Enter scene title'
                  className='mt-1'
                />
              </div>
              <div>
                <Label htmlFor='new-scene-summary'>Summary (Optional)</Label>
                <Textarea
                  id='new-scene-summary'
                  value={newSceneSummary}
                  onChange={(e) => setNewSceneSummary(e.target.value)}
                  placeholder='Enter scene summary'
                  className='mt-1'
                />
              </div>
              <div>
                <Label htmlFor='new-scene-description'>Description (Optional)</Label>
                <Textarea
                  id='new-scene-description'
                  value={newSceneDescription}
                  onChange={(e) => setNewSceneDescription(e.target.value)}
                  placeholder='Enter scene description'
                  className='mt-1'
                />
              </div>
              <div className='flex gap-2'>
                <Button onClick={handleAddScene} disabled={!newSceneTitle.trim() || isCreatingScene}>
                  {isCreatingScene ? (
                    <>
                      <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                      Creating...
                    </>
                  ) : (
                    'Create Scene'
                  )}
                </Button>
                <Button variant='outline' onClick={handleCancelAddScene} disabled={isCreatingScene}>
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
            <span>{story.title || 'Untitled Story'}</span>
            <div className='flex items-center gap-3'>
              {/* Aspect Ratio Selector */}
              {aspectRatios.length > 0 && (
                <div className='flex items-center gap-2'>
                  <Maximize2 className='h-4 w-4 text-muted-foreground' />
                  <select
                    value={(story as any).aspectRatioId || ''}
                    onChange={(e) => handleAspectRatioChange(e.target.value)}
                    className='text-sm border rounded px-2 py-1 bg-white text-gray-700'
                  >
                    <option value='' disabled>Select Ratio</option>
                    {aspectRatios.map((ar: AspectRatio) => (
                      <option key={ar.id} value={ar.id}>
                        {ar.name} ({ar.width}:{ar.height}){ar.isDefault ? ' *' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className='text-sm text-muted-foreground'>
                Serial: {story.serial}
              </div>
              <Button onClick={() => setIsEditing(true)} variant='outline' size='sm'>
                <Edit2 className='h-4 w-4 mr-2' />
                Edit Story
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {story.description && (
            <div className='mb-4'>
              <h3 className='text-sm font-medium text-muted-foreground mb-2'>Description</h3>
              <div className='text-sm bg-gray-50 p-3 rounded whitespace-pre-wrap'>{story.description}</div>
            </div>
          )}

                            {/* Characters Section */}
                  <CharacterList
                    title="Characters"
                    currentCharacters={storyCharacters}
                    availableCharacters={projectCharacters.filter((char: Character) => 
                      !storyCharacters.some((sc: Character) => sc.id === char.id)
                    )}
                    onAddCharacters={handleAddCharactersToStory}
                    onRemoveCharacter={handleRemoveCharacterFromStory}
                    onUpdateCustomDescription={handleUpdateCustomDescription}
                    onGenerateStoryCharacterImage={handleGenerateStoryCharacterImage}
                    isLoading={charactersLoading}
                    emptyMessage="No characters assigned to this story yet."
                  />

          {story.script && (
            <div className='mb-4'>
              <div className='flex items-center justify-between mb-2'>
                <h3 className='text-sm font-medium text-muted-foreground'>Script</h3>
                <div className='flex gap-2'>
                  <Button 
                    onClick={() => setIsScriptExpanded(!isScriptExpanded)}
                    variant='outline' 
                    size='sm'
                  >
                    {isScriptExpanded ? (
                      <>
                        <ChevronUp className='h-4 w-4 mr-2' />
                        Collapse
                      </>
                    ) : (
                      <>
                        <ChevronDown className='h-4 w-4 mr-2' />
                        Expand
                      </>
                    )}
                  </Button>
                  <Button 
                    onClick={handleEnhanceScript} 
                    disabled={isEnhancing} 
                    variant='outline' 
                    size='sm'
                  >
                    {isEnhancing ? (
                      <>
                        <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                        Enhancing...
                      </>
                    ) : (
                      'Enhance'
                    )}
                  </Button>
                </div>
              </div>
              <div className={`font-mono bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap transition-all duration-200 ${
                isScriptExpanded 
                  ? '' 
                  : 'max-h-24 overflow-hidden relative'
              }`}>
                {story.script}
                {!isScriptExpanded && story.script.length > 200 && (
                  <div className='absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-gray-50 to-transparent pointer-events-none' />
                )}
              </div>
            </div>
          )}

          <div className='mb-6'>
            <div className='flex flex-wrap gap-2 mb-2'>
              <Button onClick={() => setIsAddingScene(true)} variant='outline' size='sm'>
                <Plus className='h-4 w-4 mr-2' />
                Add Scene
              </Button>
              <Button 
                onClick={handleGenerateSceneTitles} 
                disabled={isGeneratingTitles || isGeneratingFull || (!story.script && !story.description)} 
                variant='outline' 
                size='sm'
              >
                {isGeneratingTitles ? (
                  <>
                    <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className='h-4 w-4 mr-2' />
                    Generate Scenes
                  </>
                )}
              </Button>
              
              <Button 
                onClick={handleGenerateTextuals} 
                disabled={isGeneratingFull || isGeneratingTitles || (!story.script && !story.description)} 
                variant='outline' 
                size='sm'
                className='border-green-600 text-green-600 hover:bg-green-50'
              >
                {isGeneratingFull ? (
                  <>
                    <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                    Generating Textuals...
                  </>
                ) : (
                  <>
                    <FileText className='h-4 w-4 mr-2' />
                    Generate Textuals
                  </>
                )}
              </Button>
              
              <Button 
                onClick={handleGenerateImages} 
                disabled={isGeneratingFull || isGeneratingTitles || (!scenes || scenes.length === 0)} 
                variant='outline' 
                size='sm'
                className='border-blue-600 text-blue-600 hover:bg-blue-50'
              >
                {isGeneratingFull ? (
                  <>
                    <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                    Generating Images...
                  </>
                ) : (
                  <>
                    <Image className='h-4 w-4 mr-2' />
                    Generate Images
                  </>
                )}
              </Button>
              
              <Button 
                onClick={handleGenerateFull} 
                disabled={isGeneratingFull || isGeneratingTitles || (!story.script && !story.description)} 
                variant='default' 
                size='sm'
                className='bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
              >
                {isGeneratingFull ? (
                  <>
                    <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                    Generating Full...
                  </>
                ) : (
                  <>
                    <Zap className='h-4 w-4 mr-2' />
                    Generate Full
                  </>
                )}
              </Button>
            </div>
            <p className='text-xs text-muted-foreground'>
              AI scene generation is limited to a maximum of 4 scenes to ensure quality and focus.
              <br />
              <span className='text-green-600'>Generate Textuals:</span> Creates scenes and shots with descriptions (no images)
              <br />
              <span className='text-blue-600'>Generate Images:</span> Creates images for existing scenes and shots
              <br />
              <span className='text-purple-600'>Generate Full:</span> Complete workflow (textuals + images)
            </p>
            
            {/* Full Generation Progress */}
            {isGeneratingFull && fullGenerationProgress.step && (
              <div className='mt-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg'>
                <div className='flex items-center gap-2 mb-2'>
                  <Loader2 className='h-4 w-4 animate-spin text-purple-600' />
                  <span className='font-medium text-purple-900'>{fullGenerationProgress.step}</span>
                </div>
                <div className='w-full bg-purple-200 rounded-full h-2 mb-2'>
                  <div 
                    className='bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-300 ease-out'
                    style={{ width: `${fullGenerationProgress.current}%` }}
                  ></div>
                </div>
                <div className='flex justify-between text-xs text-purple-700 mb-3'>
                  <span className={fullGenerationProgress.details.includes('Retry') ? 'text-orange-600 font-medium' : ''}>
                    {fullGenerationProgress.details}
                  </span>
                  <div className='flex items-center gap-2'>
                    <span>{fullGenerationProgress.current}%</span>
                    {fullGenerationProgress.startTime && fullGenerationProgress.current > 0 && (
                      <span className='text-purple-600 font-medium'>
                        ⏱️ ~{formatTime(calculateEstimatedTimeRemaining(fullGenerationProgress.current, fullGenerationProgress.startTime) || 0)} remaining
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Detailed substeps - Enhanced scrollable container */}
                {fullGenerationProgress.substeps && fullGenerationProgress.substeps.length > 0 && (
                  <div className='bg-white/50 rounded-md p-3 border border-purple-100'>
                    <div className='text-xs text-gray-700 mb-2 font-medium text-purple-800'>
                      Progress Log ({fullGenerationProgress.substeps.length} steps)
                    </div>
                    <div className='max-h-48 overflow-y-auto custom-scrollbar'>
                      <div className='space-y-1 pr-2'>
                        {fullGenerationProgress.substeps.map((substep, index) => (
                          <div key={index} className='flex items-start gap-2 py-1 border-b border-gray-100 last:border-b-0'>
                            <span className='text-gray-500 text-[10px] mt-0.5 w-4 text-right flex-shrink-0'>
                              {index + 1}.
                            </span>
                            <span className={`text-xs leading-relaxed ${
                              substep.includes('⚠️') ? 'text-orange-600 font-medium' : 
                              substep.includes('✅') ? 'text-green-600' : 
                              substep.includes('❌') ? 'text-red-600' : 
                              substep.includes('🎉') ? 'text-purple-600 font-medium' :
                              'text-gray-700'
                            }`}>
                              {substep}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Generated Scenes with Inline Details */}
          {generatedScenes && (
            <div className='mb-6'>
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Sparkles className='h-5 w-5' />
                    Generated Scenes ({generatedScenes.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='space-y-4 mb-4'>
                    {generatedScenes.map((scene, index) => (
                      <div key={index} className='border rounded-lg p-4 bg-gray-50'>
                        {/* Scene Title with Status */}
                        <div className='flex items-center justify-between mb-3'>
                          <div className='font-medium'>Scene {scene.serial}: {scene.title}</div>
                          <div className='flex items-center gap-2'>
                            {scene.isGenerating && (
                              <div className='flex items-center text-blue-600 text-sm'>
                                <Loader2 className='h-4 w-4 mr-1 animate-spin' />
                                Generating...
                              </div>
                            )}
                            {scene.isProcessed && !scene.isGenerating && (
                              <div className='text-green-600 text-sm'>✓ Complete</div>
                            )}
                            {scene.error && !scene.isGenerating && (
                              <>
                                <div className='text-red-600 text-sm'>⚠ Failed</div>
                                <Button
                                  onClick={() => handleRetryScene(index)}
                                  size='sm'
                                  variant='outline'
                                  className='h-6 px-2 text-xs'
                                >
                                  <RefreshCw className='h-3 w-3 mr-1' />
                                  Retry
                                </Button>
                              </>
                            )}
                            {isCreatingScenes && index < createdScenesCount && (
                              <div className='text-blue-600 text-sm'>✓ Created</div>
                            )}
                            {isCreatingScenes && index === createdScenesCount && (
                              <Loader2 className='h-4 w-4 animate-spin text-blue-600' />
                            )}
                          </div>
                        </div>
                        
                        {/* Scene Details (shown inline) */}
                        {scene.summary && (
                          <div className='bg-white p-3 rounded border mb-2'>
                            <div className='text-sm text-muted-foreground mb-1'>Summary:</div>
                            <div className='text-sm whitespace-pre-wrap'>{scene.summary}</div>
                          </div>
                        )}
                        
                        {scene.description && (
                          <div className='bg-white p-3 rounded border mb-2'>
                            <div className='text-sm text-muted-foreground mb-1'>Description:</div>
                            <div className='text-sm whitespace-pre-wrap'>{scene.description}</div>
                          </div>
                        )}
                        
                        {scene.characters && scene.characters.length > 0 && (
                          <div className='text-xs text-muted-foreground'>
                            Characters: {scene.characters.join(', ')}
                          </div>
                        )}
                        
                        {scene.error && (
                          <div className='bg-red-50 border border-red-200 p-2 rounded mt-2'>
                            <div className='text-red-700 text-xs'>{scene.error}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <div className='space-y-3'>
                    <div>
                      <Label htmlFor='generation-prompt'>Modify prompt (optional)</Label>
                      <Input
                        id='generation-prompt'
                        value={generationPrompt}
                        onChange={(e) => setGenerationPrompt(e.target.value)}
                        placeholder='Enter specific instructions to modify the generation...'
                        className='mt-1'
                      />
                    </div>
                    
                    <div className='flex gap-2'>
                      <Button 
                        onClick={handleGenerateAllDetails} 
                        disabled={generatedScenes.some(s => s.isGenerating)}
                        className='bg-green-600 hover:bg-green-700'
                      >
                        {generatedScenes.some(s => s.isGenerating) ? (
                          <>
                            <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                            Creating Details...
                          </>
                        ) : hasAcceptedTitles && generatedScenes.some(s => s.isProcessed) ? (
                          'Recreate Details'
                        ) : hasAcceptedTitles ? (
                          'Create Details'
                        ) : (
                          'Accept & Create Details'
                        )}
                      </Button>
                      
                      {/* Create Ready Scenes Button - positioned right after details button */}
                      {generatedScenes.some(scene => scene.isProcessed && scene.description) && (
                        <Button 
                          onClick={handleCreateScenes} 
                          disabled={isCreatingScenes}
                          className='bg-blue-600 hover:bg-blue-700'
                        >
                          {isCreatingScenes ? (
                            <>
                              <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                              Creating Scenes ({createdScenesCount}/{generatedScenes.filter(s => s.isProcessed && s.description).length})
                            </>
                          ) : (
                            <>
                              <Film className='h-4 w-4 mr-2' />
                              Create Ready Scenes ({generatedScenes.filter(s => s.isProcessed && s.description).length})
                            </>
                          )}
                        </Button>
                      )}
                      
                      {!hasAcceptedTitles && (
                        <Button 
                          onClick={handleRegenerateTitles} 
                          disabled={isGeneratingTitles || generatedScenes.some(s => s.isGenerating)}
                          variant='outline'
                        >
                          {isGeneratingTitles ? (
                            <>
                              <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                              Regenerating...
                            </>
                          ) : (
                            'Regenerate Scenes'
                          )}
                        </Button>
                      )}
                      <Button 
                        onClick={handleCancelGeneration} 
                        disabled={generatedScenes.some(s => s.isGenerating)}
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



          {/* Scenes Section */}
          <div>
            <h3 className='text-lg font-semibold mb-3 flex items-center gap-2'>
              <Film className='h-5 w-5' />
              Scenes ({scenes.length})
            </h3>
            
            {scenesLoading ? (
              <div className='text-center py-4'>
                <Loader2 className='h-6 w-6 animate-spin mx-auto' />
                <p className='text-sm text-muted-foreground mt-2'>Loading scenes...</p>
              </div>
            ) : scenes.length === 0 ? (
              <div className='text-center py-8 text-muted-foreground'>
                <Film className='h-12 w-12 mx-auto mb-2 opacity-50' />
                <p>No scenes yet. Click "Add Scene" to create your first scene.</p>
              </div>
            ) : (
              <div className='grid gap-3'>
                {scenes.map((scene: Scene) => (
                  <Card 
                    key={scene.id} 
                    className='cursor-pointer hover:bg-gray-50 transition-colors'
                    onClick={() => handleSceneClick(scene)}
                  >
                    <CardContent className='p-4'>
                      <div className='flex items-center justify-between'>
                        <div className='flex items-center gap-3 flex-1 cursor-pointer' onClick={() => handleSceneClick(scene)}>
                          {/* Scene Image */}
                          <div className='flex-shrink-0'>
                            {scene.overviewImageUuid ? (
                              <MediaDisplay 
                                fileUuid={scene.overviewImageUuid} 
                                className='h-12 w-12 rounded object-cover'
                              />
                            ) : (
                              <div className='h-12 w-12 rounded bg-gray-100 flex items-center justify-center'>
                                <FileImage className='h-6 w-6 text-gray-400' />
                              </div>
                            )}
                          </div>
                          
                          {/* Scene Info */}
                          <div className='flex-1'>
                            <h4 className='font-medium flex items-center gap-2'>
                              <span className='text-sm text-muted-foreground font-normal'>{(scenes.indexOf(scene) + 1)}.</span>
                              {scene.title}
                            </h4>
                            {scene.summary && (
                              <p className='text-sm text-muted-foreground mt-1 line-clamp-2'>
                                {scene.summary}
                              </p>
                            )}
                            {scene.description && (
                              <p className='text-sm text-muted-foreground mt-1 line-clamp-2'>
                                {scene.description}
                              </p>
                            )}
                            {(scene as any).sceneCharacters && (scene as any).sceneCharacters.length > 0 && (
                              <div className='flex items-center gap-1 mt-1'>
                                <span className='text-xs text-muted-foreground'>Characters:</span>
                                <div className='flex flex-wrap gap-1'>
                                  {(scene as any).sceneCharacters.map((sc: any) => (
                                    <span 
                                      key={sc.character.id} 
                                      className='text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full'
                                    >
                                      {sc.character.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className='flex items-center gap-2'>
                          <div className='text-sm text-muted-foreground'>
                            Shots {(scene as any).shots ? (scene as any).shots.length : 0}
                          </div>
                          <div onClick={(e) => e.stopPropagation()}>
                            <ImageGalleryDialog
                              trigger={
                                <Button
                                  variant='outline'
                                  size='sm'
                                  className='text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                                  title='View Shots'
                                >
                                  <Eye className='h-4 w-4' />
                                </Button>
                              }
                              images={
                                (scene as any).shots && (scene as any).shots.length > 0
                                  ? (scene as any).shots
                                      .filter((shot: any) => shot.thumbnailUuid)
                                      .map((shot: any) => ({
                                        id: shot.id,
                                        imageUrl: `/serve-file/${shot.thumbnailUuid}.png`,
                                        title: shot.title,
                                        description: shot.description || 'No description available',
                                        alt: `Shot: ${shot.title}`
                                      }))
                                  : []
                              }
                              onClose={() => {}}
                            />
                          </div>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteScene(scene.id);
                            }}
                            className='text-red-600 hover:text-red-700 hover:bg-red-50'
                          >
                            <Trash2 className='h-4 w-4' />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>


    </div>
  );
}

