import { BaseAiEngine } from './BaseAiEngine';
import { AiSettings, SceneTitlesOutput, SceneDetailsOutput, ShotTitlesOutput, ShotDetailsOutput, SceneInfo, ImageGenerationOptions, ImageGenerationResponse } from '../types';
import { AiModelRegistry } from '../AiService';
import { DrawThingsSettings } from '../../../sokafilm/types/appSettings';
import { AI_TOOLS } from '../constants';

export class DrawThingsServerError extends Error {
  constructor(message: string) {
    super(`DrawThings server error: ${message}`);
    this.name = 'DrawThingsServerError';
  }
}





/** Use IPv4 for localhost so Node (which prefers IPv6 for "localhost") can connect to servers listening on 127.0.0.1. */
function normalizeBaseUrl(baseUrl: string): string {
  try {
    const u = new URL(baseUrl);
    if (u.hostname === 'localhost') {
      u.hostname = '127.0.0.1';
      return u.toString().replace(/\/$/, '');
    }
    return baseUrl.replace(/\/$/, '');
  } catch {
    return baseUrl;
  }
}

export class DrawThingsEngine extends BaseAiEngine {
  private baseUrl: string;

  constructor(settings: DrawThingsSettings) {
    super();
    this.baseUrl = normalizeBaseUrl(settings.baseUrl);
  }

  async checkServerAvailability(): Promise<{ available: boolean; message: string }> {
    try {
      // Try to check if DrawThings API is accessible using a simple GET request to the base path
      // Some DrawThings setups might not have the progress endpoint available
      const response = await fetch(`${this.baseUrl}/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      // Accept any response (even 404) as long as we can connect to the server
      // This indicates the server is running, even if specific endpoints vary
      return {
        available: true,
        message: 'DrawThings server is accessible'
      };
    } catch (error) {
      return {
        available: false,
        message: `Failed to connect to DrawThings server: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /** Legacy default options so app default (default/1, defaultvideo/1) always exists in the list. */
  private static readonly FALLBACK_IMAGE = [
    { tool: AI_TOOLS.DRAW_THINGS, model: 'default', version: '1' },
    { tool: AI_TOOLS.DRAW_THINGS, model: 'default', version: '2' }
  ] as const;
  private static readonly FALLBACK_VIDEO = [
    { tool: AI_TOOLS.DRAW_THINGS, model: 'defaultvideo', version: '1' }
  ] as const;

  async getAvailableModels(): Promise<AiModelRegistry> {
    try {
      const response = await fetch(`${this.baseUrl}/sdapi/v1/sd-models`, { method: 'GET' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error('Expected array of models');
      }
      const fromApi = data.map((entry: { title?: string; model_name?: string; hash?: string }) => ({
        tool: AI_TOOLS.DRAW_THINGS,
        model: entry.title ?? entry.model_name ?? 'unknown',
        version: entry.hash ?? undefined
      }));
      if (fromApi.length === 0) {
        throw new Error('No models in response');
      }
      // Prepend legacy defaults so defaultAiModels (default/1, defaultvideo/1) still match
      const image = [...DrawThingsEngine.FALLBACK_IMAGE, ...fromApi];
      const video = [...DrawThingsEngine.FALLBACK_VIDEO];
      console.log(`DrawThings: loaded ${fromApi.length} image model(s) from API (plus legacy defaults)`);
      return { image, video };
    } catch (err) {
      console.warn(`DrawThings: could not load models from API (${err instanceof Error ? err.message : err}), using fallback list.`);
      return {
        image: [...DrawThingsEngine.FALLBACK_IMAGE],
        video: [...DrawThingsEngine.FALLBACK_VIDEO]
      };
    }
  }

  async generateImage(aiSettings: AiSettings, options: ImageGenerationOptions): Promise<ImageGenerationResponse> {
    try {
      // First, check if the server is available
      const serverCheck = await this.checkServerAvailability();
      if (!serverCheck.available) {
        throw new Error(serverCheck.message);
      }

      // If input image file paths are provided, warn and ignore them since DrawThings doesn't support image editing
      if (options.inputImageFilepaths && options.inputImageFilepaths.length > 0) {
        console.warn('DrawThings does not support image editing with input images. Ignoring input images and using regular generation.');
      }

      // Map quality to steps for DrawThings
      const steps = options.quality === 'HIGH' ? 40 : options.quality === 'MEDIUM' ? 24 : 4;

      // Prepare the request payload in DrawThings API format
      const payload = {
        prompt: options.prompt,
        negative_prompt: options.negativePrompt,
        width: options.width,
        height: options.height,
        steps: steps,
        guidance_scale: options.guidance_scale || 7.5,
        seed: -1,
        batch_count: 1,
        sampler_name: 'Euler a'
      };



      const response = await fetch(`${this.baseUrl}/sdapi/v1/txt2img`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new DrawThingsServerError(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      // Check for different possible response formats
      let imageBase64: string | null = null;
      
      if (result && result.images && Array.isArray(result.images) && result.images[0]) {
        // Standard Stable Diffusion API format
        imageBase64 = result.images[0];
      } else if (result && result.data && Array.isArray(result.data) && result.data[0]) {
        // Alternative format with data array
        imageBase64 = result.data[0];
      } else if (result && result.image) {
        // Single image format
        imageBase64 = result.image;
      } else if (result && typeof result === 'string') {
        // Direct base64 string
        imageBase64 = result;
      }

      if (!imageBase64) {
        throw new DrawThingsServerError('Invalid response format from DrawThings server');
      }

      return {
        imageBase64: imageBase64
      };

    } catch (error) {
      console.error('Error in DrawThingsEngine.generateImage:', error);
      
      // Handle specific errors
      if (error instanceof Error) {
        if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
          throw new Error('DrawThings server is not running or accessible. Please start DrawThings with HTTP API enabled.');
        }
        if (error.message.includes('timeout')) {
          throw new Error('Image generation timed out. Try reducing the number of steps or image size.');
        }
      }
      
      throw new Error(`Failed to generate image using DrawThings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }



}
