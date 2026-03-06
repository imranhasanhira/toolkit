// AI Settings type definition
export interface AiSettings {
  tool: string;
  model: string;
  version?: string;
}

// Project AI Settings - collection of AI settings for each category
export interface ProjectAiSettings {
  text: AiSettings;
  image: AiSettings;
  video: AiSettings;
}

// AI Output types
export interface SceneTitlesOutput {
  scenes: Array<{ title: string; serial: number; summary: string }>;
}

export interface SceneInfo {
  title: string;
  description: string;
  summary?: string;
}

export interface SceneDetailsOutput {
  title: string;
  description: string;
  characters: string[];
}

export interface ShotTitlesOutput {
  shots: Array<{ title: string; sequence: number }>;
}

export interface ShotDetailsOutput {
  title: string;
  description: string;
}

// AI Response types
export interface EnhanceScriptResponse {
  originalScript: string;
  enhancedScript: string;
  modelUsed: string;
  promptUsed: string;
  timestamp: string;
  storyCharacters?: string[];
}

export interface EnhanceCharacterDescriptionResponse {
  originalDescription: string;
  enhancedDescription: string;
  modelUsed: string;
  promptUsed: string;
  timestamp: string;
}

export interface ImageGenerationResponse {
  imageBase64: string;
}

// Common attributes for image generation
interface ImageGenerationCommon {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  quality?: 'LOW' | 'MEDIUM' | 'HIGH';
  guidance_scale?: number;
}

// File task input structure for image generation - flat structure
export interface FileTaskInput extends ImageGenerationCommon {
  inputFileUuids?: string[]; // List of input file UUIDs
}

export interface ImageGenerationOptions extends ImageGenerationCommon {
  inputImageFilepaths?: string[]; // Array of file paths to input images
}
