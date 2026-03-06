// App Settings Types
import { AI_TOOLS, AI_TOOL_KEYS } from '../../server/ai/constants';

// Base interface for all settings
export interface AppSetting {
  key: string;
  value: any;
}

// AI Tools Settings
export interface OllamaSettings {
  baseUrl: string;
  defaultModel: string;
  enabled?: boolean;
}

export interface DrawThingsSettings {
  baseUrl: string;
  enabled?: boolean;
}

export interface OpenAISettings {
  OPENAI_API_KEY: string;
  enabled?: boolean;
}

// Settings Tree Structure
export interface SettingsNode {
  key: string;
  name: string;
  children?: SettingsNode[];
  setting?: AppSetting;
  defaultValue?: any;
  type?: 'string' | 'object' | 'array';
}

// App Settings Root
export interface AppSettings {
  aiTools?: {
    [AI_TOOL_KEYS.OLLAMA]?: OllamaSettings;
    [AI_TOOL_KEYS.DRAW_THINGS]?: DrawThingsSettings;
    [AI_TOOL_KEYS.OPENAI]?: OpenAISettings;
  };
}

// Default Settings
export const defaultAppSettings: AppSettings = {
  aiTools: {
    [AI_TOOL_KEYS.OLLAMA]: {
      baseUrl: 'http://localhost:11434',
      defaultModel: 'llama3.2:3b'
    },
    [AI_TOOL_KEYS.DRAW_THINGS]: {
      baseUrl: 'http://localhost:7860'
    },
    [AI_TOOL_KEYS.OPENAI]: {
      OPENAI_API_KEY: ''
    }
  }
};

// Settings Tree Structure
export const settingsTree: SettingsNode[] = [
  {
    key: 'aiTools',
    name: 'AI Tools',
    children: [
      {
        key: `aiTools.${AI_TOOL_KEYS.OLLAMA}`,
        name: AI_TOOLS.OLLAMA,
        setting: {
          key: `aiTools.${AI_TOOL_KEYS.OLLAMA}`,
          value: defaultAppSettings.aiTools?.[AI_TOOL_KEYS.OLLAMA]
        },
        defaultValue: defaultAppSettings.aiTools?.[AI_TOOL_KEYS.OLLAMA],
        type: 'object'
      },
      {
        key: `aiTools.${AI_TOOL_KEYS.DRAW_THINGS}`,
        name: AI_TOOLS.DRAW_THINGS,
        setting: {
          key: `aiTools.${AI_TOOL_KEYS.DRAW_THINGS}`,
          value: defaultAppSettings.aiTools?.[AI_TOOL_KEYS.DRAW_THINGS]
        },
        defaultValue: defaultAppSettings.aiTools?.[AI_TOOL_KEYS.DRAW_THINGS],
        type: 'object'
      },
      {
        key: `aiTools.${AI_TOOL_KEYS.OPENAI}`,
        name: AI_TOOLS.OPENAI,
        setting: {
          key: `aiTools.${AI_TOOL_KEYS.OPENAI}`,
          value: defaultAppSettings.aiTools?.[AI_TOOL_KEYS.OPENAI]
        },
        defaultValue: defaultAppSettings.aiTools?.[AI_TOOL_KEYS.OPENAI],
        type: 'object'
      }
    ]
  },
  {
    key: 'aspectRatios',
    name: 'Aspect Ratios',
    type: 'object'
  }
];
