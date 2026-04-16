import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../client/components/ui/dialog';
import { addCarelyVitalLog, updateCarelyVitalLog } from "wasp/client/operations";
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

  useEffect(() => {
    if (isOpen) {
      if (initialLog) {
        setType(initialLog.type);
        setVal1(initialLog.type === 'BLOOD_PRESSURE' ? initialLog.value.systolic : initialLog.value.value);
        if (initialLog.type === 'BLOOD_PRESSURE') setVal2(initialLog.value.diastolic);
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
      if (type === 'BLOOD_PRESSURE') value = { systolic: Number(val1), diastolic: Number(val2), unit: 'mmHg' };
      else if (type === 'GLUCOSE') value = { value: Number(val1), unit: 'mg/dL' }; 
      else if (type === 'TEMPERATURE') value = { value: Number(val1), unit: temperatureUnit || 'F' };
      else if (type === 'SPO2') value = { value: Number(val1), unit: '%' };
      else if (type === 'HEART_RATE') value = { value: Number(val1), unit: 'bpm' };

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
    if (type === 'GLUCOSE') return 'Value (mg/dL)';
    if (type === 'TEMPERATURE') return `Value (°${temperatureUnit || 'F'})`;
    if (type === 'SPO2') return 'Value (%)';
    if (type === 'HEART_RATE') return 'Value (bpm)';
    return 'Value';
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {!initialLog && !hideTrigger && (
        <DialogTrigger asChild>
          <button className="flex items-center gap-2 bg-[color:var(--color-carely-primary)] text-white px-4 py-2 rounded-full font-jakarta font-medium shadow-[0_2px_10px_var(--color-carely-tertiary)] hover:opacity-90">
            <Plus className="w-4 h-4" /> Log Vital
          </button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px] bg-[color:var(--color-carely-surface-lowest)] border-[color:var(--color-carely-surface-high)] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-lexend text-[color:var(--color-carely-on-surface)] text-xl">
            {initialLog ? 'Edit Measurement' : 'Log Measurement'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[color:var(--color-carely-on-surface-variant)] uppercase tracking-wider">Date & Time</label>
            <input required type="datetime-local" value={loggedAt} onChange={e => setLoggedAt(e.target.value)} className="w-full bg-[color:var(--color-carely-surface-low)] border-none rounded-xl p-3 font-jakarta text-[color:var(--color-carely-on-surface)]" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[color:var(--color-carely-on-surface-variant)] uppercase tracking-wider">Type</label>
            <select value={type} onChange={e => {setType(e.target.value); setVal1(''); setVal2('');}} className="w-full bg-[color:var(--color-carely-surface-low)] border-none rounded-xl p-3 font-jakarta text-[color:var(--color-carely-on-surface)]">
              <option value="BLOOD_PRESSURE">Blood Pressure</option>
              <option value="GLUCOSE">Glucose</option>
              <option value="TEMPERATURE">Temperature</option>
              <option value="SPO2">SpO2</option>
              <option value="HEART_RATE">Heart Rate</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[color:var(--color-carely-on-surface-variant)] uppercase tracking-wider">Measurement</label>
            {type === 'BLOOD_PRESSURE' ? (
              <div className="flex gap-4">
                <input required type="number" placeholder="Systolic (mmHg)" value={val1} onChange={e => setVal1(e.target.value)} className="flex-1 bg-[color:var(--color-carely-surface-low)] border-none rounded-xl p-3 font-jakarta text-[color:var(--color-carely-on-surface)]" />
                <input required type="number" placeholder="Diastolic (mmHg)" value={val2} onChange={e => setVal2(e.target.value)} className="flex-1 bg-[color:var(--color-carely-surface-low)] border-none rounded-xl p-3 font-jakarta text-[color:var(--color-carely-on-surface)]" />
              </div>
            ) : (
              <input required type="number" step="0.1" placeholder={getUnitPlaceholder()} value={val1} onChange={e => setVal1(e.target.value)} className="w-full bg-[color:var(--color-carely-surface-low)] border-none rounded-xl p-3 font-jakarta text-[color:var(--color-carely-on-surface)]" />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[color:var(--color-carely-on-surface-variant)] uppercase tracking-wider">Notes</label>
            <textarea placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-[color:var(--color-carely-surface-low)] border-none rounded-xl p-3 font-jakarta text-[color:var(--color-carely-on-surface)] resize-none h-20" />
          </div>
          
          <button disabled={isSubmitting} type="submit" className="mt-4 w-full bg-[color:var(--color-carely-primary)] text-[color:var(--color-carely-on-primary)] font-jakarta font-semibold text-lg py-3 rounded-xl disabled:opacity-50">
            {isSubmitting ? 'Saving...' : 'Save'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
