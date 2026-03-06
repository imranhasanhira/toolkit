import { AiFileGenerationJob } from 'wasp/server/jobs';
import { AiService } from '../ai/AiService';
import { saveBase64ImageWithMulter, getFilePathFromKey, fileExistsInStorage } from '../utils/multerStorage';
import type { File } from 'wasp/entities';
import type { FileTaskInput } from '../ai/types';

export type AiFileGenerationJobPayload = {
  fileUuid: string;
};

/**
 * Convert input file UUIDs to file paths
 */
async function convertUuidsToFilePaths(
  inputFileUuids: string[],
  context: any
): Promise<string[]> {
  if (!inputFileUuids || inputFileUuids.length === 0) {
    return [];
  }

  const inputFilePaths: string[] = [];

  for (const fileUuid of inputFileUuids) {
    try {
      // Check if file exists in storage
      if (!fileExistsInStorage(fileUuid)) {
        console.warn(`Input file does not exist in storage: ${fileUuid}`);
        continue;
      }

      // Get the full file path using multerStorage - UUID is the filename in storage
      const filePath = getFilePathFromKey(fileUuid);
      inputFilePaths.push(filePath);
      console.log(`✅ Found input file path: ${filePath}`);
    } catch (error) {
      console.error(`❌ Failed to get file path for ${fileUuid}:`, error);
      // Continue with other files even if one fails
    }
  }

  return inputFilePaths;
}

export const processAiFileGeneration: AiFileGenerationJob<AiFileGenerationJobPayload, void> = async (args, context) => {
  const { fileUuid } = args;
  
  console.log(`🎨 Starting AI file generation for fileUuid: ${fileUuid}`);
  
  try {
    // Fetch the file record to get task configuration
    const file = await context.entities.File.findUnique({
      where: { uuid: fileUuid },
      include: { user: true }
    }) as any; // Type assertion to handle the new fields

    if (!file) {
      throw new Error(`File not found with uuid: ${fileUuid}`);
    }

    if (file.status === 'completed') {
      console.log(`File ${fileUuid} already completed, skipping`);
      return;
    }

    // Update status to generating
    await context.entities.File.update({
      where: { uuid: fileUuid },
      data: {
        status: 'generating',
        startedAt: new Date(),
        progress: 0.1
      }
    });

    console.log(`📋 File config - TaskType: ${file.taskType}, ModelConfig: ${JSON.stringify(file.modelConfig)}`);

    // Extract task input and model configuration
    const taskInput = file.taskInput as FileTaskInput;
    const modelConfig = file.modelConfig as any;

    if (!taskInput?.prompt) {
      throw new Error('No prompt found in task input');
    }

    // Initialize AI service
    const aiService = AiService.getInstance();
    
    // Update progress
    await context.entities.File.update({
      where: { uuid: fileUuid },
      data: { progress: 0.3 }
    });

    // Convert input file UUIDs to file paths if provided
    const inputImageFilepaths = taskInput.inputFileUuids 
      ? await convertUuidsToFilePaths(taskInput.inputFileUuids, context)
      : undefined;
      console.log(`✅ Found ${inputImageFilepaths?.length || 0} / ${taskInput.inputFileUuids?.length || 0} input file paths for fileUuid: ${fileUuid}`);

    // Generate the image
    const result = await aiService.generateImage(
      modelConfig, // Pass the AI settings from modelConfig
      {
        prompt: taskInput.prompt,
        negativePrompt: taskInput.negativePrompt,
        width: taskInput.width,
        height: taskInput.height,
        quality: taskInput.quality,
        guidance_scale: taskInput.guidance_scale,
        inputImageFilepaths: inputImageFilepaths,
      }
    );

    if (!result.imageBase64 || result.imageBase64.length === 0) {
      throw new Error('No image data received from AI service');
    }

    // Update progress
    await context.entities.File.update({
      where: { uuid: fileUuid },
      data: { progress: 0.7 }
    });

    // Save the generated image to local storage
    const imageFileName = `${file.uuid}.png`;
    await saveBase64ImageWithMulter(
      result.imageBase64,
      imageFileName,
      file.userId
    );
    console.log(`✅ Saved generated image to local storage: ${getFilePathFromKey(file.uuid)}`);

    // Update file record with completion and correct fileUrl
    await context.entities.File.update({
      where: { uuid: fileUuid },
      data: {
        status: 'completed',
        progress: 1.0,
        completedAt: new Date(),
        fileUrl: `/serve-file/${imageFileName}`,
      }
    });

    console.log(`✅ Image generation completed for ${fileUuid}`);

  } catch (error) {
    console.error(`❌ Error in AI file generation for ${fileUuid}:`, error);
    
    // Update file record with failure
    try {
      await context.entities.File.update({
        where: { uuid: fileUuid },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        }
      });
    } catch (updateError) {
      console.error('Failed to update file record with error:', updateError);
    }

    // Re-throw the error so pgBoss can handle retry logic
    throw error;
  }
};
