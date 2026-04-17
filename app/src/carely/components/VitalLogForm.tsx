import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../client/components/ui/dialog';
import { addCarelyVitalLog, updateCarelyVitalLog, getCarelyAppSettings, getCarelyVitalCategories } from "wasp/client/operations";
import { useQuery } from "wasp/client/operations";
import { Plus } from "lucide-react";
import toast from 'react-hot-toast';

export function VitalLogForm({
  parentId,
  onLogged,
  initialLog,
  initialType,
  temperatureUnit,
  open,
  onOpenChange,
  hideTrigger,
}: {
  parentId: string,
  onLogged: () => void,
  initialLog?: any,
  initialType?: string,
  temperatureUnit?: 'C' | 'F',
  open?: boolean,
  onOpenChange?: (open: boolean) => void,
  hideTrigger?: boolean,
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  
  const isOpen = open !== undefined ? open : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;

  const [type, setType] = useState('BLOOD_PRESSURE');
  const [val1, setVal1] = useState('');
  const [val2, setVal2] = useState('');
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

  useEffect(() => {
    if (isOpen) {
      if (initialLog) {
        setType(initialLog.type);
        const isBP = initialLog.type === 'BLOOD_PRESSURE' || getCategory(initialLog.type)?.kind === 'blood_pressure';
        setVal1(isBP ? initialLog.value.systolic : initialLog.value.value);
        if (isBP) setVal2(initialLog.value.diastolic);
        setNotes(initialLog.notes || '');
        setLoggedAt(toLocalIso(new Date(initialLog.loggedAt)));
      } else {
        setType(initialType || 'BLOOD_PRESSURE');
        setVal1('');
        setVal2('');
        setNotes('');
        setLoggedAt(toLocalIso(new Date()));
      }
    }
  }, [isOpen, initialLog]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let value: any = {};
      if (kind === 'blood_pressure') value = { systolic: Number(val1), diastolic: Number(val2), unit: currentCategory?.unit || 'mmHg' };
      else if (type === 'TEMPERATURE') value = { value: Number(val1), unit: ((appSettings as any)?.temperatureUnit === 'C' ? 'C' : 'F') };
      else value = { value: Number(val1), unit: currentCategory?.unit || '' };

      const time = new Date(loggedAt);

      if (initialLog) {
        await updateCarelyVitalLog({ id: initialLog.id, type, value, notes, loggedAt: time });
        toast.success('Measurement updated');
      } else {
        await addCarelyVitalLog({ parentId, type, value, notes, loggedAt: time });
        toast.success('Measurement logged');
      }
      setIsOpen(false);
      onLogged();
    } catch (e: any) {
      toast.error('Failed to save vitals: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUnitPlaceholder = () => {
    if (type === 'TEMPERATURE') {
      const tu = ((appSettings as any)?.temperatureUnit === 'C' ? 'C' : 'F');
      return `Value (°${tu})`;
    }
    const unit = currentCategory?.unit;
    if (unit) return `Value (${unit})`;
    return 'Value';
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {!initialLog && !hideTrigger && (
        <DialogTrigger asChild>
          <button className="h-10 inline-flex items-center gap-2 bg-[color:var(--color-carely-primary)] text-white px-4 rounded-xl font-jakarta font-semibold shadow-xs hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" /> Log vital
          </button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px] bg-[color:var(--color-carely-surface-lowest)] border-[color:var(--color-carely-surface-high)] rounded-2xl">
        <DialogHeader className="pt-1">
          <DialogTitle className="font-lexend text-[color:var(--color-carely-on-surface)] text-xl text-center">
            {initialLog ? 'Edit measurement' : 'Log measurement'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[color:var(--color-carely-on-surface-variant)]">
              Date & time
            </label>
            <input
              required
              type="datetime-local"
              value={loggedAt}
              onChange={e => setLoggedAt(e.target.value)}
              className="w-full bg-[color:var(--color-carely-surface-low)] border border-[color:var(--color-carely-surface-high)] rounded-xl px-3 py-2.5 font-jakarta text-[color:var(--color-carely-on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-carely-primary)]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[color:var(--color-carely-on-surface-variant)]">
              Type
            </label>
            <select
              value={type}
              onChange={e => {setType(e.target.value); setVal1(''); setVal2('');}}
              className="w-full bg-[color:var(--color-carely-surface-low)] border border-[color:var(--color-carely-surface-high)] rounded-xl px-3 py-2.5 font-jakarta text-[color:var(--color-carely-on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-carely-primary)]"
            >
              {(categories ?? [])
                .filter((c: any) => c.isActive !== false)
                .slice()
                .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                .map((c: any) => (
                  <option key={c.key} value={c.key}>
                    {c.displayName}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[color:var(--color-carely-on-surface-variant)]">
              Measurement
            </label>
            {kind === 'blood_pressure' ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  required
                  type="number"
                  placeholder={`Systolic (${currentCategory?.unit || 'mmHg'})`}
                  value={val1}
                  onChange={e => setVal1(e.target.value)}
                  className="w-full bg-[color:var(--color-carely-surface-low)] border border-[color:var(--color-carely-surface-high)] rounded-xl px-3 py-2.5 font-jakarta text-[color:var(--color-carely-on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-carely-primary)]"
                />
                <input
                  required
                  type="number"
                  placeholder={`Diastolic (${currentCategory?.unit || 'mmHg'})`}
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

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[color:var(--color-carely-on-surface-variant)]">
              Notes
            </label>
            <textarea
              placeholder="Notes (optional)"
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
            {isSubmitting ? 'Saving...' : 'Save'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
