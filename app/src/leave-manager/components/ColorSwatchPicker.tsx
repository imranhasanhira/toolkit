import React from 'react';
import { CATEGORY_COLOR_PALETTE, toColorInputValue } from '../colors';

interface ColorSwatchPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export const ColorSwatchPicker: React.FC<ColorSwatchPickerProps> = ({ value, onChange }) => {
  const selected = value.trim().toLowerCase();

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {CATEGORY_COLOR_PALETTE.map((color) => {
        const isSelected = selected === color.toLowerCase();
        return (
          <button
            key={color}
            type="button"
            aria-label={`Use color ${color}`}
            aria-pressed={isSelected}
            onClick={() => onChange(color)}
            className={`h-5 w-5 rounded-full border border-white shadow-sm ${
              isSelected ? 'ring-2 ring-gray-900 ring-offset-1' : ''
            }`}
            style={{ backgroundColor: color }}
          />
        );
      })}
      <label className="inline-flex items-center" title="Custom color">
        <span className="sr-only">Custom color</span>
        <input
          type="color"
          value={toColorInputValue(value)}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="h-6 w-6 cursor-pointer rounded border border-gray-300 bg-transparent p-0"
        />
      </label>
    </div>
  );
};
