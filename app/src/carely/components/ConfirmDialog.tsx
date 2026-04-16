import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../client/components/ui/dialog';

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  isConfirming,
  confirmTone = 'primary',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  isConfirming?: boolean;
  confirmTone?: 'primary' | 'danger';
}) {
  const confirmClass =
    confirmTone === 'danger'
      ? 'bg-[color:var(--color-carely-error)] text-white hover:opacity-90'
      : 'bg-[color:var(--color-carely-primary)] text-white hover:opacity-90';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm bg-[color:var(--color-carely-surface-lowest)] border-[color:var(--color-carely-surface-high)] rounded-2xl">
        <DialogHeader>
          <DialogTitle className={`font-lexend text-lg ${confirmTone === 'danger' ? 'text-[color:var(--color-carely-error)]' : 'text-[color:var(--color-carely-on-surface)]'}`}>
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="font-jakarta text-sm text-[color:var(--color-carely-on-surface-variant)] mt-1">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        <DialogFooter className="mt-4 flex gap-2 sm:gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={!!isConfirming}
            className="flex-1 py-2.5 rounded-xl text-[color:var(--color-carely-on-surface)] bg-[color:var(--color-carely-surface-low)] hover:bg-[color:var(--color-carely-surface-high)] transition-colors font-jakarta font-medium text-sm disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!!isConfirming}
            className={`flex-1 py-2.5 rounded-xl transition-opacity font-jakarta font-semibold text-sm disabled:opacity-50 ${confirmClass}`}
          >
            {isConfirming ? 'Working…' : confirmText}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

