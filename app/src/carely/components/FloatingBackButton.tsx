import React from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Floating, thumb-reachable back button rendered only on mobile. The
 * existing inline back link at the top of the patient page is still the
 * canonical affordance on desktop — this duplicates it in a spot users
 * can hit without reaching for the top of the screen when the page has
 * scrolled. It sits just above the BottomTabBar and hides on `lg` and
 * larger, matching the visibility rules of the tab bar itself.
 */
export function FloatingBackButton({ to }: { to: string }) {
  const { t } = useTranslation('carely');
  return (
    <Link
      to={to}
      aria-label={t('patient.backToDashboard')}
      // Bottom offset matches BottomTabBar's visual height
      // (~56px content + its own safe-area padding). The small additional
      // gap keeps the FAB visually detached from the bar.
      className="lg:hidden fixed left-4 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 inline-flex items-center justify-center w-11 h-11 rounded-full bg-[color:var(--color-carely-surface-lowest)] border border-[color:var(--color-carely-surface-high)] text-[color:var(--color-carely-on-surface)] shadow-[0_4px_16px_rgba(0,0,0,0.12)] hover:bg-[color:var(--color-carely-surface-low)] active:scale-[0.97] transition-all"
    >
      <ArrowLeft className="w-5 h-5" />
    </Link>
  );
}
