import React from 'react';
import { Input } from '../../../../client/components/ui/input';
import { Label } from '../../../../client/components/ui/label';
import { Switch } from '../../../../client/components/ui/switch';
import { type DrawThingsSettings } from '../../../types/appSettings';

interface DrawThingsNodeProps {
  value: DrawThingsSettings;
  onChange: (value: DrawThingsSettings) => void;
}

export function DrawThingsNode({ value, onChange }: DrawThingsNodeProps) {
  const handleBaseUrlChange = (baseUrl: string) => {
    onChange({
      ...value,
      baseUrl
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
          <Label htmlFor="enabled">Enable DrawThings</Label>
          <p className="text-xs text-gray-500">
            Enable or disable the DrawThings AI tool
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
            ⚠️ DrawThings is currently disabled. This tool will not be initialized or used by the AI service.
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
          placeholder="http://localhost:8080"
          className="mt-1"
        />
        <p className="text-xs text-gray-500 mt-1">
          The base URL for your DrawThings server
        </p>
      </div>
    </div>
  );
}
