import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../client/components/ui/dialog';
import { addCarelyVitalLog, updateCarelyVitalLog, getCarelyAppSettings, getCarelyVitalCategories } from "wasp/client/operations";
import { useQuery } from "wasp/client/operations";
import { Plus } from "lucide-react";
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { vitalDisplayName } from '../utils/vitalLabels';

/**
 * VitalLogForm has two UX modes:
 *
 * - `full` (default): toolbar "Log vital" button. Shows date/time picker,
 *   a type selector, and kind-specific measurement inputs. Used when the
 *   user is backfilling or doesn't know which vital yet.
 * - `quick`: chip-triggered. The type is fixed via `initialType`, the
 *   timestamp defaults to "now" and is not user-editable, and the date +
 *   type rows are hidden. This trims the dialog to just the fields that
 *   change between entries.
 *
 * Edit flow (`initialLog` present) always uses the full form layout so the
 * user can retime a past log.
 *
 * Blood-pressure dialogs get an optional Heart-rate field in both modes,
 * since users usually read both off the same cuff. On save we fan out to
 * two CarelyVitalLog rows — one BP, one HEART_RATE — with matching
 * `loggedAt` and shared notes. If the HR category is absent/inactive the
 * HR field is hidden entirely (no silently-dropped input).
 */
export function VitalLogForm({
  parentId,
  onLogged,
  initialLog,
  initialType,
  temperatureUnit,
  open,
  onOpenChange,
  hideTrigger,
  mode = 'full',
}: {
  parentId: string,
  onLogged: () => void,
  initialLog?: any,
  initialType?: string,
  temperatureUnit?: 'C' | 'F',
  open?: boolean,
  onOpenChange?: (open: boolean) => void,
  hideTrigger?: boolean,
  mode?: 'full' | 'quick',
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { t } = useTranslation('carely');

  const isOpen = open !== undefined ? open : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;

  const [type, setType] = useState('BLOOD_PRESSURE');
  const [val1, setVal1] = useState('');
  const [val2, setVal2] = useState('');
  const [hrVal, setHrVal] = useState('');
  const [notes, setNotes] = useState('');

  const toLocalIso = (d: Date) => {
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().slice(0, 16);
  };
  const [loggedAt, setLoggedAt] = useState(toLocalIso(new Date()));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: categories } = useQuery(getCarelyVitalCategories);
  const { data: appSettings } = useQuery(getCarelyAppSettings);

  const getCategory = (k: string) => (categories ?? []).find((c: any) => c.key === k);
  const currentCategory = getCategory(type);
  const kind = (currentCategory?.kind as string) || (type === 'BLOOD_PRESSURE' ? 'blood_pressure' : 'numeric');
  const hrCategory = getCategory('HEART_RATE');
  const canCaptureHr = kind === 'blood_pressure' && !!hrCategory && hrCategory?.isActive !== false;

  // Edit flow always renders the full layout regardless of `mode`; we need
  // the original timestamp + type to be editable.
  const isQuick = mode === 'quick' && !initialLog;

  useEffect(() => {
    if (isOpen) {
      if (initialLog) {
        setType(initialLog.type);
        const isBP = initialLog.type === 'BLOOD_PRESSURE' || getCategory(initialLog.type)?.kind === 'blood_pressure';
        const isEvent = getCategory(initialLog.type)?.kind === 'event';
        setVal1(isBP ? initialLog.value.systolic : isEvent ? '' : initialLog.value?.value ?? '');
        if (isBP) setVal2(initialLog.value.diastolic);
        setHrVal('');
        setNotes(initialLog.notes || '');
        setLoggedAt(toLocalIso(new Date(initialLog.loggedAt)));
      } else {
        setType(initialType || 'BLOOD_PRESSURE');
        setVal1('');
        setVal2('');
        setHrVal('');
        setNotes('');
        setLoggedAt(toLocalIso(new Date()));
      }
    }
  }, [isOpen, initialLog]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Quick mode doesn't render the datetime picker, so its `loggedAt`
      // state is whatever we seeded when the dialog opened. Stamping fresh
      // here makes the log reflect the actual moment of submission.
      const time = isQuick ? new Date() : new Date(loggedAt);

      let value: any = {};
      if (kind === 'blood_pressure') {
        value = { systolic: Number(val1), diastolic: Number(val2), unit: currentCategory?.unit || 'mmHg' };
      } else if (kind === 'event') {
        value = {};
      } else if (type === 'TEMPERATURE') {
        value = { value: Number(val1), unit: ((appSettings as any)?.temperatureUnit === 'C' ? 'C' : 'F') };
      } else {
        value = { value: Number(val1), unit: currentCategory?.unit || '' };
      }

      if (initialLog) {
        await updateCarelyVitalLog({ id: initialLog.id, type, value, notes, loggedAt: time });
        toast.success(t('vitalLog.toasts.updated'));
      } else {
        await addCarelyVitalLog({ parentId, type, value, notes, loggedAt: time });
        toast.success(t('vitalLog.toasts.logged'));

        // BP+HR fan-out: if the user also entered a heart rate while logging
        // blood pressure, persist a second HEART_RATE log at the same
        // timestamp. We do this only on add (not edit) — editing a BP row
        // shouldn't spawn/modify sibling HR rows behind the user's back.
        if (kind === 'blood_pressure' && canCaptureHr && hrVal.trim() !== '') {
          try {
            await addCarelyVitalLog({
              parentId,
              type: 'HEART_RATE',
              value: { value: Number(hrVal), unit: hrCategory?.unit || 'bpm' },
              notes,
              loggedAt: time,
            });
          } catch (hrErr: any) {
            // BP is already persisted; surface the HR failure without
            // rolling back so the primary reading isn't lost.
            toast.error(
              t('vitalLog.toasts.hrCompanionFailed', {
                reason: hrErr?.message || t('vitalLog.toasts.unknownError'),
              }),
            );
          }
        }
      }
      setIsOpen(false);
      onLogged();
    } catch (e: any) {
      toast.error(t('vitalLog.toasts.saveFailed', { reason: e.message }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUnitPlaceholder = () => {
    if (type === 'TEMPERATURE') {
      const tu = ((appSettings as any)?.temperatureUnit === 'C' ? 'C' : 'F');
      return t('vitalLog.placeholders.valueWithUnit', { unit: `°${tu}` });
    }
    const unit = currentCategory?.unit;
    if (unit) return t('vitalLog.placeholders.valueWithUnit', { unit });
    return t('vitalLog.placeholders.valueNoUnit');
  };

  const dialogTitle = initialLog
    ? t('vitalLog.editTitle')
    : isQuick
      ? t('vitalLog.quickTitle', { name: vitalDisplayName(t, currentCategory ?? { key: type, displayName: type }) })
      : t('vitalLog.logTitle');

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {!initialLog && !hideTrigger && (
        <DialogTrigger asChild>
          <button className="h-10 inline-flex items-center gap-2 bg-[color:var(--color-carely-primary)] text-white px-4 rounded-xl font-jakarta font-semibold shadow-xs hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" /> {t('measurements.logVital')}
          </button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px] bg-[color:var(--color-carely-surface-lowest)] border-[color:var(--color-carely-surface-high)] rounded-2xl">
        <DialogHeader className="pt-1">
          <DialogTitle className="font-lexend text-[color:var(--color-carely-on-surface)] text-xl text-center">
            {dialogTitle}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">

          {!isQuick && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[color:var(--color-carely-on-surface-variant)]">
                {t('vitalLog.labels.dateTime')}
              </label>
              <input
                required
                type="datetime-local"
                value={loggedAt}
                onChange={e => setLoggedAt(e.target.value)}
                className="w-full bg-[color:var(--color-carely-surface-low)] border border-[color:var(--color-carely-surface-high)] rounded-xl px-3 py-2.5 font-jakarta text-[color:var(--color-carely-on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-carely-primary)]"
              />
            </div>
          )}

          {!isQuick && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[color:var(--color-carely-on-surface-variant)]">
                {t('vitalLog.labels.type')}
              </label>
              <select
                value={type}
                onChange={e => {setType(e.target.value); setVal1(''); setVal2(''); setHrVal('');}}
                className="w-full bg-[color:var(--color-carely-surface-low)] border border-[color:var(--color-carely-surface-high)] rounded-xl px-3 py-2.5 font-jakarta text-[color:var(--color-carely-on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-carely-primary)]"
              >
                {(categories ?? [])
                  .filter((c: any) => c.isActive !== false)
                  .slice()
                  .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                  .map((c: any) => (
                    <option key={c.key} value={c.key}>
                      {vitalDisplayName(t, c)}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Event categories have no measurement — fall through to notes. */}
          {kind !== 'event' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[color:var(--color-carely-on-surface-variant)]">
                {t('vitalLog.labels.measurement')}
              </label>
              {kind === 'blood_pressure' ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    required
                    type="number"
                    placeholder={t('vitalLog.placeholders.systolic', { unit: currentCategory?.unit || 'mmHg' })}
                    value={val1}
                    onChange={e => setVal1(e.target.value)}
                    className="w-full bg-[color:var(--color-carely-surface-low)] border border-[color:var(--color-carely-surface-high)] rounded-xl px-3 py-2.5 font-jakarta text-[color:var(--color-carely-on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-carely-primary)]"
                  />
                  <input
                    required
                    type="number"
                    placeholder={t('vitalLog.placeholders.diastolic', { unit: currentCategory?.unit || 'mmHg' })}
                    value={val2}
                    onChange={e => setVal2(e.target.value)}
                    className="w-full bg-[color:var(--color-carely-surface-low)] border border-[color:var(--color-carely-surface-high)] rounded-xl px-3 py-2.5 font-jakarta text-[color:var(--color-carely-on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-carely-primary)]"
                  />
                </div>
              ) : (
                <input
                  required
                  type="number"
                  step="0.1"
                  placeholder={getUnitPlaceholder()}
                  value={val1}
                  onChange={e => setVal1(e.target.value)}
                  className="w-full bg-[color:var(--color-carely-surface-low)] border border-[color:var(--color-carely-surface-high)] rounded-xl px-3 py-2.5 font-jakarta text-[color:var(--color-carely-on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-carely-primary)]"
                />
              )}
            </div>
          )}

          {/* Optional heart-rate companion when logging blood pressure. Only
              rendered when an active HEART_RATE category exists, so nothing
              can be typed in that silently vanishes on save. */}
          {canCaptureHr && !initialLog && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[color:var(--color-carely-on-surface-variant)]">
                {t('vitalLog.labels.heartRate')}
              </label>
              <input
                type="number"
                placeholder={t('vitalLog.placeholders.heartRate', { unit: hrCategory?.unit || 'bpm' })}
                value={hrVal}
                onChange={e => setHrVal(e.target.value)}
                className="w-full bg-[color:var(--color-carely-surface-low)] border border-[color:var(--color-carely-surface-high)] rounded-xl px-3 py-2.5 font-jakarta text-[color:var(--color-carely-on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-carely-primary)]"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[color:var(--color-carely-on-surface-variant)]">
              {t('vitalLog.labels.notes')}
            </label>
            <textarea
              placeholder={t('vitalLog.placeholders.notes')}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-[color:var(--color-carely-surface-low)] border border-[color:var(--color-carely-surface-high)] rounded-xl px-3 py-2.5 font-jakarta text-[color:var(--color-carely-on-surface)] resize-none h-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-carely-primary)]"
            />
          </div>

          <button
            disabled={isSubmitting}
            type="submit"
            className="mt-2 w-full bg-[color:var(--color-carely-primary)] text-[color:var(--color-carely-on-primary)] font-jakarta font-semibold text-base py-2.5 rounded-xl disabled:opacity-50"
          >
            {isSubmitting ? t('vitalLog.saving') : t('vitalLog.save')}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
