import { AiEngine } from './BaseAiEngine';
import { OpenAISettings } from '../../../sokafilm/types/appSettings';
import { AiSettings, SceneTitlesOutput, SceneDetailsOutput, ShotTitlesOutput, ShotDetailsOutput, EnhanceScriptResponse, SceneInfo, ImageGenerationOptions, ImageGenerationResponse } from '../types';
import fs from 'fs';
import { AiModelRegistry } from '../AiService';
import { AI_TOOLS } from '../constants';
import { z } from 'zod';
import { toFile, OpenAI } from 'openai';

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

export class OpenAiEngine implements AiEngine {
  private openai: any;
  private settings: OpenAISettings;

  constructor(settings: OpenAISettings) {
    this.settings = settings;
  }

  private async ensureOpenAIClient(): Promise<void> {
    if (!this.openai) {
      try {
        this.openai = new OpenAI({
          apiKey: this.settings.OPENAI_API_KEY,
        });
      } catch (error) {
        console.error('Failed to initialize OpenAI client:', error);
        throw new Error('OpenAI package not available');
      }
    }
  }

  async checkServerAvailability(): Promise<{ available: boolean; message: string }> {
    try {
      await this.ensureOpenAIClient();
      // Test the API key by making a simple request
      const response = await this.openai.models.list();
      return { available: true, message: 'OpenAI API is available' };
    } catch (error) {
      console.error('OpenAI server availability check failed:', error);
      return { available: false, message: `OpenAI API unavailable: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  async getAvailableModels(): Promise<AiModelRegistry> {
    try {
      await this.ensureOpenAIClient();
        console.log("Fetching available models... (But using hardcoded models)");
        // const modelList = await this.openai.models.list();
        // for (const model of modelList.data) {
        //     console.log(model.id);
        // }

        return {
          text: [
            {
              tool: AI_TOOLS.OPENAI,
              model: 'gpt-5-mini',
              version: undefined
            },
            {
              tool: AI_TOOLS.OPENAI,
              model: 'gpt-5-nano',
              version: undefined
            },
            {
              tool: AI_TOOLS.OPENAI,
              model: 'gpt-5-instant',
              version: undefined
            },
            {
              tool: AI_TOOLS.OPENAI,
              model: 'gpt-5',
              version: undefined
            },
          ],
          image: [
            {
              tool: AI_TOOLS.OPENAI,
              model: 'gpt-image-1',
              version: undefined
            },
          ],
          video: [
            {
              tool: AI_TOOLS.OPENAI,
              model: 'gpt-5',
              version: undefined
            },
          ]
        };
    } catch (error) {
      console.error('Failed to get OpenAI models:', error);
      throw new Error(`Failed to get OpenAI models: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

  }

  // Text operations
  async enhanceScript(aiSettings: AiSettings, prompt: string, script: string, storyCharacters?: string[]): Promise<string> {
    try {
      await this.ensureOpenAIClient();
      
      const response = await this.openai.chat.completions.create({
        model: aiSettings.model,
        messages: [
          {
            role: 'system',
            content: `You are an award winning story writer and script editor, who can enhance scripts to make them more engaging, detailed, and professional while maintaining the original story structure and dialogue. Create an enhanced version that improves the writing quality, adds vivid details, and makes the story more compelling. Maintain the original story structure and dialogue, add vivid descriptions and sensory details, improve pacing and flow, make the dialogue more natural and engaging, and enhance character development and emotional depth.${storyCharacters && storyCharacters.length > 0 ? ` Use the provided story characters to enhance the script with better character development, consistent dialogue patterns, and deeper emotional connections.` : ''} IMPORTANT: You must respond with ONLY a valid JSON object containing the enhanced script. No explanations, no conversational text, no markdown formatting. Just pure JSON with the structure: {"enhancedScript": "Your enhanced script content here"}`
          },
          {
            role: 'user',
            content: `Enhancement Prompt: ${prompt.trim()}\n\nOriginal Script: ${script.trim()}${storyCharacters && storyCharacters.length > 0 ? `\n\nStory Characters: ${storyCharacters.join(', ')}` : ''}`
          }
        ],
        max_completion_tokens: 5000,
      });

      const content = response.choices[0]?.message?.content || '';
      // Parse and validate the response using Zod schema
      const parsedResult = EnhanceScriptSchema.parse(JSON.parse(content));
      return parsedResult.enhancedScript;
    } catch (error) {
      console.error('OpenAI enhanceScript failed:', error);
      throw new Error(`OpenAI enhanceScript failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async enhanceCharacterDescription(aiSettings: AiSettings, prompt: string, characterDescription: string): Promise<string> {
    try {
      await this.ensureOpenAIClient();
      
      // Build the system message with conditional enhancement prompt
      const enhancementPromptSection = prompt.trim() ? 
        `\n\nEnhancement Prompt: ${prompt.trim()}` : '';
      
      const systemMessage = `You are an expert character designer and visual artist, who can enhance character descriptions to make them more detailed, vivid, and suitable for accurate image generation. Create an enhanced version that adds more visual details, physical characteristics, and descriptive elements that will help create a more accurate and detailed character image. Maintain the original character concept and personality, add detailed physical descriptions (facial features, body type, hair, eyes, etc.), include clothing and accessory details, describe posture, expression, and mood, add environmental and lighting context if relevant, use specific, vivid language that translates well to visual art, and focus on details that will help generate accurate character images.${enhancementPromptSection} IMPORTANT: You must respond with ONLY a valid JSON object containing the enhanced character description. No explanations, no conversational text, no markdown formatting. Just pure JSON with the structure: {"enhancedDescription": "Your enhanced character description content here"}`;
      
      const response = await this.openai.chat.completions.create({
        model: aiSettings.model,
        messages: [
          {
            role: 'system',
            content: systemMessage
          },
          {
            role: 'user',
            content: `Original Character Description: ${characterDescription.trim()}`
          }
        ],
        max_completion_tokens: 5000,
      });

      const content = response.choices[0]?.message?.content || '';
      // Parse and validate the response using Zod schema
      const parsedResult = EnhanceCharacterDescriptionSchema.parse(JSON.parse(content));
      return parsedResult.enhancedDescription;
    } catch (error) {
      console.error('OpenAI enhanceCharacterDescription failed:', error);
      throw new Error(`OpenAI enhanceCharacterDescription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateSceneTitles(storyDescription: string, aiSettings: AiSettings, userPrompt?: string): Promise<SceneTitlesOutput> {
    try {
      await this.ensureOpenAIClient();
      
      const additionalRequirements = userPrompt ? 
        `\n\nAdditional Requirements: ${userPrompt.trim()}` : '';
      
      const response = await this.openai.chat.completions.create({
        model: aiSettings.model,
        messages: [
          {
            role: 'system',
            content: 'You are an award winning story writer and cinematographer, who can split the story into exact number of scenes, how many characters in the story, find out characters present in each scene, describe each scene into vivid details, so that shots can be extracted from it. Generate exactly the number of scenes needed to tell this story effectively. Each scene should have: 1. A descriptive title that captures the essence of what happens, 2. A concise summary (2-3 sentences) that explains the key events and purpose of the scene. IMPORTANT: You must respond with ONLY a valid JSON object. No explanations, no conversational text, no markdown formatting. Just pure JSON with the structure: {"scenes": [{"title": "Scene title", "serial": 1, "summary": "Brief scene summary"}]}'
          },
          {
            role: 'user',
            content: `Story Description: ${storyDescription.trim()}${additionalRequirements}`
          }
        ],
        max_completion_tokens: 5000,
      });

      const content = response.choices[0]?.message?.content || '';
      // Parse and validate the response using Zod schema
      return SceneTitlesSchema.parse(JSON.parse(content));
    } catch (error) {
      console.error('OpenAI generateSceneTitles failed:', error);
      throw new Error(`OpenAI generateSceneTitles failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateSceneDetails(sceneTitle: string, storyContext: string, aiSettings: AiSettings, userPrompt?: string, storyCharacters?: string[], allSceneInfo?: SceneInfo[]): Promise<SceneDetailsOutput> {
    try {
      await this.ensureOpenAIClient();
      
      const additionalRequirements = userPrompt ? 
        `\n\nAdditional Requirements: ${userPrompt.trim()}` : '';
      
      const charactersContext = storyCharacters && storyCharacters.length > 0 ? 
        `\n\nStory Characters: ${storyCharacters.join(', ')}` : '';
      
      const scenesContext = allSceneInfo && allSceneInfo.length > 0 ? 
        `\n\nOther Scenes in Story:\n${allSceneInfo.map(scene => `- ${scene.title}: ${scene.summary || scene.description || 'No summary available'}`).join('\n')}` : '';
      
      const response = await this.openai.chat.completions.create({
        model: aiSettings.model,
        messages: [
          {
            role: 'system',
            content: 'You are an award winning story writer and cinematographer, who can split the story into exact number of scenes, how many characters in the story, find out characters present in each scene, describe each scene into vivid details, so that shots can be extracted from it. Create a detailed description of what happens in this scene, including setting, actions, mood, and visual elements for cinematography. Also identify which characters are present in this scene. Consider the context of other scenes and available characters to ensure consistency and continuity. IMPORTANT: You must respond with ONLY a valid JSON object. No explanations, no conversational text, no markdown formatting. Just pure JSON with the structure: {"title": "Scene title", "description": "Detailed description", "characters": ["Character1", "Character2"]}'
          },
          {
            role: 'user',
            content: `Story Context: ${storyContext.trim()}\n\nScene Title: ${sceneTitle.trim()}${charactersContext}${scenesContext}${additionalRequirements}`
          }
        ],
        max_completion_tokens: 5000,
      });

      const content = response.choices[0]?.message?.content || '';
      // Parse and validate the response using Zod schema
      return SceneDetailsSchema.parse(JSON.parse(content));
    } catch (error) {
      console.error('OpenAI generateSceneDetails failed:', error);
      throw new Error(`OpenAI generateSceneDetails failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateShotTitles(sceneDescription: string, aiSettings: AiSettings, userPrompt?: string): Promise<ShotTitlesOutput> {
    try {
      await this.ensureOpenAIClient();
      
      const additionalRequirements = userPrompt ? 
        `\n\nAdditional Requirements: ${userPrompt.trim()}` : '';
      
      const response = await this.openai.chat.completions.create({
        model: aiSettings.model,
        messages: [
          {
            role: 'system',
            content: 'You are a professional cinematographer and director of photography, expert in shot composition, camera angles, lighting, and visual storytelling techniques. Generate exactly the number of shots needed to capture this scene effectively. Each shot should have a descriptive title that captures the cinematic shot type and subject that captures the essence of what happens in the shot. IMPORTANT: You must respond with ONLY a valid JSON object. No explanations, no conversational text, no markdown formatting. Just pure JSON with the structure: {"shots": [{"title": "Shot title", "sequence": 1}]}'
          },
          {
            role: 'user',
            content: `Scene Description: ${sceneDescription.trim()}${additionalRequirements}`
          }
        ],
        max_completion_tokens: 5000,
      });

      const content = response.choices[0]?.message?.content || '';
      // Parse and validate the response using Zod schema
      return ShotTitlesSchema.parse(JSON.parse(content));
    } catch (error) {
      console.error('OpenAI generateShotTitles failed:', error);
      throw new Error(`OpenAI generateShotTitles failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateShotDetails(sceneContext: string, shotTitle: string, allShotTitles: Array<{title: string, sequence: number}>, currentShotSequence: number, aiSettings: AiSettings, userPrompt?: string): Promise<ShotDetailsOutput> {
    try {
      await this.ensureOpenAIClient();
      
      // Find the current shot being generated
      const currentShot = allShotTitles.find(shot => shot.sequence === currentShotSequence);
      if (!currentShot) {
        throw new Error(`Shot with sequence ${currentShotSequence} not found`);
      }
      
      // Build context about other shots for better shot detail generation
      const shotContext = `\n\nAll Shots in This Scene:\n${allShotTitles.map(shot => `${shot.sequence}. ${shot.title}`).join('\n')}\n\nCurrent Shot Being Generated: ${currentShotSequence}. ${currentShot.title}\n\nThis shot is part of a sequence of ${allShotTitles.length} shots. Consider how this shot flows with the previous and next shots for cinematic continuity.`;

      const additionalRequirements = userPrompt ? 
        `\n\nAdditional Requirements: ${userPrompt.trim()}` : '';
      
      const response = await this.openai.chat.completions.create({
        model: aiSettings.model,
        messages: [
          {
            role: 'system',
            content: 'You are a professional cinematographer and director of photography, expert in shot composition, camera angles, lighting, and visual storytelling techniques. Create a detailed description of this shot that includes camera angle, movement, and positioning, framing and composition (wide shot, close-up, medium shot, etc.), lighting setup and mood, visual elements and staging, how this shot contributes to the scene\'s storytelling, cinematic techniques and visual style, and consider the relationship with other shots in the sequence for smooth transitions. The shot description should be rich enough for a cinematographer to execute and should complement the overall scene narrative. IMPORTANT: You must respond with ONLY a valid JSON object. No explanations, no conversational text, no markdown formatting. Just pure JSON with the structure: {"title": "Shot title", "description": "Detailed shot description"}'
          },
          {
            role: 'user',
            content: `Scene Context: ${sceneContext.trim()}${shotContext}${additionalRequirements}`
          }
        ],
        max_completion_tokens: 5000,
      });

      const content = response.choices[0]?.message?.content || '';
      // Parse and validate the response using Zod schema
      return ShotDetailsSchema.parse(JSON.parse(content));
    } catch (error) {
      console.error('OpenAI generateShotDetails failed:', error);
      throw new Error(`OpenAI generateShotDetails failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Image operations
  async generateImage(aiSettings: AiSettings, options: ImageGenerationOptions): Promise<ImageGenerationResponse> {
    
    try {
      await this.ensureOpenAIClient();

      // Check if input image file paths are provided for image editing
      if (options.inputImageFilepaths && options.inputImageFilepaths.length > 0) {
        // Convert file paths to File objects using toFile
        const images = await Promise.all(
          options.inputImageFilepaths.map(async (filePath) => {
            if (!fs.existsSync(filePath)) {
              throw new Error(`Input file does not exist: ${filePath}`);
            }
            return await toFile(fs.createReadStream(filePath), null, {
              type: "image/png",
            });
          })
        );

        const response = await this.openai.images.edit({
          model: aiSettings.model,
          image: images,
          prompt: options.prompt,
          size: `auto`,
          quality: 'low',
          n: 1,
        });

        return {
          imageBase64: response.data[0].b64_json
        };
      } else {
        // Use image create API for generation without input images
        const response = await this.openai.images.generate({
          model: aiSettings.model,
          prompt: options.prompt,
          size: `auto`,
          quality: 'low',
          n: 1,
        });

        return {
          imageBase64: response.data[0].b64_json
        };
      }
    } catch (error) {
      console.error('OpenAI generateImage failed:', error);
      throw new Error(`OpenAI generateImage failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
