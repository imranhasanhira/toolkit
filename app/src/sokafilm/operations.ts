import { 
  GetAllProjectsByUser, 
  GetProjectById, 
  CreateProject, 
  UpdateProject, 
  DeleteProject,
  GetCharactersByProject,
  CreateCharacter,
  UpdateCharacter,
  DeleteCharacter,
  GenerateCharacterAI,
  GetStoriesByProject,
  CreateStory,
  UpdateStory,
  DeleteStory,
  GetScenesByStory,
  CreateScene,
  UpdateScene,
  DeleteScene,
  GenerateSceneAI,
  GetShotsByScene,
  CreateShot,
  UpdateShot,
  DeleteShot,
  GenerateShotAI,
  GetDialogsByScene,
  CreateDialog,
  UpdateDialog,
  DeleteDialog,
  GenerateDialogAI,
  GetFileByUuid,
  GetDynamicAiModels,
  GetAppSettings,
  UpdateAppSettings,
  AddCharactersToStory,
  RemoveCharacterFromStory,
  GetStoryCharacters,
  AddCharactersToScene,
  RemoveCharacterFromScene,
  GenerateCharacterImage,
  ImportTsvData,
  GetAspectRatios,
  CreateAspectRatio,
  UpdateAspectRatio,
  DeleteAspectRatio,
  UpdateStoryAspectRatio,
  UpdateStoryCharacter
} from 'wasp/server/operations';
import { aiFileGenerationJob } from 'wasp/server/jobs';
import type { Project, Character, Story, Scene, Shot, Dialog, SceneCharacter, StoryCharacter, File, AspectRatio, ShotImage } from 'wasp/entities';
import { HttpError } from 'wasp/server';
import { AiService } from '../server/ai/AiService';
import { defaultAiModels } from '../server/ai/constants';
import { AiSettings } from '../server/ai/types';
import { AppSettings } from './types/appSettings';
import { AI_TOOL_KEYS } from '../server/ai/constants';
import { saveBase64ImageWithMulter, getFilePathFromKey, fileExistsInStorage } from '../server/utils/multerStorage';

// Helper function to get AI settings from project
function getProjectAiSettings(project: any, category: 'text' | 'image' | 'video'): AiSettings {
  const aiSettings = project.aiSettings as any;
  const settings = aiSettings?.[category];
  
  if (!settings) {
    throw new HttpError(400, `Project ${category} AI settings not configured. Please configure ${category} AI settings in project settings first.`);
  }
  
  return settings as AiSettings;
}

// Helper function to convert input file UUIDs to file paths
async function convertUuidsToFilePaths(
  inputFileUuids: string[],
  context: any
): Promise<string[]> {
  if (!inputFileUuids || inputFileUuids.length === 0) {
    return [];
  }

  const inputFilePaths: string[] = [];

  for (const fileUuid of inputFileUuids) {
    try {
      // Check if file exists in storage
      if (!fileExistsInStorage(fileUuid)) {
        console.warn(`Input file does not exist in storage: ${fileUuid}`);
        continue;
      }

      // Get the full file path using multerStorage - UUID is the filename in storage
      const filePath = getFilePathFromKey(fileUuid);
      inputFilePaths.push(filePath);
      console.log(`✅ Found input file path: ${filePath}`);
    } catch (error) {
      console.error(`❌ Failed to get file path for ${fileUuid}:`, error);
      // Continue with other files even if one fails
    }
  }

  return inputFilePaths;
}

// Project operations
export const getAllProjectsByUser: GetAllProjectsByUser<void, Project[]> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  return context.entities.Project.findMany({
    where: { 
      userId: context.user.id,
      isArchived: false 
    },
    orderBy: { createdAt: 'desc' }
  });
};

export const getProjectById: GetProjectById<{ projectId: string }, Project> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  const project = await context.entities.Project.findFirst({
    where: { 
      id: args.projectId,
      userId: context.user.id 
    }
  });

  if (!project) {
    throw new HttpError(404, 'Project not found');
  }

  return project;
};

export const createProject: CreateProject<{ name: string; description?: string; aiSettings?: any }, Project> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  if (!args.name || args.name.trim().length === 0) {
    throw new HttpError(400, 'Project name is required');
  }

  // Validate custom AI settings if provided
  if (args.aiSettings) {
    const aiService = AiService.getInstance();
    const validation = await aiService.validateProjectAiSettings(args.aiSettings);
    if (!validation.isValid) {
      throw new HttpError(400, `Invalid AI settings: ${validation.errors.join('; ')}`);
    }
  }

  // Ensure we have default models for all categories
  if (!defaultAiModels.text || !defaultAiModels.image || !defaultAiModels.video) {
    throw new HttpError(500, 'AI model configuration is incomplete. Please check server configuration.');
  }

  return context.entities.Project.create({
    data: {
      name: args.name.trim(),
      description: args.description?.trim() || null,
      aiSettings: args.aiSettings || defaultAiModels,
      userId: context.user.id,
    }
  });
};

export const updateProject: UpdateProject<{ id: string; name?: string; description?: string; aiSettings?: any }, Project> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  const project = await context.entities.Project.findFirst({
    where: { 
      id: args.id, 
      userId: context.user.id 
    }
  });

  if (!project) {
    throw new HttpError(404, 'Project not found');
  }

  // Validate AI settings if provided
  if (args.aiSettings !== undefined) {
    const aiService = AiService.getInstance();
    const validation = await aiService.validateProjectAiSettings(args.aiSettings);
    if (!validation.isValid) {
      throw new HttpError(400, `Invalid AI settings: ${validation.errors.join('; ')}`);
    }
  }

  return context.entities.Project.update({
    where: { id: args.id },
    data: {
      name: args.name?.trim() || project.name,
      description: args.description?.trim() || project.description,
      aiSettings: args.aiSettings !== undefined ? args.aiSettings : project.aiSettings,
    }
  });
};

export const deleteProject: DeleteProject<{ id: string }, Project> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  const project = await context.entities.Project.findFirst({
    where: { 
      id: args.id, 
      userId: context.user.id 
    }
  });

  if (!project) {
    throw new HttpError(404, 'Project not found');
  }

  return context.entities.Project.delete({
    where: { id: args.id }
  });
};

// Character operations
export const getCharactersByProject: GetCharactersByProject<{ projectId: string }, Character[]> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  return context.entities.Character.findMany({
    where: { 
      projectId: args.projectId
    },
    orderBy: { serial: 'asc' }
  });
};

export const createCharacter: CreateCharacter<{ projectId: string; name: string; description?: string; serial: number }, Character> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  if (!args.name || args.name.trim().length === 0) {
    throw new HttpError(400, 'Character name is required');
  }

  return context.entities.Character.create({
    data: {
      name: args.name.trim(),
      description: args.description?.trim() || null,
      serial: args.serial,
      projectId: args.projectId,
    }
  });
};

export const updateCharacter: UpdateCharacter<{ id: string; name?: string; description?: string }, Character> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  const character = await context.entities.Character.findFirst({
    where: { id: args.id },
    include: { project: true }
  });

  if (!character || character.project.userId !== context.user.id) {
    throw new HttpError(404, 'Character not found');
  }

  return context.entities.Character.update({
    where: { id: args.id },
    data: {
      name: args.name?.trim() || character.name,
      description: args.description?.trim() || character.description,
    }
  });
};

export const deleteCharacter: DeleteCharacter<{ id: string }, Character> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  const character = await context.entities.Character.findFirst({
    where: { id: args.id },
    include: { project: true }
  });

  if (!character || character.project.userId !== context.user.id) {
    throw new HttpError(404, 'Character not found');
  }

  return context.entities.Character.delete({
    where: { id: args.id }
  });
};

export const generateCharacterAI: GenerateCharacterAI<{ id: string }, Character> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  const character = await context.entities.Character.findFirst({
    where: { id: args.id },
    include: { project: true }
  });

  if (!character || character.project.userId !== context.user.id) {
    throw new HttpError(404, 'Character not found');
  }

  // Generate random UUID for AI-generated content
  const finalImageUuid = `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return context.entities.Character.update({
    where: { id: args.id },
    data: { finalImageUuid }
  });
};

// Story operations
export const getStoriesByProject: GetStoriesByProject<{ projectId: string }, Story[]> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  return context.entities.Story.findMany({
    where: { projectId: args.projectId },
    include: { aspectRatio: true },
    orderBy: { serial: 'asc' }
  });
};

export const createStory: CreateStory<{ projectId: string; title: string; description?: string; script?: string; serial: number }, Story> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  if (!args.title || args.title.trim().length === 0) {
    throw new HttpError(400, 'Story title is required');
  }

  return context.entities.Story.create({
    data: {
      title: args.title.trim(),
      description: args.description?.trim() || null,
      script: args.script?.trim() || null,
      serial: args.serial,
      projectId: args.projectId,
    }
  });
};

export const updateStory: UpdateStory<{ id: string; title?: string; description?: string; script?: string }, Story> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  const story = await context.entities.Story.findFirst({
    where: { id: args.id },
    include: { project: true }
  });

  if (!story || story.project.userId !== context.user.id) {
    throw new HttpError(404, 'Story not found');
  }

  return context.entities.Story.update({
    where: { id: args.id },
    data: {
      title: args.title?.trim() || story.title,
      description: args.description?.trim() || story.description,
      script: args.script?.trim() || story.script,
    }
  });
};

export const deleteStory: DeleteStory<{ id: string }, Story> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  const story = await context.entities.Story.findFirst({
    where: { id: args.id },
    include: { project: true }
  });

  if (!story || story.project.userId !== context.user.id) {
    throw new HttpError(404, 'Story not found');
  }

  return context.entities.Story.delete({
    where: { id: args.id }
  });
};

// Story Character operations
export const addCharactersToStory: AddCharactersToStory<{ storyId: string; characterIds: string[] }, Story> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  const story = await context.entities.Story.findFirst({
    where: { id: args.storyId },
    include: { project: true }
  });

  if (!story || story.project.userId !== context.user.id) {
    throw new HttpError(404, 'Story not found');
  }

  // Add characters to story
  for (const characterId of args.characterIds) {
    // Check if character already exists in story
    const existingStoryCharacter = await context.entities.StoryCharacter.findFirst({
      where: {
        storyId: args.storyId,
        characterId: characterId
      }
    });

    if (!existingStoryCharacter) {
      await context.entities.StoryCharacter.create({
        data: {
          storyId: args.storyId,
          characterId: characterId
        }
      });
    }
  }

  return story;
};

export const removeCharacterFromStory: RemoveCharacterFromStory<{ storyId: string; characterId: string }, Story> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  const story = await context.entities.Story.findFirst({
    where: { id: args.storyId },
    include: { project: true }
  });

  if (!story || story.project.userId !== context.user.id) {
    throw new HttpError(404, 'Story not found');
  }

  // Remove character from story
  await context.entities.StoryCharacter.deleteMany({
    where: {
      storyId: args.storyId,
      characterId: args.characterId
    }
  });

  return story;
};

export const getStoryCharacters: GetStoryCharacters<{ storyId: string }, Character[]> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  const story = await context.entities.Story.findFirst({
    where: { id: args.storyId },
    include: { project: true }
  });

  if (!story || story.project.userId !== context.user.id) {
    throw new HttpError(404, 'Story not found');
  }

  const storyCharacters = await context.entities.StoryCharacter.findMany({
    where: { storyId: args.storyId },
    include: { character: true },
    orderBy: { character: { serial: 'asc' } }
  });

  // Return character data merged with story-specific customization
  return storyCharacters.map((sc: any) => ({
    ...sc.character,
    storyCharacterId: sc.id,
    customDescription: sc.customDescription,
    customImageUuid: sc.customImageUuid,
  }));
};

export const updateStoryCharacter: UpdateStoryCharacter<{ storyCharacterId: string; customDescription?: string | null }, any> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  const storyCharacter = await context.entities.StoryCharacter.findFirst({
    where: { id: args.storyCharacterId },
    include: { story: { include: { project: true } } }
  });

  if (!storyCharacter || storyCharacter.story.project.userId !== context.user.id) {
    throw new HttpError(404, 'Story character not found');
  }

  return context.entities.StoryCharacter.update({
    where: { id: args.storyCharacterId },
    data: {
      customDescription: args.customDescription ?? null,
    },
    include: { character: true }
  });
};

// Scene Character operations
export const addCharactersToScene: AddCharactersToScene<{ sceneId: string; characterIds: string[] }, Scene> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  const scene = await context.entities.Scene.findFirst({
    where: { id: args.sceneId },
    include: { 
      story: {
        include: { project: true }
      }
    }
  });

  if (!scene || scene.story.project.userId !== context.user.id) {
    throw new HttpError(404, 'Scene not found');
  }

  // Get current characters in the scene
  const currentSceneCharacters = await context.entities.SceneCharacter.findMany({
    where: { sceneId: args.sceneId }
  });
  const currentCharacterIds = currentSceneCharacters.map((sc: any) => sc.characterId);
  
  // Get story characters to validate against
  const storyCharacterRecords = await context.entities.StoryCharacter.findMany({
    where: { storyId: scene.storyId }
  });
  const storyCharacterIds = new Set(storyCharacterRecords.map((sc: any) => sc.characterId));

  // Find characters to add (new ones not already in the scene, must be in the story)
  const charactersToAdd = args.characterIds.filter(id => 
    !currentCharacterIds.includes(id) && storyCharacterIds.has(id)
  );
  
  // Add new characters (avoid duplicates)
  for (const characterId of charactersToAdd) {
    try {
      await context.entities.SceneCharacter.create({
        data: {
          sceneId: args.sceneId,
          characterId: characterId
        }
      });
    } catch (error) {
      // If character already exists, skip (shouldn't happen with our logic, but just in case)
      console.log(`Character ${characterId} already exists in scene ${args.sceneId}, skipping...`);
    }
  }

  return scene;
};

export const removeCharacterFromScene: RemoveCharacterFromScene<{ sceneId: string; characterId: string }, Scene> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  const scene = await context.entities.Scene.findFirst({
    where: { id: args.sceneId },
    include: { 
      story: {
        include: { project: true }
      }
    }
  });

  if (!scene || scene.story.project.userId !== context.user.id) {
    throw new HttpError(404, 'Scene not found');
  }

  // Remove character from scene
  await context.entities.SceneCharacter.deleteMany({
    where: {
      sceneId: args.sceneId,
      characterId: args.characterId
    }
  });

  return scene;
};

// Scene operations
export const getScenesByStory: GetScenesByStory<{ storyId: string }, Scene[]> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  return context.entities.Scene.findMany({
    where: { 
      storyId: args.storyId
    },
    include: {
      story: {
        include: {
          storyCharacters: true
        }
      },
      sceneCharacters: {
        include: {
          character: true
        }
      },
      dialogs: {
        include: {
          character: true
        }
      },
      shots: {
        orderBy: { sequence: 'asc' },
        include: {
          shotImages: {
            include: {
              aspectRatio: true
            }
          },
          shotCharacters: {
            include: {
              character: true
            }
          }
        }
      }
    },
    orderBy: { serial: 'asc' }
  });
};

export const createScene: CreateScene<{ storyId: string; title: string; description?: string; summary?: string; serial: number; characterIds?: string[] }, Scene> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  if (!args.title || args.title.trim().length === 0) {
    throw new HttpError(400, 'Scene title is required');
  }

  const scene = await context.entities.Scene.create({
    data: {
      title: args.title.trim(),
      description: args.description?.trim() || null,
      summary: args.summary?.trim() || null,
      serial: args.serial,
      storyId: args.storyId,
    }
  });

  // Add characters to scene if provided
  if (args.characterIds && args.characterIds.length > 0) {
    for (const characterId of args.characterIds) {
      await context.entities.SceneCharacter.create({
        data: {
          sceneId: scene.id,
          characterId: characterId
        }
      });
    }
  }

  return scene;
};

export const updateScene: UpdateScene<{ id: string; title?: string; description?: string; summary?: string; characterIds?: string[] }, Scene> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  const scene = await context.entities.Scene.findFirst({
    where: { id: args.id },
    include: { 
      story: {
        include: { project: true }
      }
    }
  });

  if (!scene || scene.story.project.userId !== context.user.id) {
    throw new HttpError(404, 'Scene not found');
  }

  const updatedScene = await context.entities.Scene.update({
    where: { id: args.id },
    data: {
      title: args.title?.trim() || scene.title,
      description: args.description?.trim() || scene.description,
      summary: args.summary?.trim() || scene.summary,
    },
    include: {
      sceneCharacters: {
        include: {
          character: true
        }
      },
      dialogs: {
        include: {
          character: true
        }
      },
      shots: {
        orderBy: { sequence: 'asc' }
      }
    }
  });

  // Update characters if provided
  if (args.characterIds) {
    // Get current characters in the scene
    const currentSceneCharacters = await context.entities.SceneCharacter.findMany({
      where: { sceneId: args.id }
    });
    const currentCharacterIds = currentSceneCharacters.map((sc: any) => sc.characterId);
    
    // Find characters to add (new ones not already in the scene)
    const charactersToAdd = args.characterIds.filter(id => !currentCharacterIds.includes(id));
    
    // Add new characters (avoid duplicates)
    for (const characterId of charactersToAdd) {
      try {
        await context.entities.SceneCharacter.create({
          data: {
            sceneId: args.id,
            characterId: characterId
          }
        });
      } catch (error) {
        // If character already exists, skip (shouldn't happen with our logic, but just in case)
        console.log(`Character ${characterId} already exists in scene ${args.id}, skipping...`);
      }
    }
  }

  return updatedScene;
};

export const deleteScene: DeleteScene<{ id: string }, Scene> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  const scene = await context.entities.Scene.findFirst({
    where: { id: args.id },
    include: { 
      story: {
        include: { project: true }
      }
    }
  });

  if (!scene || scene.story.project.userId !== context.user.id) {
    throw new HttpError(404, 'Scene not found');
  }

  return context.entities.Scene.delete({
    where: { id: args.id }
  });
};

export const generateSceneAI: GenerateSceneAI<{ id: string }, Scene> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  const scene = await context.entities.Scene.findFirst({
    where: { id: args.id },
    include: { 
      story: {
        include: { project: true }
      }
    }
  });

  if (!scene || scene.story.project.userId !== context.user.id) {
    throw new HttpError(404, 'Scene not found');
  }

  // Generate random UUID for AI-generated content
  const overviewImageUuid = `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return context.entities.Scene.update({
    where: { id: args.id },
    data: { overviewImageUuid }
  });
};

// Shot operations
export const getShotsByScene: GetShotsByScene<{ sceneId: string }, Shot[]> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  return context.entities.Shot.findMany({
    where: { sceneId: args.sceneId },
    include: {
      shotImages: {
        include: {
          aspectRatio: true
        }
      }
    },
    orderBy: { sequence: 'asc' }
  });
};

export const createShot: CreateShot<{ sceneId: string; title: string; description?: string; sequence: number }, Shot> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  if (!args.title || args.title.trim().length === 0) {
    throw new HttpError(400, 'Shot title is required');
  }

  // Get all existing shots for this scene to check if we need to reorder sequences
  const existingShots = await context.entities.Shot.findMany({
    where: { sceneId: args.sceneId },
    orderBy: { sequence: 'asc' }
  });

  // If inserting at a position that already has shots, we need to shift sequences
  if (args.sequence <= existingShots.length) {
    // Shift all shots with sequence >= insertion point up by 1
    for (let i = existingShots.length - 1; i >= 0; i--) {
      const shot = existingShots[i];
      if (shot.sequence >= args.sequence) {
        await context.entities.Shot.update({
          where: { id: shot.id },
          data: { sequence: shot.sequence + 1 }
        });
      }
    }
  }

  return context.entities.Shot.create({
    data: {
      title: args.title.trim(),
      description: args.description?.trim() || null,
      sequence: args.sequence,
      sceneId: args.sceneId,
    }
  });
};

export const updateShot: UpdateShot<{ id: string; title?: string; description?: string }, Shot> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  const shot = await context.entities.Shot.findFirst({
    where: { id: args.id },
    include: { 
      scene: {
        include: {
          story: {
            include: { project: true }
          }
        }
      }
    }
  });

  if (!shot || shot.scene.story.project.userId !== context.user.id) {
    throw new HttpError(404, 'Shot not found');
  }

  return context.entities.Shot.update({
    where: { id: args.id },
    data: {
      title: args.title?.trim() || shot.title,
      description: args.description?.trim() || shot.description,
    }
  });
};

export const deleteShot: DeleteShot<{ id: string }, Shot> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  const shot = await context.entities.Shot.findFirst({
    where: { id: args.id },
    include: { 
      scene: {
        include: {
          story: {
            include: { project: true }
          }
        }
      }
    }
  });

  if (!shot || shot.scene.story.project.userId !== context.user.id) {
    throw new HttpError(404, 'Shot not found');
  }

  // Delete the shot
  await context.entities.Shot.delete({
    where: { id: args.id }
  });

  // Reorder the remaining shots' sequences
  const remainingShots = await context.entities.Shot.findMany({
    where: { sceneId: shot.sceneId },
    orderBy: { sequence: 'asc' }
  });

  // Update sequences to be sequential (1, 2, 3, ...)
  for (let i = 0; i < remainingShots.length; i++) {
    await context.entities.Shot.update({
      where: { id: remainingShots[i].id },
      data: { sequence: i + 1 }
    });
  }

  return shot;
};

export const generateShotAI: GenerateShotAI<{ id: string }, Shot> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  const shot = await context.entities.Shot.findFirst({
    where: { id: args.id },
    include: { 
      scene: {
        include: {
          story: {
            include: { project: true }
          }
        }
      }
    }
  });

  if (!shot || shot.scene.story.project.userId !== context.user.id) {
    throw new HttpError(404, 'Shot not found');
  }

  // Generate random UUID for AI-generated content
  const thumbnailUuid = `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return context.entities.Shot.update({
    where: { id: args.id },
    data: { thumbnailUuid }
  });
};

export const reorderShots = async (args: { sceneId: string; shotIds: string[] }, context: any): Promise<Shot[]> => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  // Verify user owns the scene
  const scene = await context.entities.Scene.findFirst({
    where: { id: args.sceneId },
    include: {
      story: {
        include: { project: true }
      }
    }
  });

  if (!scene || scene.story.project.userId !== context.user.id) {
    throw new HttpError(404, 'Scene not found');
  }

  // Verify all shot IDs belong to this scene
  const shots = await context.entities.Shot.findMany({
    where: { 
      id: { in: args.shotIds },
      sceneId: args.sceneId
    }
  });

  if (shots.length !== args.shotIds.length) {
    throw new HttpError(400, 'Some shots not found in this scene');
  }

  // Update sequences based on the new order
  const updates = args.shotIds.map((shotId: string, index: number) => 
    context.entities.Shot.update({
      where: { id: shotId },
      data: { sequence: index + 1 }
    })
  );

  await Promise.all(updates);

  // Return updated shots in new order
  return context.entities.Shot.findMany({
    where: { sceneId: args.sceneId },
    orderBy: { sequence: 'asc' }
  });
};

// Dialog operations
export const getDialogsByScene: GetDialogsByScene<{ sceneId: string }, Dialog[]> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  return context.entities.Dialog.findMany({
    where: { sceneId: args.sceneId },
    include: { character: true },
    orderBy: { startEpochMilliseconds: 'asc' }
  });
};

export const createDialog: CreateDialog<{ characterId: string; sceneId: string; text: string; startEpochMilliseconds: bigint; soundUuid?: string }, Dialog> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  // Check if the character exists and belongs to the user through project
  const character = await context.entities.Character.findFirst({
    where: { id: args.characterId },
    include: { project: true }
  });

  if (!character || character.project.userId !== context.user.id) {
    throw new HttpError(404, 'Character not found');
  }

  // Check if the scene exists and belongs to the user through project
  const scene = await context.entities.Scene.findFirst({
    where: { id: args.sceneId },
    include: { story: { include: { project: true } } }
  });

  if (!scene || scene.story.project.userId !== context.user.id) {
    throw new HttpError(404, 'Scene not found');
  }

          return context.entities.Dialog.create({
          data: {
            text: args.text.trim(),
            startEpochMilliseconds: args.startEpochMilliseconds,
            characterId: args.characterId,
            sceneId: args.sceneId,
            soundUuid: args.soundUuid,
          }
        });
};

export const updateDialog: UpdateDialog<{ id: string; text?: string; startEpochMilliseconds?: bigint; soundUuid?: string }, Dialog> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  const dialog = await context.entities.Dialog.findFirst({
    where: { id: args.id },
    include: { 
      character: { include: { project: true } },
      scene: { include: { story: { include: { project: true } } } }
    }
  });

  if (!dialog) {
    throw new HttpError(404, 'Dialog not found');
  }

  // Check if user owns the project through either character or scene
  if (dialog.character.project.userId !== context.user.id || 
      (dialog.scene && dialog.scene.story.project.userId !== context.user.id)) {
    throw new HttpError(403, 'Not authorized to update this dialog');
  }

          return context.entities.Dialog.update({
          where: { id: args.id },
          data: {
            text: args.text?.trim() || dialog.text,
            startEpochMilliseconds: args.startEpochMilliseconds || dialog.startEpochMilliseconds,
            soundUuid: args.soundUuid !== undefined ? args.soundUuid : dialog.soundUuid,
          }
        });
};

export const deleteDialog: DeleteDialog<{ id: string }, Dialog> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  const dialog = await context.entities.Dialog.findFirst({
    where: { id: args.id },
    include: { 
      scene: {
        include: {
          story: {
            include: { project: true }
          }
        }
      }
    }
  });

  if (!dialog || dialog.scene?.story.project.userId !== context.user.id) {
    throw new HttpError(404, 'Dialog not found');
  }

  return context.entities.Dialog.delete({
    where: { id: args.id }
  });
};

export const generateDialogAI: GenerateDialogAI<{ id: string }, Dialog> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  const dialog = await context.entities.Dialog.findFirst({
    where: { id: args.id },
    include: { 
      scene: {
        include: {
          story: {
            include: { project: true }
          }
        }
      }
    }
  });

  if (!dialog || dialog.scene?.story.project.userId !== context.user.id) {
    throw new HttpError(404, 'Dialog not found');
  }

  // Generate random UUID for AI-generated content
  const soundUuid = `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return context.entities.Dialog.update({
    where: { id: args.id },
    data: { soundUuid }
  });
};

// AI Script Enhancement operation
export const enhanceScriptAI = async (args: { 
  projectId: string;
  storyId: string;
  prompt?: string; 
}, context: any): Promise<{ 
  originalScript: string; 
  enhancedScript: string; 
  modelUsed: string; 
  promptUsed: string; 
  timestamp: string; 
  storyCharacters?: string[];
}> => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  if (!args.storyId) {
    throw new HttpError(400, 'Story ID is required');
  }

  // Fetch project to get AI settings
  const project = await context.entities.Project.findFirst({
    where: { 
      id: args.projectId,
      userId: context.user.id 
    }
  });

  if (!project) {
    throw new HttpError(404, 'Project not found');
  }

  // Fetch story to get script
  const story = await context.entities.Story.findFirst({
    where: { 
      id: args.storyId,
      projectId: args.projectId
    }
  });

  if (!story) {
    throw new HttpError(404, 'Story not found');
  }

  if (!story.script || story.script.trim().length === 0) {
    throw new HttpError(400, 'Story must have a script to enhance');
  }

  // Fetch story characters
  const storyCharacters = await context.entities.StoryCharacter.findMany({
    where: { storyId: args.storyId },
    include: { character: true }
  });

  const characterNames = storyCharacters.map((sc: any) => sc.character.name);

  // Get AI settings for text generation
  const textSettings = getProjectAiSettings(project, 'text');

  try {
    // Get AI service instance
    const aiService = AiService.getInstance();
    
    // Generate enhanced script using project's text AI settings
    const result = await aiService.enhanceScript(
      story.script,
      args.prompt || 'Please enhance this script:',
      textSettings, // Pass full AI settings
      characterNames // Pass story character names
    );

    return result;
  } catch (error) {
    console.error('Error in enhanceScriptAI:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        throw new HttpError(400, error.message);
      }
      
      if (error.message.includes('server is not running') || error.message.includes('not accessible')) {
        throw new HttpError(503, error.message);
      }
    }
    
    throw new HttpError(500, `Failed to enhance script: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// AI Character Description Enhancement operation
export const enhanceCharacterDescriptionAI = async (args: { 
  projectId: string;
  characterId: string;
  prompt?: string;
}, context: any): Promise<{ 
  originalDescription: string; 
  enhancedDescription: string; 
  modelUsed: string; 
  promptUsed: string; 
  timestamp: string; 
}> => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  // Fetch project to get AI settings
  const project = await context.entities.Project.findFirst({
    where: { 
      id: args.projectId,
      userId: context.user.id 
    }
  });

  if (!project) {
    throw new HttpError(404, 'Project not found');
  }

  // Get the character to verify it belongs to this project
  const character = await context.entities.Character.findFirst({
    where: { 
      id: args.characterId,
      projectId: args.projectId
    }
  });

  if (!character) {
    throw new HttpError(404, 'Character not found');
  }

  if (!character.description || character.description.trim().length === 0) {
    throw new HttpError(400, 'Character must have a description to enhance');
  }

  // Get AI settings for text generation
  const textSettings = getProjectAiSettings(project, 'text');

  try {
    // Get AI service instance
    const aiService = AiService.getInstance();
    
    // Generate enhanced character description using project's text AI settings
    const result = await aiService.enhanceCharacterDescription(
      character.description,
      args.prompt || 'Please enhance this character description for better image generation:',
      textSettings // Pass full AI settings
    );

    return result;
  } catch (error) {
    console.error('Error in enhanceCharacterDescriptionAI:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        throw new HttpError(400, error.message);
      }
      
      if (error.message.includes('server is not running') || error.message.includes('not accessible')) {
        throw new HttpError(503, error.message);
      }
    }
    
    throw new HttpError(500, `Failed to enhance character description: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// AI Scene Title Generation operation
type GenerateSceneTitlesAI = (args: { 
  storyId: string;
  userPrompt?: string;
}, context: any) => Promise<{ 
  scenes: Array<{ title: string; serial: number; summary: string }>;
}>;

export const generateSceneTitlesAI: GenerateSceneTitlesAI = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  // Verify user owns the story and get project for AI settings
  const story = await context.entities.Story.findFirst({
    where: { id: args.storyId },
    include: { project: true }
  });

  if (!story || story.project.userId !== context.user.id) {
    throw new HttpError(404, 'Story not found');
  }

  // Get story content (script or description)
  const storyContent = story.script || story.description;
  if (!storyContent || storyContent.trim().length === 0) {
    throw new HttpError(400, 'Story must have script or description to generate scene titles');
  }

      // Get AI settings for text generation from project
    const textSettings = getProjectAiSettings(story.project, 'text');

  try {
    // Get AI service instance
    const aiService = AiService.getInstance();
    
    // Generate scene titles with structured output using project's text AI settings
    const result = await aiService.generateSceneTitles(
      storyContent.trim(), 
      textSettings, // Pass full AI settings
      args.userPrompt
    );

    return result;
  } catch (error) {
    console.error('Error in generateSceneTitlesAI:', error);
    
    if (error instanceof HttpError) {
      throw error;
    }
    
    // Handle specific AI service errors with appropriate HTTP status codes
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        throw new HttpError(400, error.message);
      }
      
      if (error.message.includes('server is not running') || error.message.includes('not accessible')) {
        throw new HttpError(503, error.message);
      }
    }
    
    throw new HttpError(500, `Failed to generate scene titles: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// AI Scene Detail Generation operation
type GenerateSceneDetailsAI = (args: { 
  storyId: string;
  allSceneInfo: Array<{ title: string; description: string }>;
  targetSceneIndex: number;
  userPrompt?: string;
}, context: any) => Promise<{ 
  title: string; 
  description: string; 
  characters: string[];
}>;

// AI Shot Title Generation operation
type GenerateShotTitlesAI = (args: { 
  sceneId: string;
  sceneDescription: string;
  userPrompt?: string;
}, context: any) => Promise<{ 
  shots: Array<{ title: string; sequence: number }>;
}>;

// AI Shot Detail Generation operation
type GenerateShotDetailsAI = (args: { 
  sceneId: string;
  shotSequence: number;
  shotTitle: string;  // We need the title since the shot doesn't exist in DB yet
  allShotTitles: Array<{title: string, sequence: number}>; // Pass from frontend
  userPrompt?: string;
}, context: any) => Promise<{ 
  title: string; 
  description: string; 
}>;

export const generateSceneDetailsAI: GenerateSceneDetailsAI = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  if (!context.entities) {
    throw new HttpError(500, 'Database entities not available');
  }

  // Verify user owns the story
  const story = await context.entities.Story.findFirst({
    where: { id: args.storyId },
    include: { project: true }
  });

  if (!story || story.project.userId !== context.user.id) {
    throw new HttpError(404, 'Story not found');
  }

  // Get story content (script or description)
  const storyContent = story.script || story.description;
  if (!storyContent || storyContent.trim().length === 0) {
    throw new HttpError(400, 'Story must have script or description to generate scene details');
  }

  // Get story characters from database (only characters assigned to this story)
  const storyCharacters = await context.entities.StoryCharacter.findMany({
    where: { storyId: args.storyId },
    include: { character: true }
  });
  const characterNames = storyCharacters.map((sc: any) => sc.character.name);

  // Get target scene info
  const targetScene = args.allSceneInfo[args.targetSceneIndex];
  if (!targetScene) {
    throw new HttpError(400, 'Target scene not found in allSceneInfo');
  }

  try {
    // Get AI service instance
    const aiService = AiService.getInstance();
    
    // Get AI settings from project for text generation
    const textSettings = getProjectAiSettings(story.project, 'text');

    // Generate scene details with structured output
    const result = await aiService.generateSceneDetails(
      targetScene.title,
      storyContent.trim(),
      textSettings, // Pass full AI settings
      args.userPrompt,
      characterNames,
      args.allSceneInfo
    );

    return result;
  } catch (error) {
    console.error('Error in generateSceneDetailsAI:', error);
    
    if (error instanceof HttpError) {
      throw error;
    }
    
    // Handle specific AI service errors with appropriate HTTP status codes
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        throw new HttpError(400, error.message);
      }
      
      if (error.message.includes('server is not running') || error.message.includes('not accessible')) {
        throw new HttpError(503, error.message);
      }
    }
    
    throw new HttpError(500, `Failed to generate scene details: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const generateShotTitlesAI: GenerateShotTitlesAI = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  // Verify user owns the scene
  const scene = await context.entities.Scene.findFirst({
    where: { id: args.sceneId },
    include: {
      story: {
        include: { project: true }
      }
    }
  });

  if (!scene || scene.story.project.userId !== context.user.id) {
    throw new HttpError(404, 'Scene not found');
  }

  try {
    // Get AI service instance
    const aiService = AiService.getInstance();
    
    // Build context for AI generation
    const sceneContext = `Scene: ${scene.title}\nDescription: ${scene.description || 'No description available'}`;
    const storyContext = scene.story.script || scene.story.description || '';
    const fullSceneContent = `${sceneContext}\n\nStory Context: ${storyContext}`;
    
    // Get AI settings from project for text generation
    const textSettings = getProjectAiSettings(scene.story.project, 'text');
    
    // Generate shot titles with structured output
    const result = await aiService.generateShotTitles(
      fullSceneContent.trim(), 
      textSettings,
      args.userPrompt
    );

    return result;
  } catch (error) {
    console.error('Error in generateShotTitlesAI:', error);
    
    if (error instanceof HttpError) {
      throw error;
    }
    
    if (error instanceof Error) {
      if (error.message.includes('server is not running') || error.message.includes('not accessible')) {
        throw new HttpError(503, error.message);
      }
    }
    
    throw new HttpError(500, `Failed to generate shot titles: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const generateShotDetailsAI: GenerateShotDetailsAI = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  // Verify user owns the scene (no need to fetch shots since they don't exist in DB yet)
  const scene = await context.entities.Scene.findFirst({
    where: { id: args.sceneId },
    include: {
      story: {
        include: { project: true }
      }
    }
  });

  if (!scene || scene.story.project.userId !== context.user.id) {
    throw new HttpError(404, 'Scene not found');
  }

  // Validate that the shot sequence exists in the provided allShotTitles
  const currentShot = args.allShotTitles.find(shot => shot.sequence === args.shotSequence);
  if (!currentShot) {
    throw new HttpError(400, `Shot with sequence ${args.shotSequence} not found in provided shot titles`);
  }

  // Validate that the provided shotTitle matches the sequence
  if (currentShot.title !== args.shotTitle) {
    throw new HttpError(400, `Shot title mismatch: expected "${currentShot.title}", got "${args.shotTitle}"`);
  }

  try {
    // Get AI service instance
    const aiService = AiService.getInstance();
    
    // Build context for AI generation
    const sceneContext = `Scene: ${scene.title}\nDescription: ${scene.description || 'No description available'}`;
    const storyContext = scene.story.script || scene.story.description || '';
    const fullSceneContent = `${sceneContext}\n\nStory Context: ${storyContext}`;
    
    // Get AI settings from project for text generation
    const textSettings = getProjectAiSettings(scene.story.project, 'text');

    // Generate shot details with structured output and enhanced context
    const result = await aiService.generateShotDetails(
      fullSceneContent.trim(),
      args.allShotTitles,
      args.shotSequence,
      textSettings, // Pass full AI settings
      args.userPrompt
    );

    return result;
  } catch (error) {
    console.error('Error in generateShotDetailsAI:', error);
    
    if (error instanceof HttpError) {
      throw error;
    }
    
    if (error instanceof Error) {
      if (error.message.includes('server is not running') || error.message.includes('not accessible')) {
        throw new HttpError(503, error.message);
      }
    }
    
    throw new HttpError(500, `Failed to generate shot details: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};



// Generic image generation function
type ImageGenerationConfig = {
  assetType: 'scene_overview_image' | 'shot_thumbnail' | 'character_image';
  entityName: string;
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  quality?: 'LOW' | 'MEDIUM' | 'HIGH';
  guidance_scale?: number;
  inputFileUuids?: string[];
};

const generateImageAsync = async (
  config: ImageGenerationConfig & { projectId: string },
  context: any
): Promise<{ fileUuid: string; status: string }> => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  // Validate required parameters
  if (!config.prompt || config.prompt.trim().length === 0) {
    throw new Error('Must have a prompt to generate an image');
  }

  // Fetch project to get AI settings
  const project = await context.entities.Project.findFirst({
    where: { 
      id: config.projectId,
      userId: context.user.id 
    }
  });

  if (!project) {
    throw new HttpError(404, 'Project not found');
  }

  // Get AI settings for image generation
  const imageSettings = getProjectAiSettings(project, 'image');

  // Convert input file UUIDs to file paths if provided
  const inputImageFilepaths = config.inputFileUuids 
    ? await convertUuidsToFilePaths(config.inputFileUuids, context)
    : undefined;

  // Generate UUID for the file
  const fileUuid = crypto.randomUUID();
  
  try {
    // Create file record with pending status
    const file = await context.entities.File.create({
      data: {
        uuid: fileUuid,
        fileName: config.entityName,
        fileType: 'image/png',
        fileUrl: '', // Will be updated when generation completes
        taskType: config.assetType,
        taskInput: {
          prompt: config.prompt,
          negativePrompt: config.negativePrompt,
          width: config.width,
          height: config.height,
          quality: config.quality,
          guidance_scale: config.guidance_scale,
          inputFileUuids: config.inputFileUuids
        },
        modelConfig: imageSettings, // Use project's image AI settings
        status: 'pending',
        userId: context.user.id,
      }
    });

    console.log(`🎬 Queuing AI file generation job for fileUuid: ${fileUuid}`);

    // Submit job to pgBoss queue
    const jobResult = await aiFileGenerationJob.submit(
      { fileUuid },
      {
        // Job options
        retryLimit: 0,
        retryDelay: 30, // 30 seconds
        expireInMinutes: 30, // Job expires in 30 minutes
      }
    );
    const jobId = (jobResult as any).id || 'unknown';

    // Update file record with job ID
    await context.entities.File.update({
      where: { uuid: fileUuid },
      data: {
        pgBossJobId: jobId,
        status: 'queued',
      }
    });

    console.log(`✅ Job queued successfully - JobId: ${jobId}, FileUuid: ${fileUuid}`);

    return {
      fileUuid,
      status: 'queued'
    };

  } catch (error) {
    console.error('Error queuing image generation job:', error);
    
    // Update file record with failure if it was created
    try {
      await context.entities.File.update({
        where: { uuid: fileUuid },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        }
      });
    } catch (updateError) {
      console.error('Failed to update file record with error:', updateError);
    }

    throw new HttpError(500, `Failed to queue image generation: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Generate an overview image for a scene
 * @param args.sceneId - The ID of the scene
 * @param args.prompt - Optional custom prompt (uses scene description/title if not provided)
 * @param args.negativePrompt - Optional negative prompt
 * @param args.parameters - Optional custom parameters (width, height, steps, guidance_scale)
 * @param context - Wasp context
 * @returns Promise with fileUuid and status
 */
export const generateSceneOverviewImage = async (args: { sceneId: string; prompt?: string; negativePrompt?: string; parameters?: any }, context: any): Promise<{ fileUuid: string; status: string }> => {
  // Verify scene exists and user owns it
  const scene = await context.entities.Scene.findFirst({
    where: { 
      id: args.sceneId,
      story: {
        project: {
          userId: context.user.id
        }
      }
    },
    include: {
      story: {
        include: {
          project: true
        }
      }
    }
  });

  if (!scene) {
    throw new HttpError(404, 'Scene not found');
  }

  // Use scene description directly as the prompt, or fallback to title if no description
  // Scene images are "blind" — environment only, no characters
  const imagePrompt = args.prompt || scene.description || scene.title;
  
  const result = await generateImageAsync({
    assetType: 'scene_overview_image',
    entityName: scene.title,
    prompt: imagePrompt,
    negativePrompt: args.negativePrompt,
    width: args.parameters?.width,
    height: args.parameters?.height,
    quality: args.parameters?.quality,
    guidance_scale: args.parameters?.guidance_scale,
    inputFileUuids: args.parameters?.inputFileUuids || [],
    projectId: scene.story.project.id // Pass project ID for AI settings
  }, context);

  // Update the scene's overviewImageUuid immediately with the file UUID
  // The actual image will be available once the job completes
  await context.entities.Scene.update({
    where: { id: args.sceneId },
    data: { overviewImageUuid: result.fileUuid }
  });

  // Return only client-relevant information (no jobId)
  return {
    fileUuid: result.fileUuid,
    status: result.status
  };
};

/**
 * Generate a thumbnail image for a shot
 * @param args.shotId - The ID of the shot
 * @param args.prompt - Optional custom prompt (builds context-rich prompt if not provided)
 * @param args.negativePrompt - Optional negative prompt
 * @param args.parameters - Optional custom parameters (width, height, steps, guidance_scale)
 * @param context - Wasp context
 * @returns Promise with fileUuid and status
 */
export const generateShotThumbnail = async (args: { shotId: string; aspectRatioId?: string; prompt?: string; negativePrompt?: string; parameters?: any }, context: any): Promise<{ fileUuid: string; status: string }> => {
  // Verify shot exists and user owns it
  const shot = await context.entities.Shot.findFirst({
    where: { 
      id: args.shotId,
      scene: {
        story: {
          project: {
            userId: context.user.id
          }
        }
      }
    },
    include: {
      scene: {
        include: {
          story: {
            include: {
              project: true,
              storyCharacters: true
            }
          },
          sceneCharacters: {
            include: {
              character: true
            }
          }
        }
      }
    }
  });

  if (!shot) {
    throw new HttpError(404, 'Shot not found');
  }

  // Build comprehensive prompt for shot thumbnail
  let imagePrompt = args.prompt;
  if (!imagePrompt) {
    // Build context-rich prompt for the shot
    const sceneContext = `Scene: ${shot.scene.title}${shot.scene.description ? ` - ${shot.scene.description}` : ''}`;
    const shotContext = `Shot: ${shot.title}${shot.description ? ` - ${shot.description}` : ''}`;
    imagePrompt = `${sceneContext}. ${shotContext}`;
  }
  
  // Extract scene file UUID
  const sceneFileUuid = shot.scene.finalImageUuid;
  
  // Build a lookup of story character custom images by characterId
  const storyCharacterImageMap = new Map<string, string>();
  for (const sc of (shot.scene.story as any).storyCharacters || []) {
    if (sc.customImageUuid) {
      storyCharacterImageMap.set(sc.characterId, sc.customImageUuid);
    }
  }

  // Extract character image UUIDs from scene characters
  // Prefer story character custom image, fall back to base character image
  const characterImageUuids = shot.scene.sceneCharacters
    ?.map((sc: any) => {
      // Check for story-specific custom image first
      const customImage = storyCharacterImageMap.get(sc.characterId);
      if (customImage) return customImage;
      // Fall back to base character image
      return sc.character.finalImageUuid;
    })
    .filter((uuid: any) => uuid && uuid.trim().length > 0) || [];
  
  // Combine user-provided inputFileUuids with scene file and character image UUIDs
  const allInputFileUuids = [
    ...(args.parameters?.inputFileUuids || []),
    ...(sceneFileUuid ? [sceneFileUuid] : []),
    ...characterImageUuids
  ];
  
  // If an aspect ratio ID is provided, fetch it for width/height
  let arWidth = args.parameters?.width;
  let arHeight = args.parameters?.height;
  let aspectRatioId = args.aspectRatioId;

  if (aspectRatioId) {
    const ar = await context.entities.AspectRatio.findFirst({
      where: { id: aspectRatioId, userId: context.user.id }
    });
    if (ar) {
      // Scale aspect ratio to reasonable image dimensions
      // Base dimension is 512; scale proportionally
      const maxDim = 1024;
      const ratio = ar.width / ar.height;
      if (ratio >= 1) {
        arWidth = maxDim;
        arHeight = Math.round(maxDim / ratio);
      } else {
        arHeight = maxDim;
        arWidth = Math.round(maxDim * ratio);
      }
    }
  }

  const result = await generateImageAsync({
    assetType: 'shot_thumbnail',
    entityName: `${shot.title} - Thumbnail`,
    prompt: imagePrompt,
    negativePrompt: args.negativePrompt,
    width: arWidth,
    height: arHeight,
    quality: args.parameters?.quality,
    guidance_scale: args.parameters?.guidance_scale,
    inputFileUuids: allInputFileUuids,
    projectId: shot.scene.story.project.id // Pass project ID for AI settings
  }, context);

  // If aspect ratio is provided, create/update ShotImage record
  if (aspectRatioId) {
    await context.entities.ShotImage.upsert({
      where: {
        shotId_aspectRatioId: {
          shotId: args.shotId,
          aspectRatioId: aspectRatioId,
        }
      },
      update: { imageUuid: result.fileUuid },
      create: {
        shotId: args.shotId,
        aspectRatioId: aspectRatioId,
        imageUuid: result.fileUuid,
      }
    });
  }

  // Also update the shot's thumbnailUuid as fallback
  await context.entities.Shot.update({
    where: { id: args.shotId },
    data: { thumbnailUuid: result.fileUuid }
  });

  // Return only client-relevant information (no jobId)
  return {
    fileUuid: result.fileUuid,
    status: result.status
  };
};

/**
 * Generate a character image using AI
 * @param args.characterId - The ID of the character
 * @param args.prompt - Optional custom prompt (uses character name + description if not provided)
 * @param args.negativePrompt - Optional negative prompt
 * @param args.parameters - Optional custom parameters (width, height, steps, guidance_scale)
 * @param context - Wasp context
 * @returns Promise with fileUuid and status
 */
export const generateCharacterImage = async (args: { characterId: string; prompt?: string; negativePrompt?: string; parameters?: any }, context: any): Promise<{ fileUuid: string; status: string }> => {
  // Verify character exists and user owns it
  const character = await context.entities.Character.findFirst({
    where: { 
      id: args.characterId,
      project: {
        userId: context.user.id
      }
    },
    include: {
      project: true
    }
  });

  if (!character) {
    throw new HttpError(404, 'Character not found');
  }

  const imagePrompt = character.description ? character.description : character.name;
  
  const result = await generateImageAsync({
    assetType: 'character_image',
    entityName: character.name,
    prompt: imagePrompt,
    negativePrompt: args.negativePrompt,
    width: args.parameters?.width,
    height: args.parameters?.height,
    quality: args.parameters?.quality,
    guidance_scale: args.parameters?.guidance_scale,
    inputFileUuids: args.parameters?.inputFileUuids,
    projectId: character.project.id // Pass project ID for AI settings
  }, context);

  // Update the character's finalImageUuid immediately with the file UUID
  // The actual image will be available once the job completes
  await context.entities.Character.update({
    where: { id: args.characterId },
    data: { finalImageUuid: result.fileUuid }
  });

  // Return only client-relevant information (no jobId)
  return {
    fileUuid: result.fileUuid,
    status: result.status
  };
};

/**
 * Generate a story-specific character image using only the base character image and customDescription.
 * Does not use project character description; the base image + custom description are sufficient.
 */
export const generateStoryCharacterImage = async (
  args: { storyCharacterId: string; negativePrompt?: string; parameters?: any },
  context: any
): Promise<{ fileUuid: string; status: string }> => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  const storyCharacter = await context.entities.StoryCharacter.findFirst({
    where: { id: args.storyCharacterId },
    include: {
      character: { include: { project: true } },
      story: { include: { project: true } }
    }
  });

  if (!storyCharacter || storyCharacter.story.project.userId !== context.user.id) {
    throw new HttpError(404, 'Story character not found');
  }

  const character = storyCharacter.character;
  const customDescription = storyCharacter.customDescription?.trim();

  if (!customDescription) {
    throw new HttpError(400, 'Story character custom description is required to generate a story image. Add a customisation first.');
  }

  // Prompt: custom description only. Base image is the visual reference.
  const imagePrompt = customDescription;

  // Use base character image as input reference if available
  const inputFileUuids: string[] = [
    ...(args.parameters?.inputFileUuids || []),
  ];
  if (character.finalImageUuid) {
    inputFileUuids.push(character.finalImageUuid);
  }

  const result = await generateImageAsync({
    assetType: 'character_image',
    entityName: `${character.name} (story variant)`,
    prompt: imagePrompt,
    negativePrompt: args.negativePrompt,
    width: args.parameters?.width,
    height: args.parameters?.height,
    quality: args.parameters?.quality,
    guidance_scale: args.parameters?.guidance_scale,
    inputFileUuids,
    projectId: storyCharacter.story.project.id
  }, context);

  // Update the StoryCharacter's customImageUuid
  await context.entities.StoryCharacter.update({
    where: { id: args.storyCharacterId },
    data: { customImageUuid: result.fileUuid }
  });

  return {
    fileUuid: result.fileUuid,
    status: result.status
  };
};

// File operations for MediaDisplay
export const getFileByUuid: GetFileByUuid<{ uuid: string }, File | null> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }
  
  const { uuid } = args;
  
  // First find the file by uuid, then check if user owns it
  const file = await context.entities.File.findFirst({
    where: {
      uuid: uuid,
      userId: context.user.id,
    },
  });
  

  return file;
};

// Get file generation status
export const getFileGenerationStatus = async (args: { fileUuid: string }, context: any): Promise<{ 
  status: string; 
  progress?: number; 
  errorMessage?: string; 
  fileUrl?: string;
}> => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  const file = await context.entities.File.findFirst({
    where: {
      uuid: args.fileUuid,
      userId: context.user.id,
    },
  });

  if (!file) {
    throw new HttpError(404, 'File not found');
  }

  return {
    status: file.status || 'unknown',
    progress: file.progress,
    errorMessage: file.errorMessage,
    fileUrl: file.fileUrl
  };
};

// Get dynamic AI models from AiService
export const getDynamicAiModels: GetDynamicAiModels<void, any> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  try {
    const aiService = AiService.getInstance();
    const dynamicModels = aiService.getDynamicModelsStatus();
    
    if (!dynamicModels.isPopulated) {
      // If models aren't populated yet, trigger population
      await aiService.refreshDynamicModels();
    }
    
    // Get the actual models data
    const aiServiceInstance = AiService.getInstance();
    const models = (aiServiceInstance as any).dynamicAiModels;
    
    return models;
  } catch (error) {
    console.error('Failed to get dynamic AI models:', error);
    throw new HttpError(500, 'Failed to retrieve AI models');
  }
};

// App Settings Operations
export const getAppSettings: GetAppSettings<{ key: string }, any> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  try {
    const { key } = args;
    console.log('🔄 Server: Getting setting for key:', key);
    
    const setting = await context.entities.AppSetting.findUnique({
      where: { key }
    });
    
    if (!setting) {
      return null;
    }
    
    return setting.value;
  } catch (error) {
    console.error('❌ Server: Failed to get app setting:', error);
    throw new HttpError(500, 'Failed to retrieve app setting');
  }
};

export const updateAppSettings: UpdateAppSettings<{ key: string; value: any }, any> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  try {
    const { key, value } = args;
    console.log('🔄 Server: Updating setting:', { key, value });
    
    // Upsert the setting (create if doesn't exist, update if it does)
    await context.entities.AppSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });
    
    console.log('✅ Server: App setting updated successfully');
    
    return { 
      success: true, 
      message: 'Setting updated successfully'
    };
  } catch (error) {
    console.error('❌ Server: Failed to update app setting:', error);
    throw new HttpError(500, 'Failed to update app setting');
  }
};

// ==========================================
// Aspect Ratio Operations
// ==========================================

export const getAspectRatios: GetAspectRatios<void, AspectRatio[]> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  const ratios = await context.entities.AspectRatio.findMany({
    where: { userId: context.user.id },
    orderBy: { createdAt: 'asc' }
  });

  // If no aspect ratios exist, create defaults
  if (ratios.length === 0) {
    const vertical = await context.entities.AspectRatio.create({
      data: {
        name: 'Vertical',
        width: 9,
        height: 16,
        isDefault: true,
        userId: context.user.id,
      }
    });
    const landscape = await context.entities.AspectRatio.create({
      data: {
        name: 'Landscape',
        width: 16,
        height: 9,
        isDefault: false,
        userId: context.user.id,
      }
    });
    return [vertical, landscape];
  }

  return ratios;
};

export const createAspectRatio: CreateAspectRatio<{ name: string; width: number; height: number; isDefault?: boolean }, AspectRatio> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  if (!args.name || args.name.trim().length === 0) {
    throw new HttpError(400, 'Aspect ratio name is required');
  }

  if (args.width <= 0 || args.height <= 0) {
    throw new HttpError(400, 'Width and height must be positive numbers');
  }

  // Check for duplicate
  const existing = await context.entities.AspectRatio.findFirst({
    where: { userId: context.user.id, width: args.width, height: args.height }
  });
  if (existing) {
    throw new HttpError(400, `Aspect ratio ${args.width}:${args.height} already exists`);
  }

  // If setting as default, unset current default
  if (args.isDefault) {
    await context.entities.AspectRatio.updateMany({
      where: { userId: context.user.id, isDefault: true },
      data: { isDefault: false }
    });
  }

  return context.entities.AspectRatio.create({
    data: {
      name: args.name.trim(),
      width: args.width,
      height: args.height,
      isDefault: args.isDefault || false,
      userId: context.user.id,
    }
  });
};

export const updateAspectRatio: UpdateAspectRatio<{ id: string; name?: string; width?: number; height?: number; isDefault?: boolean }, AspectRatio> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  const ar = await context.entities.AspectRatio.findFirst({
    where: { id: args.id, userId: context.user.id }
  });

  if (!ar) {
    throw new HttpError(404, 'Aspect ratio not found');
  }

  // If setting as default, unset current default
  if (args.isDefault) {
    await context.entities.AspectRatio.updateMany({
      where: { userId: context.user.id, isDefault: true },
      data: { isDefault: false }
    });
  }

  return context.entities.AspectRatio.update({
    where: { id: args.id },
    data: {
      name: args.name?.trim() || ar.name,
      width: args.width || ar.width,
      height: args.height || ar.height,
      isDefault: args.isDefault !== undefined ? args.isDefault : ar.isDefault,
    }
  });
};

export const deleteAspectRatio: DeleteAspectRatio<{ id: string }, AspectRatio> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  const ar = await context.entities.AspectRatio.findFirst({
    where: { id: args.id, userId: context.user.id }
  });

  if (!ar) {
    throw new HttpError(404, 'Aspect ratio not found');
  }

  // Delete associated shot images first
  await context.entities.ShotImage.deleteMany({
    where: { aspectRatioId: args.id }
  });

  return context.entities.AspectRatio.delete({
    where: { id: args.id }
  });
};

export const updateStoryAspectRatio: UpdateStoryAspectRatio<{ storyId: string; aspectRatioId: string | null }, Story> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  const story = await context.entities.Story.findFirst({
    where: { id: args.storyId },
    include: { project: true }
  });

  if (!story || story.project.userId !== context.user.id) {
    throw new HttpError(404, 'Story not found');
  }

  // Verify aspect ratio belongs to user if not null
  if (args.aspectRatioId) {
    const ar = await context.entities.AspectRatio.findFirst({
      where: { id: args.aspectRatioId, userId: context.user.id }
    });
    if (!ar) {
      throw new HttpError(404, 'Aspect ratio not found');
    }
  }

  return context.entities.Story.update({
    where: { id: args.storyId },
    data: { aspectRatioId: args.aspectRatioId }
  });
};

// ==========================================
// TSV Import Operation
// ==========================================

type TsvCharacterInput = {
  tsvId: string;
  name: string;
  context: string;        // Short label from Context column
  description: string;    // Full description from Image Prompt column
  isExisting?: boolean;
  existingCharacterId?: string;
  [key: string]: any;
}

type TsvShotInput = {
  tsvId: string;
  shotNumber: string;
  name: string;
  characterNames: string[];
  description: string;       // Image prompt from Image Prompt column
  motionDescription: string; // Motion description from Motion Prompt column
  [key: string]: any;
}

type TsvSceneInput = {
  tsvId: string;
  sceneNumber: number;
  name: string;
  context: string;
  description: string;    // Blind scene description from Image Prompt column
  shots: TsvShotInput[];
  [key: string]: any;
}

type ImportTsvDataArgs = {
  projectId: string;
  storyTitle: string;
  storyDescription?: string;
  characters: TsvCharacterInput[];
  scenes: TsvSceneInput[];
  [key: string]: any;
}

type ImportTsvDataResult = {
  storyId: string;
  charactersCreated: number;
  charactersReused: number;
  scenesCreated: number;
  shotsCreated: number;
}

export const importTsvData: ImportTsvData<ImportTsvDataArgs, ImportTsvDataResult> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }

  // Verify project ownership
  const project = await context.entities.Project.findFirst({
    where: { id: args.projectId, userId: context.user.id }
  });

  if (!project) {
    throw new HttpError(404, 'Project not found');
  }

  let charactersCreated = 0;
  let charactersReused = 0;
  let scenesCreated = 0;
  let shotsCreated = 0;

  // Map from TSV character name to DB character id
  const characterNameToId = new Map<string, string>();

  // Get existing characters for the project
  const existingCharacters = await context.entities.Character.findMany({
    where: { projectId: args.projectId },
    orderBy: { serial: 'desc' }
  });
  let nextSerial = (existingCharacters.length > 0 ? existingCharacters[0].serial : 0) + 1;

  // Populate map with existing characters
  for (const ec of existingCharacters) {
    characterNameToId.set(ec.name.toLowerCase(), ec.id);
  }

  // Step 1: Create or reuse characters
  for (const charInput of args.characters) {
    if (charInput.isExisting && charInput.existingCharacterId) {
      // Reuse existing character
      characterNameToId.set(charInput.name.toLowerCase(), charInput.existingCharacterId);
      charactersReused++;
    } else {
      // Create new character
      const newChar = await context.entities.Character.create({
        data: {
          name: charInput.name,
          description: charInput.description || null,
          serial: nextSerial++,
          projectId: args.projectId,
        }
      });
      characterNameToId.set(charInput.name.toLowerCase(), newChar.id);
      charactersCreated++;
    }
  }

  // Step 2: Create story
  const existingStories = await context.entities.Story.findMany({
    where: { projectId: args.projectId },
    orderBy: { serial: 'desc' }
  });
  const nextStorySerial = (existingStories.length > 0 ? existingStories[0].serial : 0) + 1;

  const story = await context.entities.Story.create({
    data: {
      title: args.storyTitle,
      description: args.storyDescription || null,
      serial: nextStorySerial,
      projectId: args.projectId,
    }
  });

  // Step 3: Add all characters to story (as StoryCharacter)
  for (const charInput of args.characters) {
    const charId = characterNameToId.get(charInput.name.toLowerCase());
    if (charId) {
      await context.entities.StoryCharacter.create({
        data: {
          storyId: story.id,
          characterId: charId,
          customDescription: charInput.description || null,
        }
      });
    }
  }

  // Step 4: Create scenes and shots
  for (const sceneInput of args.scenes) {
    const scene = await context.entities.Scene.create({
      data: {
        title: sceneInput.name,
        description: sceneInput.description || null, // Scene blind description
        summary: sceneInput.context || null,
        serial: sceneInput.sceneNumber,
        storyId: story.id,
      }
    });
    scenesCreated++;

    // Create shots for this scene
    for (let i = 0; i < sceneInput.shots.length; i++) {
      const shotInput = sceneInput.shots[i];

      const shot = await context.entities.Shot.create({
        data: {
          title: shotInput.name,
          description: shotInput.description || null,
          motionDescription: shotInput.motionDescription || null,
          sequence: i + 1,
          sceneId: scene.id,
        }
      });
      shotsCreated++;

      // Add characters referenced in this shot to the scene and to the shot (ShotCharacter)
      for (const charName of shotInput.characterNames) {
        // Try exact match first, then fuzzy
        let charId = characterNameToId.get(charName.toLowerCase());
        if (!charId) {
          // Fuzzy match: try finding by partial name
          for (const [key, id] of characterNameToId.entries()) {
            if (key.includes(charName.toLowerCase()) || charName.toLowerCase().includes(key.replace(/^the\s+/, ''))) {
              charId = id;
              break;
            }
          }
        }

        if (charId) {
          // Add character to scene if not already added
          const existingSceneChar = await context.entities.SceneCharacter.findFirst({
            where: { sceneId: scene.id, characterId: charId }
          });
          if (!existingSceneChar) {
            await context.entities.SceneCharacter.create({
              data: {
                sceneId: scene.id,
                characterId: charId,
              }
            });
          }
          // Associate this character with the shot (for shot-specific image prompt copy)
          await (context.entities as any).ShotCharacter.create({
            data: {
              shotId: shot.id,
              characterId: charId,
            }
          });
        }
      }
    }
  }

  return {
    storyId: story.id,
    charactersCreated,
    charactersReused,
    scenesCreated,
    shotsCreated,
  };
};