import React from "react";
import { Check } from "lucide-react";

type SlotCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
};

export function SlotCheckbox({ checked, onChange, label, disabled = false }: SlotCheckboxProps) {
  return (
    <button 
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`flex items-center gap-2 group ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors border-2 ${
        checked 
          ? 'bg-[color:var(--color-carely-primary)] border-[color:var(--color-carely-primary)] text-white' 
          : 'bg-[color:var(--color-carely-surface-lowest)] border-[color:var(--color-carely-surface-high)] text-transparent group-hover:border-[color:var(--color-carely-primary-dim)]'
      }`}>
        <Check className="w-4 h-4" strokeWidth={3} />
      </div>
      {label && <span className={`font-jakarta text-sm ${checked ? 'text-[color:var(--color-carely-on-surface)] font-medium' : 'text-[color:var(--color-carely-on-surface-variant)]'}`}>{label}</span>}
    </button>
  );
}
