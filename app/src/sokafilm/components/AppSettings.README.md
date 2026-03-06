# AppSettings Component

## Overview
The AppSettings component provides a hierarchical tree-based interface for managing application settings. It features a left panel with a collapsible settings tree and a right panel for editing the selected setting.

## Features

### 🎯 Tree Structure
- **Hierarchical Organization**: Settings are organized in a tree structure with expandable/collapsible nodes
- **Dot Notation Keys**: Each setting has a unique key using dot notation (e.g., `aiTools.ollama.baseUrl`)
- **Visual Indicators**: Chevron icons show expand/collapse state, settings icon for leaf nodes

### 🎨 Dual Panel Layout
- **Left Panel**: Settings tree with navigation
- **Right Panel**: Setting editor with form controls
- **Responsive Design**: Adapts to different screen sizes

### ✏️ Editing Capabilities
- **Real-time Updates**: Changes are tracked and enable the save button
- **Type Safety**: Strongly typed settings with proper validation
- **Unsaved Changes**: Visual indicator when settings have been modified

## Usage

### Basic Implementation
```tsx
import { AppSettings } from './components/AppSettings';

function SettingsPage() {
  return (
    <div className="h-screen">
      <AppSettings />
    </div>
  );
}
```

### With Custom Styling
```tsx
<div className="bg-white rounded-lg shadow">
  <AppSettings />
</div>
```

## Settings Structure

### Current Settings
- **AI Tools**
  - **Ollama**: `aiTools.ollama.baseUrl`
  - **DrawThings**: `aiTools.drawThings.baseUrl`

### Adding New Settings
1. **Update Types**: Add new interfaces in `types/appSettings.ts`
2. **Update Tree**: Add new nodes to `settingsTree`
3. **Update Editor**: Add rendering logic in `renderSettingEditor()`

## Technical Details

### State Management
- **Local State**: Component manages its own state for settings and UI
- **Change Tracking**: `hasChanges` flag tracks unsaved modifications
- **Loading States**: Shows loading indicators during save operations

### Backend Integration
- **Operations**: Uses `getAppSettings()` and `updateAppSettings()` operations
- **Error Handling**: Toast notifications for success/error states
- **Async Operations**: Proper loading states and error boundaries

### Tree Navigation
- **Expanded State**: Tracks which tree nodes are expanded
- **Selection State**: Tracks currently selected setting
- **Keyboard Navigation**: Supports click and keyboard interactions

## Styling

### CSS Classes
- **Tailwind CSS**: Uses utility classes for consistent styling
- **Dark Mode**: Supports both light and dark themes
- **Hover States**: Interactive elements have hover effects
- **Focus States**: Proper focus indicators for accessibility

### Responsive Design
- **Fixed Width**: Left panel has fixed width (320px)
- **Flexible Right**: Right panel expands to fill remaining space
- **Mobile Ready**: Adapts to smaller screen sizes

## Future Enhancements

### Planned Features
- **Search**: Add search functionality for large settings trees
- **Bulk Edit**: Edit multiple settings at once
- **Import/Export**: Settings backup and restore
- **Validation**: Client-side validation rules
- **History**: Track setting changes over time

### Extensibility
- **Plugin System**: Allow plugins to add their own settings
- **Custom Editors**: Support for custom setting type editors
- **Conditional Settings**: Show/hide settings based on conditions
- **Dependencies**: Settings that depend on other settings

## Dependencies

### Required Packages
- `react`: Core React library
- `lucide-react`: Icon library
- `react-hot-toast`: Toast notifications
- `@/components/ui/*`: Shadcn UI components

### Optional Enhancements
- `react-query`: For advanced data fetching
- `zustand`: For global state management
- `react-hook-form`: For advanced form handling
