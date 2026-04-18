import { useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../client/components/ui/button';

const STORAGE_KEY = 'reddit-auto-refresh';

export function useAutoRefresh() {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  const queryOpts = { refetchOnWindowFocus: enabled } as const;

  return { autoRefresh: enabled, toggleAutoRefresh: toggle, queryOpts };
}

export function AutoRefreshToggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation('reddit-bot');
  return (
    <Button
      type="button"
      variant={enabled ? 'default' : 'outline'}
      size="sm"
      onClick={onToggle}
      title={enabled ? t('autoRefresh.onTitle') : t('autoRefresh.offTitle')}
      className="gap-1.5"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${enabled ? 'animate-spin' : ''}`} />
      <span className="text-xs">{t('autoRefresh.label')}</span>
    </Button>
  );
}
