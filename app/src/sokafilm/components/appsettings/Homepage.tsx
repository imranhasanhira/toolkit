import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../client/components/ui/card';
import { ChevronRight, ChevronDown, Settings } from 'lucide-react';
import { settingsTree, type SettingsNode, type AppSettings } from '../../types/appSettings';
import { getAppSettings } from 'wasp/client/operations';
import { AppSettingsSingle } from './Single';
import { OllamaNode } from './nodes/aiTools.ollama';
import { DrawThingsNode } from './nodes/aiTools.drawThings';
import { OpenAINode } from './nodes/aiTools.openai';
import { AspectRatiosNode } from './nodes/aspectRatios';

// Component mapping
const componentMap: Record<string, React.ComponentType<any>> = {
  'aiTools.ollama': OllamaNode,
  'aiTools.drawThings': DrawThingsNode,
  'aiTools.openai': OpenAINode,
  'aspectRatios': AspectRatiosNode,
};

export default function Homepage() {
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['aiTools']));
  const [settings, setSettings] = useState<any>({});

  // Get the selected node from the tree
  const selectedNode = useMemo(() => {
    if (!selectedKey) return null;
    
    // Find the node in the tree
    const findNode = (nodes: SettingsNode[], key: string): SettingsNode | null => {
      for (const node of nodes) {
        if (node.key === key) return node;
        if (node.children) {
          const found = findNode(node.children, key);
          if (found) return found;
        }
      }
      return null;
    };
    
    return findNode(settingsTree, selectedKey);
  }, [selectedKey]);

  // Get the component for the selected key
  const selectedComponent = useMemo(() => {
    if (!selectedKey) return null;
    return componentMap[selectedKey];
  }, [selectedKey]);

    // Load settings for the selected key generically
  useEffect(() => {
    const loadSettingsForKey = async (key: string) => {
      try {
        // Only load settings if there's a component available to render them
        if (!componentMap[key]) {
          console.log('No component available for key:', key, '- skipping settings load');
          return;
        }

        // Load the value for this specific key
        try {
          const value = await getAppSettings({ key });
          if (value !== null) {
            console.log('✅ Loaded value for key:', key, value);
            setSettings((prev: any) => ({
              ...prev,
              [key]: value
            }));
          } else {
            console.log('ℹ️ No value found for key:', key, '- using default');
          }
        } catch (error) {
          console.log('ℹ️ Setting not found for key:', key, '- using default');
        }
      } catch (error) {
        console.error('Failed to load settings for key:', key, error);
      }
    };

    if (selectedKey) {
      loadSettingsForKey(selectedKey);
    }
  }, [selectedKey]);

  // Handle settings change from child component
  const handleSettingsChange = (newSettings: any) => {
    setSettings(newSettings);
  };



  // Toggle node expansion
  const toggleNode = (key: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedNodes(newExpanded);
  };

  // Render tree node
  const renderTreeNode = (node: SettingsNode, level: number = 0) => {
    const isExpanded = expandedNodes.has(node.key);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedKey === node.key;

    return (
      <div key={node.key}>
        <div
          className={`flex items-center justify-between p-2 cursor-pointer hover:bg-gray-100 rounded ${
            isSelected ? 'bg-blue-100 border-l-4 border-blue-500' : ''
          }`}
          onClick={() => {
            if (hasChildren) {
              toggleNode(node.key);
            } else {
              setSelectedKey(node.key);
            }
          }}
        >
          <div className="flex items-center space-x-2">
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleNode(node.key);
                }}
                className="p-1"
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            )}
            <Settings size={16} className="text-gray-500" />
            <span className="text-sm font-medium">{node.name}</span>
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div className="ml-6">
            {node.children!.map((child) => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full">
      {/* Left Panel - Tree */}
      <div className="w-64 border-r bg-gray-50 p-4">
        <h2 className="text-lg font-semibold mb-4">Settings</h2>
        <div className="space-y-1">
          {settingsTree.map((node) => renderTreeNode(node))}
        </div>
      </div>

      {/* Right Panel - Content */}
      <div className="flex-1 p-4">
        <AppSettingsSingle
          selectedKey={selectedKey}
          selectedNode={selectedNode}
          settings={settings}
          onSettingsChange={handleSettingsChange}
          component={selectedComponent}
        />
      </div>
    </div>
  );
}
