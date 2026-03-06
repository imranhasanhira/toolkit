import { MiddlewareConfigFn } from "wasp/server";
import multer from "multer";
import path from "path";
import fs from "fs";
import { getStorageDirectory } from "./utils/multerStorage";
import { PrismaClient } from "@prisma/client";
import { AppSettings, defaultAppSettings } from "../sokafilm/types/appSettings";
import { AI_TOOL_KEYS } from "./ai/constants";
import { AiService } from "./ai/AiService";

const prisma = new PrismaClient();

console.log('🚨 serverSetup.ts module is being loaded!');

/** Default app settings with all required fields (used when DB has no settings yet). */
function getDefaultAppSettingsForInit(): AppSettings {
  const ollama = defaultAppSettings.aiTools?.[AI_TOOL_KEYS.OLLAMA];
  const drawThings = defaultAppSettings.aiTools?.[AI_TOOL_KEYS.DRAW_THINGS];
  const openai = defaultAppSettings.aiTools?.[AI_TOOL_KEYS.OPENAI];
  return {
    aiTools: {
      [AI_TOOL_KEYS.OLLAMA]: {
        baseUrl: ollama?.baseUrl ?? 'http://localhost:11434',
        defaultModel: ollama?.defaultModel ?? 'llama3.2:3b',
        enabled: true,
      },
      [AI_TOOL_KEYS.DRAW_THINGS]: {
        baseUrl: drawThings?.baseUrl ?? 'http://localhost:7860',
        enabled: true,
      },
      [AI_TOOL_KEYS.OPENAI]: {
        OPENAI_API_KEY: openai?.OPENAI_API_KEY ?? '',
        enabled: false,
      },
    },
  };
}

// Function to initialize AI service with default settings
async function initializeAiService() {
  try {
    console.log('🤖 Initializing AI Service...');

    // Get default app settings from database or use defaults
    let appSettings: AppSettings | null = null;
    try {
      const ollamaSettings = await prisma.appSetting.findUnique({
        where: { key: `aiTools.${AI_TOOL_KEYS.OLLAMA}` }
      });

      const drawThingsSettings = await prisma.appSetting.findUnique({
        where: { key: `aiTools.${AI_TOOL_KEYS.DRAW_THINGS}` }
      });

      const openaiSettings = await prisma.appSetting.findUnique({
        where: { key: `aiTools.${AI_TOOL_KEYS.OPENAI}` }
      });

      if (ollamaSettings || drawThingsSettings || openaiSettings) {
        appSettings = {
          aiTools: {
            [AI_TOOL_KEYS.OLLAMA]: ollamaSettings ? { ...(ollamaSettings.value as any), enabled: (ollamaSettings.value as any)?.enabled ?? false } : undefined,
            [AI_TOOL_KEYS.DRAW_THINGS]: drawThingsSettings ? { ...(drawThingsSettings.value as any), enabled: (drawThingsSettings.value as any)?.enabled ?? false } : undefined,
            [AI_TOOL_KEYS.OPENAI]: openaiSettings ? { ...(openaiSettings.value as any), enabled: (openaiSettings.value as any)?.enabled ?? false } : undefined
          }
        };

        if (ollamaSettings) {
          const enabled = (ollamaSettings.value as any)?.enabled ?? false;
          console.log(`📝 Ollama: ${enabled ? 'ENABLED' : 'DISABLED'}`);
        }
        if (drawThingsSettings) {
          const enabled = (drawThingsSettings.value as any)?.enabled ?? false;
          console.log(`📝 DrawThings: ${enabled ? 'ENABLED' : 'DISABLED'}`);
        }
        if (openaiSettings) {
          const enabled = (openaiSettings.value as any)?.enabled ?? false;
          console.log(`📝 OpenAI: ${enabled ? 'ENABLED' : 'DISABLED'}`);
        }

        console.log('📝 Using stored app settings for initialization');
      } else {
        console.log('📝 Using default AI settings for initialization');
        appSettings = getDefaultAppSettingsForInit();
      }
    } catch (error) {
      console.log('⚠️ Could not fetch app settings from database, using defaults');
      appSettings = getDefaultAppSettingsForInit();
    }

    const aiService = AiService.getInstance();
    await aiService.initializeWithSettings(appSettings!);

    console.log('✅ AI Service initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize AI Service:', error);
  }
}

initializeAiService().catch(error => {
  console.error('❌ AI Service initialization failed:', error);
});

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = getStorageDirectory();
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

export const addMiddleware: MiddlewareConfigFn = (config) => {
  console.log('🚀 Setting up Multer middleware for file handling...');

  config.set("multer", upload.single("file"));

  console.log('✅ Multer middleware setup complete');
  return config;
};

function getContentType(ext: string): string {
  const contentTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.wmv': 'video/x-ms-wmv',
    '.flv': 'video/x-flv',
    '.webm': 'video/webm',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.json': 'application/json',
  };

  return contentTypes[ext] || 'application/octet-stream';
}

export const uploadFile = async (req: any, res: any) => {
  const file = req.file!;
  return res.json({
    fileExists: !!file,
    filename: file?.filename,
    originalName: file?.originalname,
    size: file?.size,
    mimetype: file?.mimetype
  });
};

export const serveFile = async (req: any, res: any, next: any) => {
  try {
    const filename = req.params.filename;
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    const storageDir = getStorageDirectory();

    let filePath: string | null = null;

    const userDirs = fs.readdirSync(storageDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const userDir of userDirs) {
      const potentialPath = path.join(storageDir, userDir, filename);
      if (fs.existsSync(potentialPath)) {
        filePath = potentialPath;
        break;
      }
    }

    if (!filePath) {
      const rootPath = path.join(storageDir, filename);
      if (fs.existsSync(rootPath)) {
        filePath = rootPath;
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      console.log(`❌ File not found: ${filename}`);
      return res.status(404).json({ error: 'File not found' });
    }

    const ext = path.extname(filename).toLowerCase();
    const contentType = getContentType(ext);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000');

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      console.error('❌ Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error serving file' });
      }
    });

  } catch (error) {
    console.error('❌ Error in serveFile:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};
