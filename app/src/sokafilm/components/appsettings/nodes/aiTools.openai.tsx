import React from 'react';
import { Input } from '../../../../client/components/ui/input';
import { Label } from '../../../../client/components/ui/label';
import { Switch } from '../../../../client/components/ui/switch';
import { type OpenAISettings } from '../../../types/appSettings';

interface OpenAINodeProps {
  value: OpenAISettings;
  onChange: (value: OpenAISettings) => void;
}

export function OpenAINode({ value, onChange }: OpenAINodeProps) {
  const handleApiKeyChange = (OPENAI_API_KEY: string) => {
    onChange({
      ...value,
      OPENAI_API_KEY
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
          <Label htmlFor="enabled">Enable OpenAI</Label>
          <p className="text-xs text-gray-500">
            Enable or disable the OpenAI AI tool
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
            ⚠️ OpenAI is currently disabled. This tool will not be initialized or used by the AI service.
          </p>
        </div>
      )}
      
      <div>
        <Label htmlFor="openaiApiKey">OpenAI API Key</Label>
        <Input
          id="openaiApiKey"
          type="password"
          value={value?.OPENAI_API_KEY || ''}
          onChange={(e) => handleApiKeyChange(e.target.value)}
          placeholder="sk-..."
          className="mt-1"
        />
        <p className="text-xs text-gray-500 mt-1">
          Your OpenAI API key for accessing OpenAI services
        </p>
      </div>
    </div>
  );
}
