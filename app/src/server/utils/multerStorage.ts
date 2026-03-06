import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';

/**
 * Configure multer storage for local file storage
 */
const storage = multer.diskStorage({
  destination: (req: any, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    // Get user ID from request (assuming it's set by auth middleware)
    const userId = req.user?.id || 'anonymous';
    
    // Create storage directory structure
    const storageDir = getStorageDirectory();
    const userDir = path.join(storageDir, userId);
    
    // Ensure directory exists
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    
    cb(null, userDir);
  },
  filename: (req: any, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    // Generate unique filename
    const fileUuid = randomUUID();
    const ext = path.extname(file.originalname) || '.png';
    const filename = `${fileUuid}${ext}`;
    
    cb(null, filename);
  }
});

/**
 * File filter to validate file types
 */
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allow only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

/**
 * Configure multer with storage and file filter
 */
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only allow 1 file at a time
  }
});

/**
 * Get the correct storage directory path for Wasp
 */
export function getStorageDirectory(): string {
  // Try multiple possible paths for Wasp compatibility
  const possiblePaths = [
    // For development: use a relative path from the project root
    path.join(process.cwd(), '..', 'generated_images'),
    // For production builds: use the build directory
    path.join(process.cwd(), 'generated_images'),
    // Fallback: use current working directory
    path.join(process.cwd(), 'generated_images'),
  ];

  for (const storagePath of possiblePaths) {
    try {
      // Ensure the directory exists
      if (!fs.existsSync(storagePath)) {
        fs.mkdirSync(storagePath, { recursive: true });
      }
      
      // Test if we can write to it
      const testFile = path.join(storagePath, '.test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      
      return storagePath;
    } catch (error) {
      continue;
    }
  }
  
  // If all else fails, use the current working directory
  const fallbackPath = path.join(process.cwd(), 'generated_images');
  if (!fs.existsSync(fallbackPath)) {
    fs.mkdirSync(fallbackPath, { recursive: true });
  }
  return fallbackPath;
}

/**
 * Save base64 image data using multer-compatible approach
 */
export async function saveBase64ImageWithMulter(
  base64Data: string,
  fileName: string,
  userId: string
): Promise<{ filePath: string }> {
  try {
    // Remove data URL prefix if present
    const base64Image = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    
    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64Image, 'base64');
    
    // Get storage directory
    const storageDir = getStorageDirectory();
    
    // IMPORTANT: Save file directly in storage directory (no user subdirectories)
    // This matches the file serving middleware path exactly
    const filePath = path.join(storageDir, fileName);
    fs.writeFileSync(filePath, imageBuffer);
    
    console.log(`💾 Saved image to: ${filePath}`);
    console.log(`📁 Storage directory: ${storageDir}`);
    console.log(`📄 Filename: ${fileName}`);
    
    return { filePath };
  } catch (error) {
    console.error('Error saving image with multer approach:', error);
    throw new Error(`Failed to save image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get file path for a storage key (now just filename)
 */
export function getFilePathFromKey(key: string): string {
  const storageDir = getStorageDirectory();
  return path.join(storageDir, key) + '.png';
}

/**
 * Check if a file exists in storage
 */
export function fileExistsInStorage(key: string): boolean {
  try {
    const filePath = getFilePathFromKey(key);
    return fs.existsSync(filePath);
  } catch (error) {
    console.error('Error checking if file exists:', error);
    return false;
  }
}

/**
 * Delete a file from storage
 */
export function deleteFileFromStorage(key: string): boolean {
  try {
    const filePath = getFilePathFromKey(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting file from storage:', error);
    return false;
  }
}

/**
 * Read file as base64 from storage
 */
export function readFileAsBase64FromStorage(key: string): string | null {
  try {
    const filePath = getFilePathFromKey(key);
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      return buffer.toString('base64');
    }
    return null;
  } catch (error) {
    console.error('Error reading file from storage:', error);
    return null;
  }
}
