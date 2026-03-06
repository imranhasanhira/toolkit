import { ChatOllama } from '@langchain/ollama';
import { HumanMessage } from '@langchain/core/messages';
import { PromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { BaseAiEngine } from './BaseAiEngine';
import { AiSettings, SceneTitlesOutput, SceneDetailsOutput, ShotTitlesOutput, ShotDetailsOutput, SceneInfo, ImageGenerationOptions, ImageGenerationResponse } from '../types';
import { AiModelRegistry } from '../AiService';
import { OllamaSettings } from '../../../sokafilm/types/appSettings';
import { z } from 'zod';
import { AI_TOOLS } from '../constants';

// Custom JsonOutputParser that strips out <think>...</think> blocks
class CleanJsonOutputParser extends JsonOutputParser {
  async parse(text: string): Promise<any> {
    // Remove <think>...</think> blocks
    const cleanedText = text.replace(/<think>.*?<\/think>/gs, '').trim();
    
    // Try to extract JSON if there's extra text
    const jsonMatch = cleanedText.match(/\{.*\}/s);
    if (jsonMatch) {
      return super.parse(jsonMatch[0]);
    }
    
    // If no JSON found, try to parse the cleaned text directly
    return super.parse(cleanedText);
  }
}

// Zod schemas for structured output
const SceneTitlesSchema = z.object({
  scenes: z.array(z.object({
    title: z.string(),
    serial: z.number(),
    summary: z.string()
  }))
});

const SceneDetailsSchema = z.object({
  title: z.string(),
  description: z.string(),
  characters: z.array(z.string())
});

const ShotTitlesSchema = z.object({
  shots: z.array(z.object({
    title: z.string(),
    sequence: z.number()
  }))
});

const ShotDetailsSchema = z.object({
  title: z.string(),
  description: z.string()
});

// Schema for enhanced script (JSON response)
const EnhanceScriptSchema = z.object({
  enhancedScript: z.string().min(1, "Enhanced script cannot be empty")
});

// Schema for enhanced character description (JSON response)
const EnhanceCharacterDescriptionSchema = z.object({
  enhancedDescription: z.string().min(1, "Enhanced character description cannot be empty")
});

export class OllamaEngine extends BaseAiEngine {
  private baseUrl: string;
  private defaultModel: string;
  private modelInstances: Map<string, ChatOllama> = new Map();

  constructor(settings: OllamaSettings) {
    super();
    this.baseUrl = settings.baseUrl;
    this.defaultModel = settings.defaultModel;
  }



  private createOllamaModel(aiSettings: AiSettings): ChatOllama {
    const modelName = aiSettings.model;
    if (!this.modelInstances.has(modelName)) {
      this.modelInstances.set(modelName, new ChatOllama({
        baseUrl: this.baseUrl,
        model: modelName,
        temperature: 0.7,
      }));
    }
    return this.modelInstances.get(modelName)!;
  }

  private handleOllamaError(error: unknown, operation: string, modelName: string): never {
    console.error(`Error in OllamaEngine.${operation}:`, error);
      
      // Handle specific Ollama errors
      if (error && typeof error === 'object' && 'error' in error) {
        const ollamaError = error as { error: string; status_code?: number };
        if (ollamaError.error && ollamaError.error.includes('not found')) {
          throw new Error(`model "${modelName}" not found, try pulling it first`);
        }
      }
      
    // Handle server connectivity errors
    if (error instanceof Error && (
      error.message.includes('server is not accessible') || 
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('fetch failed')
    )) {
      throw new Error('Ollama server is not running or accessible. Please start Ollama.');
    }
    
    throw new Error(`Failed to ${operation} using Ollama: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  async enhanceScript(
    aiSettings: AiSettings,
    prompt: string, 
    script: string,
    storyCharacters?: string[]
  ): Promise<string> {
    const model = this.createOllamaModel(aiSettings);
    
    // Build the complete prompt template
    const fullTemplate = `You are an award winning story writer and script editor, who can enhance scripts to make them more engaging, detailed, and professional while maintaining the original story structure and dialogue.

Based on the following prompt and original script, generate an enhanced version that improves the writing quality, adds vivid details, and makes the story more compelling.

Enhancement Prompt: {enhancementPrompt}
Original Script: {originalScript}${storyCharacters && storyCharacters.length > 0 ? `

Story Characters: ${storyCharacters.join(', ')}
Use these characters to enhance the script with better character development, consistent dialogue patterns, and deeper emotional connections.` : ''}

Create an enhanced version that:
1. Maintains the original story structure and dialogue
2. Adds vivid descriptions and sensory details
3. Improves pacing and flow
4. Makes the dialogue more natural and engaging
5. Enhances character development and emotional depth
6. ${storyCharacters && storyCharacters.length > 0 ? 'Incorporates character-specific traits and relationships consistently' : 'Maintains character consistency throughout'}

IMPORTANT: You must respond with ONLY a valid JSON object containing the enhanced script. No explanations, no conversational text, no markdown formatting. Just pure JSON.

{format_instructions}`;
    
    const promptTemplate = PromptTemplate.fromTemplate(fullTemplate);
    
    // Create a chain with CleanJsonOutputParser for consistency
    const parser = new CleanJsonOutputParser();
    const chain = promptTemplate.pipe(model).pipe(parser);
    try {
      const result = await chain.invoke({
        enhancementPrompt: prompt.trim(),
        originalScript: script.trim(),
        storyCharacters: storyCharacters || [],
        format_instructions: 'Format your response as a JSON object with the structure: {"enhancedScript": "Your enhanced script content here"}'
      });
      
      // Parse and validate the response using Zod schema
      const parsedResult = EnhanceScriptSchema.parse(result);
      return parsedResult.enhancedScript;
    } catch (error) {
      this.handleOllamaError(error, 'enhanceScript', aiSettings.model);
    }
  }

  async enhanceCharacterDescription(
    aiSettings: AiSettings,
    prompt: string, 
    characterDescription: string
  ): Promise<string> {
    const model = this.createOllamaModel(aiSettings);
    
    // Build the complete prompt template with conditional enhancement prompt
    const enhancementPromptSection = prompt.trim() ? 
      `\nEnhancement Prompt: ${prompt.trim()}\n` : '';
    
    const fullTemplate = `You are an expert character designer and visual artist, who can enhance character descriptions to make them more detailed, vivid, and suitable for accurate image generation.

Based on the following original character description, generate an enhanced version that adds more visual details, physical characteristics, and descriptive elements that will help create a more accurate and detailed character image.${enhancementPromptSection}
Original Character Description: {originalDescription}

Create an enhanced version that:
1. Maintains the original character concept and personality
2. Adds detailed physical descriptions (facial features, body type, hair, eyes, etc.)
3. Includes clothing and accessory details
4. Describes posture, expression, and mood
5. Adds environmental and lighting context if relevant
6. Uses specific, vivid language that translates well to visual art
7. Focuses on details that will help generate accurate character images

IMPORTANT: You must respond with ONLY a valid JSON object containing the enhanced character description. No explanations, no conversational text, no markdown formatting. Just pure JSON.

{format_instructions}`;
    
    const promptTemplate = PromptTemplate.fromTemplate(fullTemplate);
    
    // Create a chain with CleanJsonOutputParser for consistency
    const parser = new CleanJsonOutputParser();
    const chain = promptTemplate.pipe(model).pipe(parser);
    try {
      const result = await chain.invoke({
        originalDescription: characterDescription.trim(),
        format_instructions: 'Format your response as a JSON object with the structure: {"enhancedDescription": "Your enhanced character description content here"}'
      });
      
      // Parse and validate the response using Zod schema
      const parsedResult = EnhanceCharacterDescriptionSchema.parse(result);
      return parsedResult.enhancedDescription;
    } catch (error) {
      this.handleOllamaError(error, 'enhanceCharacterDescription', aiSettings.model);
    }
  }

  async generateSceneTitles(
    storyDescription: string,
    aiSettings: AiSettings,
    userPrompt?: string
  ): Promise<SceneTitlesOutput> {
    const model = this.createOllamaModel(aiSettings);
    
    // Build the complete prompt template
    const additionalRequirements = userPrompt ? 
      `\n\nAdditional Requirements: ${userPrompt.trim()}` : '';
    
    const fullTemplate = `You are an award winning story writer and cinematographer, who can split the story into exact number of scenes, how many characters in the story, find out characters present in each scene, describe each scene into vivid details, so that shots can be extracted from it.

Based on the following story description, generate a list of scene titles that break down the story into logical, cinematic scenes.

Story Description: {storyDescription}

Generate exactly the number of scenes needed to tell this story effectively. Each scene should have:
1. A descriptive title that captures the essence of what happens
2. A concise summary (2-3 sentences) that explains the key events and purpose of the scene

${additionalRequirements}

IMPORTANT: You must respond with ONLY a valid JSON object. No explanations, no conversational text, no markdown formatting. Just pure JSON.

{format_instructions}`;
    
    const promptTemplate = PromptTemplate.fromTemplate(fullTemplate);
    const parser = new CleanJsonOutputParser();
    const chain = promptTemplate.pipe(model).pipe(parser);

    try {
      const result = await chain.invoke({
        storyDescription: storyDescription.trim(),
        format_instructions: 'Format your response as a JSON object with the structure: {"scenes": [{"title": "Scene title", "serial": 1, "summary": "Brief scene summary"}]}'
      });
      
      // Parse and validate the response using Zod schema
      return SceneTitlesSchema.parse(result);
    } catch (error) {
      this.handleOllamaError(error, 'generateSceneTitles', aiSettings.model);
    }
  }

  async generateSceneDetails(
    sceneTitle: string,
    storyContext: string,
    aiSettings: AiSettings,
    userPrompt?: string,
    storyCharacters?: string[],
    allSceneInfo?: SceneInfo[]
  ): Promise<SceneDetailsOutput> {
    const model = this.createOllamaModel(aiSettings);
    
    // Build the complete prompt template
    const additionalRequirements = userPrompt ? 
      `\n\nAdditional Requirements: ${userPrompt.trim()}` : '';
    
    const charactersContext = storyCharacters && storyCharacters.length > 0 ? 
      `\n\nStory Characters: ${storyCharacters.join(', ')}` : '';
    
    const scenesContext = allSceneInfo && allSceneInfo.length > 0 ? 
      `\n\nOther Scenes in Story:\n${allSceneInfo.map(scene => `- ${scene.title}: ${scene.summary || scene.description || 'No summary available'}`).join('\n')}` : '';
    
    const fullTemplate = `You are an award winning story writer and cinematographer, who can split the story into exact number of scenes, how many characters in the story, find out characters present in each scene, describe each scene into vivid details, so that shots can be extracted from it.

Based on the following story context and scene title, generate detailed scene information.

Story Context: {storyContext}
Scene Title: {sceneTitle}${charactersContext}${scenesContext}

Create a detailed description of what happens in this scene, including setting, actions, mood, and visual elements for cinematography. Also identify which characters are present in this scene. Consider the context of other scenes and available characters to ensure consistency and continuity.${additionalRequirements}

IMPORTANT: You must respond with ONLY a valid JSON object. No explanations, no conversational text, no markdown formatting. Just pure JSON.

{format_instructions}`;
    
    const promptTemplate = PromptTemplate.fromTemplate(fullTemplate);
    const parser = new CleanJsonOutputParser();
    const chain = promptTemplate.pipe(model).pipe(parser);

    try {
      const result = await chain.invoke({
        storyContext: storyContext.trim(),
        sceneTitle: sceneTitle.trim(),
        format_instructions: 'Format your response as a JSON object with the structure: {"title": "Scene title", "description": "Detailed description", "characters": ["Character1", "Character2"]}'
      });
      return SceneDetailsSchema.parse(result);
    } catch (error) {
      this.handleOllamaError(error, 'generateSceneDetails', aiSettings.model);
    }
  }

  async generateShotTitles(
    sceneDescription: string,
    aiSettings: AiSettings,
    userPrompt?: string
  ): Promise<ShotTitlesOutput> {
    const model = this.createOllamaModel(aiSettings);
    
    // Build the complete prompt template
    const additionalRequirements = userPrompt ? 
      `\n\nAdditional Requirements: ${userPrompt.trim()}` : '';
    
    const fullTemplate = `You are a professional cinematographer and director of photography, expert in shot composition, camera angles, lighting, and visual storytelling techniques.

Based on the following scene description, generate a list of shot titles that break down the scene into cinematic shots.

Scene Description: {sceneDescription}

Generate exactly the number of shots needed to capture this scene effectively. Each shot should have a descriptive title that captures the cinematic shot type and subject that captures the essence of what happens in the shot.${additionalRequirements}

IMPORTANT: You must respond with ONLY a valid JSON object. No explanations, no conversational text, no markdown formatting. Just pure JSON.

{format_instructions}`;
    
    const promptTemplate = PromptTemplate.fromTemplate(fullTemplate);
    const parser = new CleanJsonOutputParser();
    const chain = promptTemplate.pipe(model).pipe(parser);

    try {
      const result = await chain.invoke({
        sceneDescription: sceneDescription.trim(),
        format_instructions: 'Format your response as a JSON object with the structure: {"shots": [{"title": "Shot title", "sequence": 1}]}'
      });
      
      // Parse and validate the response using Zod schema
      return ShotTitlesSchema.parse(result);
    } catch (error) {
      this.handleOllamaError(error, 'generateShotTitles', aiSettings.model);
    }
  }

  async generateShotDetails(
    sceneContext: string,
    shotTitle: string,
    allShotTitles: Array<{ title: string; sequence: number }>,
    currentShotSequence: number,
    aiSettings: AiSettings,
    userPrompt?: string
  ): Promise<ShotDetailsOutput> {
    const model = this.createOllamaModel(aiSettings);
    
    // Find the current shot being generated
    const currentShot = allShotTitles.find(shot => shot.sequence === currentShotSequence);
    if (!currentShot) {
      throw new Error(`Shot with sequence ${currentShotSequence} not found`);
    }
    
    // Build context about other shots for better shot detail generation
    const shotContext = `\n\nAll Shots in This Scene:\n${allShotTitles.map(shot => `${shot.sequence}. ${shot.title}`).join('\n')}\n\nCurrent Shot Being Generated: ${currentShotSequence}. ${currentShot.title}\n\nThis shot is part of a sequence of ${allShotTitles.length} shots. Consider how this shot flows with the previous and next shots for cinematic continuity.`;

    // Build the complete prompt template
    const additionalRequirements = userPrompt ? 
      `\n\nAdditional Requirements: ${userPrompt.trim()}` : '';
    
    const fullTemplate = `You are a professional cinematographer and director of photography, expert in shot composition, camera angles, lighting, and visual storytelling techniques.

Based on the following scene context and shot information, generate detailed shot specifications.

Scene Context: {sceneContext}{shotContext}

Create a detailed description of this shot that includes:
- Camera angle, movement, and positioning
- Framing and composition (wide shot, close-up, medium shot, etc.)
- Lighting setup and mood
- Visual elements and staging
- How this shot contributes to the scene's storytelling
- Cinematic techniques and visual style
- Consider the relationship with other shots in the sequence for smooth transitions

The shot description should be rich enough for a cinematographer to execute and should complement the overall scene narrative.${additionalRequirements}

IMPORTANT: You must respond with ONLY a valid JSON object. No explanations, no conversational text, no markdown formatting. Just pure JSON.

{format_instructions}`;
    
    const promptTemplate = PromptTemplate.fromTemplate(fullTemplate);
    const parser = new CleanJsonOutputParser();
    const chain = promptTemplate.pipe(model).pipe(parser);

    try {
      const result = await chain.invoke({
        sceneContext: sceneContext.trim(),
        shotContext: shotContext,
        format_instructions: 'Format your response as a JSON object with the structure: {"title": "Shot title", "description": "Detailed shot description"}'
      });
      
      // Parse and validate the response using Zod schema
      return ShotDetailsSchema.parse(result);
    } catch (error) {
      this.handleOllamaError(error, 'generateShotDetails', aiSettings.model);
    }
  }

  // Utility operations - not supported by Ollama
  async checkServerAvailability(): Promise<{ available: boolean; message: string }> {
    return {available: true, message: 'Ollama server availability check skipped, use getAvailableModels instead'};
  }

  async getAvailableModels(): Promise<AiModelRegistry> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      const models = result.models || [];
      
      // Convert to AiSettings format and organize by category
      const textModels = models.map((model: { name: string; modified_at?: string }) => ({
        tool: AI_TOOLS.OLLAMA,
        model: model.name,
        version: undefined // Ollama version is embedded in the model name
      }));

      return {
        text: textModels
      };
    } catch (error) {
      console.warn('Failed to fetch available models from Ollama:', error);
      return { text: [] }; // Return empty text category on error
    }
  }
}
