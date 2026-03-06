import React, { useState, useEffect } from 'react';
import { Button } from '../../../client/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../client/components/ui/card';
import { Separator } from '../../../client/components/ui/separator';
import { Save } from 'lucide-react';
import { updateAppSettings } from 'wasp/client/operations';
import toast from 'react-hot-toast';
import { type SettingsNode } from '../../types/appSettings';
import { AI_TOOL_KEYS } from '../../../server/ai/constants';

interface SingleProps {
  selectedKey: string | null;
  selectedNode: SettingsNode | null;
  settings: any;
  onSettingsChange: (newSettings: any) => void;
  component: React.ComponentType<any> | null;
}

export function AppSettingsSingle({ selectedKey, selectedNode, settings, onSettingsChange, component: Component }: SingleProps) {
  const [localValue, setLocalValue] = useState<any>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Get default value from selected node
  const defaultValue = selectedNode?.defaultValue || null;

  // Update local value when props change
  useEffect(() => {
    if (selectedKey && settings) {
      const currentValue = getCurrentValue(selectedKey, settings);
      console.log('🔄 Single: Updating local value:', {
        selectedKey,
        currentValue,
        defaultValue,
        settings
      });
      setLocalValue(currentValue || defaultValue);
      setHasChanges(false);
    }
  }, [selectedKey, settings, defaultValue]);

  // Check if there are changes
  useEffect(() => {
    if (selectedKey && settings) {
      const currentValue = getCurrentValue(selectedKey, settings);
      const hasLocalChanges = JSON.stringify(localValue) !== JSON.stringify(currentValue || defaultValue);
      setHasChanges(hasLocalChanges);
    }
  }, [localValue, selectedKey, settings, defaultValue]);

  // Get the current value for the selected key
  const getCurrentValue = (key: string, settings: any): any => {
    // The Homepage stores values directly under the key, not nested
    // e.g., settings[`aiTools.${AI_TOOL_KEYS.OLLAMA}`] not settings['aiTools']['ollama']
    return settings[key] || null;
  };

  // Handle value changes
  const handleValueChange = (value: any) => {
    setLocalValue(value);
  };

  // Save setting
  const handleSave = async () => {
    try {
      setIsLoading(true);
      
      // Always save the full object/value for the selected key
      await updateAppSettings({ 
        key: selectedKey!, 
        value: localValue 
      });
      
      // Update parent component
      onSettingsChange({ ...settings, [selectedKey!]: localValue });
      setHasChanges(false);
      toast.success('Setting saved successfully!');
    } catch (error) {
      toast.error(`Failed to save setting: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Render setting editor based on selected key
  const renderSettingEditor = () => {
    if (!selectedKey) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-500">
          Select a setting from the tree to edit
        </div>
      );
    }

    // Render specific node component if available
    if (Component) {
      return (
        <Component
          value={localValue || defaultValue}
          onChange={handleValueChange}
        />
      );
    }

    // Generic input for any other setting value
    if (typeof localValue === 'string') {
      return (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Value</label>
            <input
              type="text"
              value={localValue || ''}
              onChange={(e) => handleValueChange(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              placeholder="Enter value..."
            />
          </div>
        </div>
      );
    }

    // For object/array values, show JSON editor
    return (
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">Value (JSON)</label>
          <textarea
            value={JSON.stringify(localValue, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                handleValueChange(parsed);
              } catch (error) {
                // Invalid JSON, keep the text as is
              }
            }}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            rows={6}
            placeholder="Enter JSON value..."
          />
        </div>
      </div>
    );
  };

  // Helper functions for display names and descriptions
  const getSettingDisplayName = (key: string): string => {
    const keyParts = key.split('.');
    return keyParts[keyParts.length - 1]
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  };

  const getSettingDescription = (key: string): string => {
    return `Configure ${getSettingDisplayName(key)}`;
  };

  return (
    <Card className="h-full rounded-none border-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">
              {selectedKey ? getSettingDisplayName(selectedKey) : 'Settings'}
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              {selectedKey ? getSettingDescription(selectedKey) : 'Select a setting to configure'}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {hasChanges && (
              <span className="text-sm text-orange-600 dark:text-orange-400">
                Unsaved changes
              </span>
            )}
            <div className="flex flex-col items-end space-y-2">
              <Button
                onClick={handleSave}
                disabled={!hasChanges || isLoading}
                size="sm"
              >
                <Save className="h-4 w-4 mr-2" />
                {isLoading ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="pt-6">
        {renderSettingEditor()}
      </CardContent>
    </Card>
  );
}
