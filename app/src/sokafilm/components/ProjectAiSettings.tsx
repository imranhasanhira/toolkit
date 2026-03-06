import React, { useState, useMemo } from 'react';
import { Button } from '../../client/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../client/components/ui/card';
import { Label } from '../../client/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../client/components/ui/select';
import { Loader2, Settings, Brain, Image, Video, FileText } from 'lucide-react';
import { updateProject, getDynamicAiModels, useQuery } from 'wasp/client/operations';
import toast from 'react-hot-toast';
import type { Project } from 'wasp/entities';
import type { AiSettings, ProjectAiSettings } from '../../server/ai/types';
import { AI_TOOLS } from '../../server/ai/constants';
import { defaultAiModels } from '../../server/ai/constants';

interface ProjectAiSettingsProps {
  project: Project;
}

interface EditFormState {
  text: { tool: string; modelIndex: number };
  image: { tool: string; modelIndex: number };
  video: { tool: string; modelIndex: number };
}

export function ProjectAiSettings({ project }: ProjectAiSettingsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  // Fetch dynamic AI models
  const { data: dynamicModels, isLoading: isLoadingModels } = useQuery(getDynamicAiModels);
  
  // Parse current AI settings from project
  const currentSettings: ProjectAiSettings = useMemo(() => {
    console.log('Parsing currentSettings from project:', {
      projectId: project.id,
      rawAiSettings: project.aiSettings,
      type: typeof project.aiSettings
    });
    
    try {
      if (!project.aiSettings) {
        console.log('No AI settings found, using defaults');
        return defaultAiModels;
      }
      
      // Parse the actual project settings
      const parsed = project.aiSettings as unknown as ProjectAiSettings;
      console.log('Parsed AI settings:', parsed);
      
      // Validate that all required fields exist
      if (parsed.text && parsed.image && parsed.video) {
        console.log('All fields present, using parsed settings');
        return parsed;
      }
      
      console.log('Some fields missing, merging with defaults');
      // If some fields are missing, merge with defaults
      const merged = {
        text: parsed.text || defaultAiModels.text,
        image: parsed.image || defaultAiModels.image,
        video: parsed.video || defaultAiModels.video
      };
      console.log('Merged settings:', merged);
      return merged;
    } catch (error) {
      console.error('Failed to parse AI settings:', error);
      // Return defaults only on parsing error
      return defaultAiModels;
    }
  }, [project.aiSettings]);

  // Edit form state - store indices for selection
  const [editForm, setEditForm] = useState<EditFormState>({
    text: { tool: '', modelIndex: -1 },
    image: { tool: '', modelIndex: -1 },
    video: { tool: '', modelIndex: -1 }
  });



  // Initialize edit form when starting to edit
  const startEdit = () => {
    // Find the indices of current models in dynamic models
    const findModelIndex = (category: string, currentSettings: AiSettings) => {
      if (!dynamicModels || !dynamicModels[category]) return -1;
      const categoryModels = dynamicModels[category] as AiSettings[];
      
      console.log(`Finding model index for ${category}:`, {
        currentSettings,
        availableModels: categoryModels,
        dynamicModels: dynamicModels
      });
      
      // Generic model matching: compare tool, model, and version
      // Version match if both are undefined/null/empty, or if they're equal
      const index = categoryModels.findIndex(model => {
        const toolMatch = model.tool === currentSettings.tool;
        const modelMatch = model.model === currentSettings.model;
        const versionMatch = (model.version === currentSettings.version) ||
                            ((!model.version || model.version === '') && (!currentSettings.version || currentSettings.version === ''));
        console.log(`Model matching:`, model, currentSettings, {
          toolMatch,
          modelMatch,
          versionMatch
        });
        return toolMatch && modelMatch && versionMatch;
      });
      console.log(`Model index for ${category}:`, index);
      return index;
    };

    setEditForm({
      text: {
        tool: currentSettings.text.tool || '',
        modelIndex: findModelIndex('text', currentSettings.text)
      },
      image: {
        tool: currentSettings.image.tool || '',
        modelIndex: findModelIndex('image', currentSettings.image)
      },
      video: {
        tool: currentSettings.video.tool || '',
        modelIndex: findModelIndex('video', currentSettings.video)
      }
    });
    setIsEditing(true);
    setValidationErrors([]);
  };

  // Get available tools for a category
  const getAvailableTools = (category: string): string[] => {
    if (!dynamicModels || !dynamicModels[category]) return [];
    const categoryModels = dynamicModels[category] as AiSettings[];
    const tools = [...new Set(categoryModels.map((model: AiSettings) => model.tool))];
    return tools;
  };

  // Get available models for a tool in a category
  const getAvailableModels = (category: string, tool: string): AiSettings[] => {
    if (!dynamicModels || !dynamicModels[category]) return [];
    const categoryModels = dynamicModels[category] as AiSettings[];
    const filteredModels = categoryModels.filter((model: AiSettings) => model.tool === tool);
    
    console.log(`getAvailableModels(${category}, ${tool}):`, {
      categoryModels,
      filteredModels,
      tool
    });
    
    return filteredModels;
  };

  // Handle form field changes
  const handleFormChange = (category: 'text' | 'image' | 'video', field: 'tool' | 'modelIndex', value: string | number) => {
    setEditForm(prev => {
      const newForm = { ...prev };
      
      if (field === 'tool') {
        // When tool changes, reset model index
        newForm[category] = { tool: value as string, modelIndex: -1 };
      } else if (field === 'modelIndex') {
        // When model index changes, just update the index
        newForm[category].modelIndex = value as number;
      }
      
      return newForm;
    });
  };

  // Save changes
  const handleSave = async () => {
    setIsSaving(true);
    setValidationErrors([]);
    
    try {
      // Helper function to get AiSettings from index
      const getAiSettingsFromIndex = (category: string, tool: string, modelIndex: number): AiSettings => {
        if (!dynamicModels || !dynamicModels[category] || modelIndex < 0) {
          throw new Error(`Invalid model selection for ${category}`);
        }
        const categoryModels = dynamicModels[category] as AiSettings[];
        
        // Filter models by tool first
        const availableModels = categoryModels.filter(model => model.tool === tool);
        
        if (modelIndex >= availableModels.length) {
          throw new Error(`Invalid model index for ${category}`);
        }
        
        return availableModels[modelIndex];
      };

      // Create clean AI settings object from indices
      const aiSettings = {
        text: getAiSettingsFromIndex('text', editForm.text.tool, editForm.text.modelIndex),
        image: getAiSettingsFromIndex('image', editForm.image.tool, editForm.image.modelIndex),
        video: getAiSettingsFromIndex('video', editForm.video.tool, editForm.video.modelIndex)
      };

      console.log('Saving AI settings:', aiSettings);
      
      await updateProject({
        id: project.id,
        aiSettings: aiSettings
      });
      
      setIsEditing(false);
      toast.success('AI settings updated successfully!');
    } catch (error: any) {
      console.error('Error updating AI settings:', error);
      
      if (error.message && error.message.includes('Invalid AI settings:')) {
        const errorMessage = error.message.replace('Invalid AI settings: ', '');
        const errors = errorMessage.split('; ');
        setValidationErrors(errors);
      } else {
        setValidationErrors([error.message || 'Failed to update AI settings. Please try again.']);
      }
      
      toast.error('AI settings validation failed. Please check the errors below.');
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel editing
  const handleCancel = () => {
    setIsEditing(false);
    setValidationErrors([]);
  };

  // Get display name for a model
  const getModelDisplayName = (aiSettings: AiSettings): string => {
    if (!dynamicModels) return aiSettings.model;
    
    // Search through all categories to find the matching model
    for (const [category, categoryModels] of Object.entries(dynamicModels)) {
      const models = categoryModels as AiSettings[];
      
      // Generic model matching: compare tool, model, and version
      // Version match if both are undefined/null/empty, or if they're equal
      const model = models.find((m: AiSettings) => {
        const toolMatch = m.tool === aiSettings.tool;
        const modelMatch = m.model === aiSettings.model;
        const versionMatch = (m.version === aiSettings.version) ||
                            ((!m.version || m.version === '') && (!aiSettings.version || aiSettings.version === ''));
        
        return toolMatch && modelMatch && versionMatch;
      });
      
      if (model) {
        if (model.version) {
          return `${model.model} - ${model.version}`;
        } else {
          return model.model;
        }
      }
    }
    
    // Fallback
    return aiSettings.version ? `${aiSettings.model} - ${aiSettings.version}` : aiSettings.model;
  };

  if (isLoadingModels) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading AI models...
        </CardContent>
      </Card>
    );
  }

  if (isEditing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Edit AI Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Text Generation Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <h3 className="font-medium text-blue-900">Text Generation</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
              <div>
                <Label>Tool</Label>
                <Select value={editForm.text.tool} onValueChange={(value) => handleFormChange('text', 'tool', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tool" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableTools('text').map((tool) => (
                      <SelectItem key={tool} value={tool}>{tool}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Model</Label>
                <Select value={editForm.text.modelIndex.toString()} onValueChange={(value) => handleFormChange('text', 'modelIndex', parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableModels('text', editForm.text.tool).map((model, index) => (
                      <SelectItem key={`${model.tool}-${model.model}-${model.version || 'undefined'}`} value={index.toString()}>
                        {model.version ? `${model.model} - ${model.version}` : model.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Image Generation Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Image className="h-4 w-4 text-green-600" />
              <h3 className="font-medium text-green-900">Image Generation</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
              <div>
                <Label>Tool</Label>
                <Select value={editForm.image.tool} onValueChange={(value) => handleFormChange('image', 'tool', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tool" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableTools('image').map((tool) => (
                      <SelectItem key={tool} value={tool}>{tool}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Model</Label>
                <Select value={editForm.image.modelIndex.toString()} onValueChange={(value) => handleFormChange('image', 'modelIndex', parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableModels('image', editForm.image.tool).map((model, index) => (
                      <SelectItem key={`${model.tool}-${model.model}-${model.version || 'undefined'}`} value={index.toString()}>
                        {model.version ? `${model.model} - ${model.version}` : model.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Video Generation Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-purple-600" />
              <h3 className="font-medium text-purple-900">Video Generation</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-6">
              <div>
                <Label>Tool</Label>
                <Select value={editForm.video.tool} onValueChange={(value) => handleFormChange('video', 'tool', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tool" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableTools('video').map((tool) => (
                      <SelectItem key={tool} value={tool}>{tool}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Model</Label>
                <Select value={editForm.video.modelIndex.toString()} onValueChange={(value) => handleFormChange('video', 'modelIndex', parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableModels('video', editForm.video.tool).map((model, index) => (
                      <SelectItem key={`${model.tool}-${model.model}-${model.version || 'undefined'}`} value={index.toString()}>
                        {model.version ? `${model.model} - ${model.version}` : model.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="p-4 border border-red-200 rounded-lg bg-red-50">
              <h4 className="font-medium text-red-800 mb-2">Validation Errors:</h4>
              <ul className="text-sm text-red-700 space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">•</span>
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </Button>
            <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // View mode
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Settings
          </div>
          <Button variant="outline" size="sm" onClick={startEdit}>
            <Settings className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Text Settings Display */}
          <div className="p-3 border rounded-lg bg-blue-50">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-blue-900">Text</span>
            </div>
            <div className="text-sm space-y-1">
              <div><span className="font-medium">Tool:</span> {currentSettings.text.tool}</div>
              <div><span className="font-medium">Model:</span> {getModelDisplayName(currentSettings.text)}</div>
            </div>
          </div>

          {/* Image Settings Display */}
          <div className="p-3 border rounded-lg bg-green-50">
            <div className="flex items-center gap-2 mb-2">
              <Image className="h-4 w-4 text-green-600" />
              <span className="font-medium text-green-900">Image</span>
            </div>
            <div className="text-sm space-y-1">
              <div><span className="font-medium">Tool:</span> {currentSettings.image.tool}</div>
              <div><span className="font-medium">Model:</span> {getModelDisplayName(currentSettings.image)}</div>
            </div>
          </div>

          {/* Video Settings Display */}
          <div className="p-3 border rounded-lg bg-purple-50">
            <div className="flex items-center gap-2 mb-2">
              <Video className="h-4 w-4 text-purple-600" />
              <span className="font-medium text-purple-900">Video</span>
            </div>
            <div className="text-sm space-y-1">
              <div><span className="font-medium">Tool:</span> {currentSettings.video.tool}</div>
              <div><span className="font-medium">Model:</span> {getModelDisplayName(currentSettings.video)}</div>
            </div>
          </div>
        </div>


      </CardContent>
    </Card>
  );
}