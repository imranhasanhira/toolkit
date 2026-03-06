/**
 * AI Tool Constants
 * Centralized constants for AI tool names to avoid hardcoded strings
 */

export const AI_TOOLS = {
  OLLAMA: 'Ollama',
  DRAW_THINGS: 'DrawThings',
  OPENAI: 'OpenAI',
} as const;

export type AiToolName = typeof AI_TOOLS[keyof typeof AI_TOOLS];

/**
 * AI Tool Keys (for database/app settings)
 * These are the lowercase keys used in database and configuration
 */
export const AI_TOOL_KEYS = {
  OLLAMA: 'ollama',
  DRAW_THINGS: 'drawThings',
  OPENAI: 'openai',
} as const;

export type AiToolKey = typeof AI_TOOL_KEYS[keyof typeof AI_TOOL_KEYS];

/**
 * AI Categories
 */
export const AI_CATEGORIES = {
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
} as const;

export type AiCategory = typeof AI_CATEGORIES[keyof typeof AI_CATEGORIES];

/**
 * Default AI Models Configuration (one default model per category)
 */
import type { ProjectAiSettings } from './types';

export const defaultAiModels: ProjectAiSettings = {
  text: {
    tool: AI_TOOLS.OLLAMA,
    model: 'llama3.2:3b',
    version: undefined
  },
  image: {
    tool: AI_TOOLS.DRAW_THINGS,
    model: 'default',
    version: "1"
  },
  video: {
    tool: AI_TOOLS.DRAW_THINGS,
    model: 'defaultvideo',
    version: '1'
  }
};
