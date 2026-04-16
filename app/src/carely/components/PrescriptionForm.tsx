import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../client/components/ui/dialog';
import { createCarelyPrescription, updateCarelyPrescription } from "wasp/client/operations";
import { Plus } from "lucide-react";
import toast from 'react-hot-toast';

export function PrescriptionForm({ parentId, onCreated, initialRx, open, onOpenChange }: { parentId: string, onCreated: () => void, initialRx?: any, open?: boolean, onOpenChange?: (open: boolean) => void }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open !== undefined ? open : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;
  
  const [name, setName] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [morning, setMorning] = useState('1');
  const [afternoon, setAfternoon] = useState('0');
  const [evening, setEvening] = useState('0');
  const [night, setNight] = useState('1');
  const [notes, setNotes] = useState('');
  
  const cycleDose = (val: string) => val === '0' ? '1' : val === '1' ? '2' : '0';
  
  const toLocalIso = (d: Date) => {
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  };

  const [startDate, setStartDate] = useState(toLocalIso(new Date()));
  const [endDate, setEndDate] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      if (initialRx) {
        setName(initialRx.medicineName);
        const s = initialRx.doseSchedule;
        if (s.type === 'custom') {
           setUseCustom(true);
           setNotes(s.notes || '');
        } else {
           setUseCustom(false);
           setMorning(String(s.morning || '0'));
           setAfternoon(String(s.afternoon || '0'));
           setEvening(String(s.evening || '0'));
           setNight(String(s.night || '0'));
           setNotes(initialRx.doseNote || '');
        }
        setStartDate(initialRx.startDate ? toLocalIso(new Date(initialRx.startDate)) : toLocalIso(new Date()));
        setEndDate(initialRx.endDate ? toLocalIso(new Date(initialRx.endDate)) : '');
      } else {
        setName('');
        setUseCustom(false);
        setMorning('1'); setAfternoon('0'); setEvening('0'); setNight('1');
        setNotes('');
        setStartDate(toLocalIso(new Date()));
        setEndDate('');
      }
    }
  }, [isOpen, initialRx]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setIsSubmitting(true);
    try {
      let schedule = {};
      if (useCustom) {
        schedule = { type: 'custom', notes };
      } else {
        schedule = {
          type: 'standard',
          morning: Number(morning),
          afternoon: Number(afternoon),
          evening: Number(evening),
          night: Number(night)
        };
      }
      if (initialRx) {
        await updateCarelyPrescription({
          id: initialRx.id,
          medicineName: name,
          doseSchedule: schedule,
          doseNote: useCustom ? undefined : notes,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : undefined
        });
        toast.success('Medication updated');
      } else {
        await createCarelyPrescription({ 
          parentId, 
          medicineName: name, 
          doseSchedule: schedule, 
          doseNote: useCustom ? undefined : notes,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : undefined
        });
        toast.success('Medication added');
      }
      
      setIsOpen(false);
      onCreated();
    } catch (e: any) {
      toast.error('Failed to add: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {!initialRx && (
        <DialogTrigger asChild>
          <button className="flex items-center gap-2 bg-[color:var(--color-carely-primary)] text-white px-4 py-2 rounded-full font-jakarta font-medium shadow-[0_2px_10px_var(--color-carely-tertiary)] hover:opacity-90">
            <Plus className="w-4 h-4" /> Add prescription
          </button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px] bg-[color:var(--color-carely-surface-lowest)] border-[color:var(--color-carely-surface-high)] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-lexend text-[color:var(--color-carely-on-surface)] text-xl">{initialRx ? 'Edit prescription' : 'New prescription'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
           <input required type="text" placeholder="Medicine Name" value={name} onChange={e => setName(e.target.value)} className="w-full bg-[color:var(--color-carely-surface-low)] border-none rounded-xl p-3 font-jakarta text-[color:var(--color-carely-on-surface)]" />
           
           <div className="grid grid-cols-2 gap-4">
             <div>
               <label className="text-[10px] uppercase text-[color:var(--color-carely-on-surface-variant)] block mb-1 font-semibold pl-1">Start Date</label>
               <input required type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-[color:var(--color-carely-surface-low)] border-none rounded-xl p-3 font-jakarta text-[color:var(--color-carely-on-surface)]" />
             </div>
             <div>
               <label className="text-[10px] uppercase text-[color:var(--color-carely-on-surface-variant)] block mb-1 font-semibold pl-1">End Date (optional)</label>
               <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-[color:var(--color-carely-surface-low)] border-none rounded-xl p-3 font-jakarta text-[color:var(--color-carely-on-surface)]" />
             </div>
           </div>

           <div className="flex items-center gap-2">
             <input type="checkbox" id="customToggle" checked={useCustom} onChange={e => setUseCustom(e.target.checked)} className="rounded text-[color:var(--color-carely-primary)] focus:ring-2 focus:ring-[color:var(--color-carely-primary)] border-[color:var(--color-carely-surface-high)] bg-[color:var(--color-carely-surface-low)] w-4 h-4" />
             <label htmlFor="customToggle" className="text-sm font-jakarta text-[color:var(--color-carely-on-surface)] select-none cursor-pointer">Use custom schedule</label>
           </div>

           {useCustom ? (
             <textarea required placeholder="E.g., Take 4 times a day after meals" value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-[color:var(--color-carely-surface-low)] border-none rounded-xl p-3 font-jakarta text-[color:var(--color-carely-on-surface)] resize-none h-20" />
           ) : (
             <div className="grid grid-cols-4 gap-2">
               <div><label className="text-[10px] uppercase text-[color:var(--color-carely-on-surface-variant)] block text-center mb-1 font-semibold">Morning</label>
                 <button type="button" onClick={() => setMorning(cycleDose(morning))} className={`w-full py-2 rounded-xl text-center font-bold transition-all ${morning !== '0' ? 'bg-[color:var(--color-carely-primary)]/15 text-[color:var(--color-carely-primary)] ring-1 ring-[color:var(--color-carely-primary)]' : 'bg-[color:var(--color-carely-surface-low)] text-[color:var(--color-carely-on-surface-variant)] hover:bg-[color:var(--color-carely-surface-high)]'}`}>
                   {morning === '0' ? '—' : morning}
                 </button></div>
               <div><label className="text-[10px] uppercase text-[color:var(--color-carely-on-surface-variant)] block text-center mb-1 font-semibold">Afternoon</label>
                 <button type="button" onClick={() => setAfternoon(cycleDose(afternoon))} className={`w-full py-2 rounded-xl text-center font-bold transition-all ${afternoon !== '0' ? 'bg-[color:var(--color-carely-primary)]/15 text-[color:var(--color-carely-primary)] ring-1 ring-[color:var(--color-carely-primary)]' : 'bg-[color:var(--color-carely-surface-low)] text-[color:var(--color-carely-on-surface-variant)] hover:bg-[color:var(--color-carely-surface-high)]'}`}>
                   {afternoon === '0' ? '—' : afternoon}
                 </button></div>
               <div><label className="text-[10px] uppercase text-[color:var(--color-carely-on-surface-variant)] block text-center mb-1 font-semibold">Evening</label>
                 <button type="button" onClick={() => setEvening(cycleDose(evening))} className={`w-full py-2 rounded-xl text-center font-bold transition-all ${evening !== '0' ? 'bg-[color:var(--color-carely-primary)]/15 text-[color:var(--color-carely-primary)] ring-1 ring-[color:var(--color-carely-primary)]' : 'bg-[color:var(--color-carely-surface-low)] text-[color:var(--color-carely-on-surface-variant)] hover:bg-[color:var(--color-carely-surface-high)]'}`}>
                   {evening === '0' ? '—' : evening}
                 </button></div>
               <div><label className="text-[10px] uppercase text-[color:var(--color-carely-on-surface-variant)] block text-center mb-1 font-semibold">Night</label>
                 <button type="button" onClick={() => setNight(cycleDose(night))} className={`w-full py-2 rounded-xl text-center font-bold transition-all ${night !== '0' ? 'bg-[color:var(--color-carely-primary)]/15 text-[color:var(--color-carely-primary)] ring-1 ring-[color:var(--color-carely-primary)]' : 'bg-[color:var(--color-carely-surface-low)] text-[color:var(--color-carely-on-surface-variant)] hover:bg-[color:var(--color-carely-surface-high)]'}`}>
                   {night === '0' ? '—' : night}
                 </button></div>
               <div className="col-span-4 mt-2">
                  <input type="text" placeholder="Notes (e.g. after lunch)" value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-[color:var(--color-carely-surface-low)] border-none rounded-xl p-3 font-jakarta text-[color:var(--color-carely-on-surface)]" />
               </div>
             </div>
           )}

          <button disabled={isSubmitting} type="submit" className="mt-4 w-full bg-[color:var(--color-carely-primary)] text-[color:var(--color-carely-on-primary)] font-jakarta font-semibold text-lg py-3 rounded-xl disabled:opacity-50">
            {isSubmitting ? 'Saving...' : 'Save prescription'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
