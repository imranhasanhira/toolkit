import { AiSettings, SceneTitlesOutput, SceneDetailsOutput, ShotTitlesOutput, ShotDetailsOutput, SceneInfo, ImageGenerationOptions, ImageGenerationResponse } from '../types';
import { AiModelRegistry } from '../AiService';

// AI Engine interface that all engines must implement
export interface AiEngine {
  // Text operations
  enhanceScript(aiSettings: AiSettings, prompt: string, script: string, storyCharacters?: string[]): Promise<string>;
  enhanceCharacterDescription(aiSettings: AiSettings, prompt: string, characterDescription: string): Promise<string>;
  generateSceneTitles(storyDescription: string, aiSettings: AiSettings, userPrompt?: string): Promise<SceneTitlesOutput>;
  generateSceneDetails(sceneTitle: string, storyContext: string, aiSettings: AiSettings, userPrompt?: string, storyCharacters?: string[], allSceneInfo?: SceneInfo[]): Promise<SceneDetailsOutput>;
  generateShotTitles(sceneDescription: string, aiSettings: AiSettings, userPrompt?: string): Promise<ShotTitlesOutput>;
  generateShotDetails(sceneContext: string, shotTitle: string, allShotTitles: Array<{title: string, sequence: number}>, currentShotSequence: number, aiSettings: AiSettings, userPrompt?: string): Promise<ShotDetailsOutput>;
  
  // Image operations
  generateImage(aiSettings: AiSettings, options: ImageGenerationOptions): Promise<ImageGenerationResponse>;
  
  // Utility operations
  checkServerAvailability(): Promise<{ available: boolean; message: string }>;
  getAvailableModels(): Promise<AiModelRegistry>;
}

// Base class that provides default "not supported" implementations
export abstract class BaseAiEngine implements AiEngine {
  // Text operations - default implementations throw "not supported"
  async enhanceScript(aiSettings: AiSettings, prompt: string, script: string, storyCharacters?: string[]): Promise<string> {
    throw new Error(`Operation 'enhanceScript' not supported by this engine`);
  }
  
  async enhanceCharacterDescription(aiSettings: AiSettings, prompt: string, characterDescription: string): Promise<string> {
    throw new Error(`Operation 'enhanceCharacterDescription' not supported by this engine`);
  }
  
  async generateSceneTitles(storyDescription: string, aiSettings: AiSettings, userPrompt?: string): Promise<SceneTitlesOutput> {
    throw new Error(`Operation 'generateSceneTitles' not supported by this engine`);
  }
  
  async generateSceneDetails(sceneTitle: string, storyContext: string, aiSettings: AiSettings, userPrompt?: string, storyCharacters?: string[], allSceneInfo?: SceneInfo[]): Promise<SceneDetailsOutput> {
    throw new Error(`Operation 'generateSceneDetails' not supported by this engine`);
  }
  
  async generateShotTitles(sceneDescription: string, aiSettings: AiSettings, userPrompt?: string): Promise<ShotTitlesOutput> {
    throw new Error(`Operation 'generateShotTitles' not supported by this engine`);
  }
  
  async generateShotDetails(sceneContext: string, shotTitle: string, allShotTitles: Array<{title: string, sequence: number}>, currentShotSequence: number, aiSettings: AiSettings, userPrompt?: string): Promise<ShotDetailsOutput> {
    throw new Error(`Operation 'generateShotDetails' not supported by this engine`);
  }
  
  // Image operations - default implementation throws "not supported"
  async generateImage(aiSettings: AiSettings, options: ImageGenerationOptions): Promise<ImageGenerationResponse> {
    throw new Error(`Operation 'generateImage' not supported by this engine`);
  }
  
  // Utility operations - default implementations throw "not supported"
  async checkServerAvailability(): Promise<{ available: boolean; message: string }> {
    throw new Error(`Operation 'checkServerAvailability' not supported by this engine`);
  }
  
  async getAvailableModels(): Promise<AiModelRegistry> {
    throw new Error(`Operation 'getAvailableModels' not supported by this engine`);
  }
}
