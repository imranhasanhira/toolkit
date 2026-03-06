import { OllamaEngine } from './engines/OllamaEngine';
import { DrawThingsEngine } from './engines/DrawThingsEngine';
import { OpenAiEngine } from './engines/OpenAiEngine';
import { AiEngine } from './engines/BaseAiEngine';
import { AiSettings, ProjectAiSettings, SceneTitlesOutput, SceneDetailsOutput, ShotTitlesOutput, ShotDetailsOutput, EnhanceScriptResponse, EnhanceCharacterDescriptionResponse, ImageGenerationResponse, SceneInfo, ImageGenerationOptions } from './types';
import { AppSettings } from '../../sokafilm/types/appSettings';
import { AI_TOOLS, AI_TOOL_KEYS, defaultAiModels } from './constants';


// Tool configuration mapping - simplified to just tool name to engine
interface ToolConfiguration {
  [toolName: string]: AiEngine;
}

// AI Models Configuration
export interface AiModelRegistry {
  [category: string]: AiSettings[];
}








export class AiService {
  private static instance: AiService;
  private toolConfiguration: ToolConfiguration | null = null;
  private dynamicAiModels: AiModelRegistry | null = null;

  private constructor() {
  }

  /**
   * Get the singleton instance of AiService
   */
  public static getInstance(): AiService {
    if (!AiService.instance) {
      AiService.instance = new AiService();
    }
    return AiService.instance;
  }

  /**
   * Initialize engines with settings from database
   */
  public async initializeWithSettings(engineSettings: AppSettings): Promise<void> {
    // if (this.toolConfiguration) return; // Already initialized

    this.toolConfiguration = {};

    // Only initialize engines that have settings configured and are enabled
    const ollamaSettings = engineSettings.aiTools?.[AI_TOOL_KEYS.OLLAMA];
    if (ollamaSettings && ollamaSettings.enabled !== false) {
      console.log('🚀 Initializing Ollama engine (enabled)');
      this.toolConfiguration[AI_TOOLS.OLLAMA] = new OllamaEngine(ollamaSettings);
    } else {
      console.log('⏭️ Skipping Ollama engine (disabled or not configured)');
    }
    
    const drawThingsSettings = engineSettings.aiTools?.[AI_TOOL_KEYS.DRAW_THINGS];
    if (drawThingsSettings && drawThingsSettings.enabled !== false) {
      console.log('🚀 Initializing DrawThings engine (enabled)');
      this.toolConfiguration[AI_TOOLS.DRAW_THINGS] = new DrawThingsEngine(drawThingsSettings);
    } else {
      console.log('⏭️ Skipping DrawThings engine (disabled or not configured)');
    }
    
    const openaiSettings = engineSettings.aiTools?.[AI_TOOL_KEYS.OPENAI];
    if (openaiSettings && openaiSettings.enabled !== false) {
      console.log('🚀 Initializing OpenAI engine (enabled)');
      this.toolConfiguration[AI_TOOLS.OPENAI] = new OpenAiEngine(openaiSettings);
    } else {
      console.log('⏭️ Skipping OpenAI engine (disabled or not configured)');
    }

    // Check if we have at least one engine configured
    if (Object.keys(this.toolConfiguration).length === 0) {
      throw new Error('No AI engines configured. Please configure at least one AI tool in app settings.');
    }

    console.log("Tool configuration:", this.toolConfiguration);

    // Initialize dynamic models asynchronously
    await this.initializeDynamicModels();
  }

  /**
   * Check if engines are initialized
   */
  public isInitialized(): boolean {
    return this.toolConfiguration !== null;
  }

  /**
   * Validate project AI settings against available models
   */
  public async validateProjectAiSettings(aiSettings: ProjectAiSettings): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    // Ensure dynamic models are loaded
    await this.ensureModelsLoaded();
    const dynamicModels = this.getDynamicModels();
    
    if (!dynamicModels) {
      return { isValid: false, errors: ['AI models not loaded. Please try again.'] };
    }
    
    // Validate each category
    for (const [category, settings] of Object.entries(aiSettings)) {
      const categoryModels = dynamicModels[category as keyof typeof dynamicModels];
      
      if (!categoryModels || !Array.isArray(categoryModels)) {
        errors.push(`${category} category not found in available models`);
        continue;
      }
      
      // Check if tool is supported for this category
      const availableTools = [...new Set(categoryModels.map(model => model.tool))];
      if (!availableTools.includes(settings.tool)) {
        errors.push(`${category} tool '${settings.tool}' is not supported. Available tools: ${availableTools.join(', ')}`);
        continue;
      }
      
      // Check if model exists for the specified tool
      // Generic version comparison: match if both are undefined/null, or if they're equal
      const modelExists = categoryModels.some(model => {
        const toolMatch = model.tool === settings.tool;
        const modelMatch = model.model === settings.model;
        const versionMatch = (model.version === settings.version) ||
                            ((!model.version || model.version === '') && (!settings.version || settings.version === ''));
        
        return toolMatch && modelMatch && versionMatch;
      });
      
      if (!modelExists) {
        const availableModels = categoryModels
          .filter(model => model.tool === settings.tool)
          .map(model => model.version ? `${model.model} (v${model.version})` : model.model)
          .join(', ');
        
        errors.push(`${category} model '${settings.model}' not found for tool '${settings.tool}'. Available models: ${availableModels}`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }



  /**
   * Initialize dynamic models asynchronously (non-blocking)
   */
  private async initializeDynamicModels(): Promise<void> {
    try {
      await this.populateDynamicModels();
      console.log("Dynamic models initialized.", this.dynamicAiModels);
    } catch (error) {
      console.error('Failed to initialize dynamic models:', error);
      // Fall back to default models - system will still work
    }
  }

  /**
   * Ensure models are loaded (public method for validation)
   */
  public async ensureModelsLoaded(): Promise<void> {
    if (!this.dynamicAiModels) {
      await this.populateDynamicModels();
    }
  }

  /**
   * Get dynamic models (public method for validation)
   */
  public getDynamicModels(): AiModelRegistry | null {
    return this.dynamicAiModels;
  }

  private getEngineForTool(tool: string): AiEngine {
    if (!this.toolConfiguration) {
      throw new Error('AiService not initialized. Call initializeWithSettings first.');
    }
    const engine = this.toolConfiguration[tool];
    if (!engine) {
      throw new Error(`Tool '${tool}' not supported`);
    }
    return engine;
  }

  /**
   * Populate dynamic AI models by calling each engine's getAvailableModels method
   */
  private async populateDynamicModels(): Promise<void> {
    // if (this.dynamicAiModels){
    //   console.log("Populating dynamic models...SKIP, already populated.");
    //   return;
    // } else {
      
    // }
    console.log("Populating dynamic models...");

    // Initialize with empty arrays - models will be populated from engines
    this.dynamicAiModels = {
      text: [],
      image: [],
      video: []
    };

    // Get models from each engine
    if (!this.toolConfiguration) {
      console.error('Tool configuration not initialized');
      return;
    }
    
    for (const [toolName, engine] of Object.entries(this.toolConfiguration)) {
      let availability, result;
      
      try {
        availability = await engine.checkServerAvailability();
      } catch (error) {
        console.error(`Failed to check availability for ${toolName}:`, error);
        continue;
      }
      
      if (!availability.available) {
        console.log(`${toolName} is not available:`, availability.message);
        continue;
      }

      try {
        result = await engine.getAvailableModels();
      } catch (error) {
        console.error(`Failed to get models from ${toolName}:`, error);
        continue;
      }
      
      // Merge the engine's AiModelRegistry with our current dynamicAiModels
      for (const [category, models] of Object.entries(result)) {
        if (this.dynamicAiModels[category]) {
          // Add new models to this category (models are unique by tool+model+version)
          this.dynamicAiModels[category].push(...(models as AiSettings[]));
        }
      }
    }

    // Sort all categories alphabetically by tool, then model, then version
    for (const [category, models] of Object.entries(this.dynamicAiModels)) {
      this.dynamicAiModels[category] = models.sort((a, b) => {
        // First sort by tool
        const toolComparison = a.tool.localeCompare(b.tool);
        if (toolComparison !== 0) return toolComparison;
        
        // Then sort by model
        const modelComparison = a.model.localeCompare(b.model);
        if (modelComparison !== 0) return modelComparison;
        
        // Finally sort by version (handle undefined/null versions)
        return (a.version || '').localeCompare(b.version || '');
      });
    }


    // Validate that all default models are present
    try {
      this.validateDefaultModelsArePresent();
    } catch (error) {
      console.error('Failed to validate default models:', error);
      // Fall back to default models
    }
  }

  /**
   * Validate that default models are present in dynamic models.
   * If a default is missing (e.g. provider offline), log a warning and continue so the server does not crash.
   */
  private validateDefaultModelsArePresent(): void {
    for (const [category, defaultModel] of Object.entries(defaultAiModels)) {
      const categoryModels = this.dynamicAiModels![category];
      if (!categoryModels || categoryModels.length === 0) {
        console.warn(`[AiService] Category '${category}' has no available models (no engine connected?). Default was ${defaultModel.tool}/${defaultModel.model}/${defaultModel.version || 'n/a'}.`);
        continue;
      }

      const hasDefaultModel = categoryModels.some((model: AiSettings) =>
        model.tool === defaultModel.tool &&
        model.model === defaultModel.model &&
        model.version === defaultModel.version
      );

      if (!hasDefaultModel) {
        const foundModels = categoryModels.map(m => `${m.tool}/${m.model}/${m.version || 'undefined'}`).join(', ');
        console.warn(`[AiService] Default model for '${category}' not available. Expected: ${defaultModel.tool}/${defaultModel.model}/${defaultModel.version || 'undefined'}. Found: ${foundModels}. Use app settings or start the missing service.`);
      }
    }
  }

  /**
   * Manually refresh dynamic models (useful for testing or manual updates)
   */
  async refreshDynamicModels(): Promise<void> {
    this.dynamicAiModels = null; // Clear cache
    await this.populateDynamicModels();
  }

  /**
   * Get current dynamic models status
   */
  getDynamicModelsStatus(): { isPopulated: boolean; categories: string[] } {
    if (!this.dynamicAiModels) {
      return { isPopulated: false, categories: [] };
    }
    
    return {
      isPopulated: true,
      categories: Object.keys(this.dynamicAiModels)
    };
  }



  async enhanceScript(
    script: string,
    prompt: string,
    aiSettings: AiSettings,
    storyCharacters?: string[]
  ): Promise<EnhanceScriptResponse> {
    if (!script || script.trim().length === 0) {
      throw new Error('Script is required for enhancement');
    }
    const engine = this.getEngineForTool(aiSettings.tool);

    try {
      const enhancedScript = await engine.enhanceScript(aiSettings, prompt, script.trim(), storyCharacters);

      return {
        originalScript: script.trim(),
        enhancedScript: enhancedScript,
        modelUsed: aiSettings.model,
        promptUsed: prompt,
        timestamp: new Date().toISOString(),
        storyCharacters: storyCharacters
      };
    } catch (error) {
      throw new Error(`Failed to enhance script: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async enhanceCharacterDescription(
    characterDescription: string,
    prompt: string,
    aiSettings: AiSettings
  ): Promise<EnhanceCharacterDescriptionResponse> {
    if (!characterDescription || characterDescription.trim().length === 0) {
      throw new Error('Character description is required for enhancement');
    }
    const engine = this.getEngineForTool(aiSettings.tool);

    try {
      const enhancedDescription = await engine.enhanceCharacterDescription(aiSettings, prompt, characterDescription.trim());

      return {
        originalDescription: characterDescription.trim(),
        enhancedDescription: enhancedDescription,
        modelUsed: aiSettings.model,
        promptUsed: prompt,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to enhance character description: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateSceneTitles(
    storyDescription: string,
    aiSettings: AiSettings,
    userPrompt?: string
  ): Promise<SceneTitlesOutput> {
    const engine = this.getEngineForTool(aiSettings.tool);

    try {
      return await engine.generateSceneTitles(storyDescription, aiSettings, userPrompt);
    } catch (error) {
      throw new Error(`Failed to generate scene titles: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    const engine = this.getEngineForTool(aiSettings.tool);

    try {
      return await engine.generateSceneDetails(sceneTitle, storyContext, aiSettings, userPrompt, storyCharacters, allSceneInfo);
    } catch (error) {
      throw new Error(`Failed to generate scene details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateShotTitles(
    sceneDescription: string,
    aiSettings: AiSettings,
    userPrompt?: string
  ): Promise<ShotTitlesOutput> {
    const engine = this.getEngineForTool(aiSettings.tool);

    try {
      return await engine.generateShotTitles(sceneDescription, aiSettings, userPrompt);
    } catch (error) {
      throw new Error(`Failed to generate shot titles: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateShotDetails(
    sceneContext: string,
    allShotTitles: Array<{title: string, sequence: number}>,
    currentShotSequence: number,
    aiSettings: AiSettings,
    userPrompt?: string
  ): Promise<ShotDetailsOutput> {
    const engine = this.getEngineForTool(aiSettings.tool);
      
      // Find the current shot being generated
      const currentShot = allShotTitles.find(shot => shot.sequence === currentShotSequence);
      if (!currentShot) {
        throw new Error(`Shot with sequence ${currentShotSequence} not found`);
      }
      
    try {
      return await engine.generateShotDetails(
        sceneContext,
        currentShot.title,
        allShotTitles,
        currentShotSequence,
        aiSettings,
        userPrompt
      );
    } catch (error) {
      throw new Error(`Failed to generate shot details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Single image generation method that handles both creation and editing
   * NOTE: This method requires ALL parameters to be provided - no defaults are applied.
   * Parameters must be provided by the caller.
   */
  async generateImage(
    aiSettings: AiSettings,
    options: ImageGenerationOptions
  ): Promise<ImageGenerationResponse> {
    if (!options.prompt || options.prompt.trim().length === 0) {
      throw new Error('Prompt is required for image generation');
    }

    const engine = this.getEngineForTool(aiSettings.tool);
    return await engine.generateImage(aiSettings, options);
  }
}

