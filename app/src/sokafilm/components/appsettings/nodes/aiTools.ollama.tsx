import React from 'react';
import { Input } from '../../../../client/components/ui/input';
import { Label } from '../../../../client/components/ui/label';
import { type OllamaSettings } from '../../../types/appSettings';
import { Switch } from '../../../../client/components/ui/switch';

interface OllamaNodeProps {
  value: OllamaSettings;
  onChange: (value: OllamaSettings) => void;
}

export function OllamaNode({ value, onChange }: OllamaNodeProps) {
  const handleBaseUrlChange = (baseUrl: string) => {
    onChange({
      ...value,
      baseUrl
    });
  };

  const handleDefaultModelChange = (defaultModel: string) => {
    onChange({
      ...value,
      defaultModel
    });
  };

  const handleEnabledChange = (checked: boolean) => {
    onChange({
      ...value,
      enabled: checked
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="enabled">Enable Ollama</Label>
          <p className="text-xs text-gray-500">
            Enable or disable the Ollama AI tool
          </p>
        </div>
        <Switch
          id="enabled"
          checked={value?.enabled ?? false}
          onCheckedChange={handleEnabledChange}
        />
      </div>
      
      {value?.enabled === false && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            ⚠️ Ollama is currently disabled. This tool will not be initialized or used by the AI service.
          </p>
        </div>
      )}
      
      <div>
        <Label htmlFor="baseUrl">Base URL</Label>
        <Input
          id="baseUrl"
          type="text"
          value={value?.baseUrl || ''}
          onChange={(e) => handleBaseUrlChange(e.target.value)}
          placeholder="http://localhost:11434"
          className="mt-1"
        />
        <p className="text-xs text-gray-500 mt-1">
          The base URL for your Ollama server
        </p>
      </div>
      
      <div>
        <Label htmlFor="defaultModel">Default Model</Label>
        <Input
          id="defaultModel"
          type="text"
          value={value?.defaultModel || ''}
          onChange={(e) => handleDefaultModelChange(e.target.value)}
          placeholder="llama3.2:3b"
          className="mt-1"
        />
        <p className="text-xs text-gray-500 mt-1">
          The default model to use for Ollama operations
        </p>
      </div>
    </div>
  );
}
