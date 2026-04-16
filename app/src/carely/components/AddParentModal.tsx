import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../client/components/ui/dialog';
import { createCarelyParent } from "wasp/client/operations";
import { Plus } from "lucide-react";
import toast from 'react-hot-toast';

export function AddParentModal({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setIsSubmitting(true);
    try {
      await createCarelyParent({ name, dateOfBirth: dob ? new Date(dob) : undefined });
      toast.success('Patient added successfully');
      setOpen(false);
      setName(''); setDob('');
      onCreated();
    } catch (e: any) {
      toast.error('Failed to add: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-2 bg-[color:var(--color-carely-primary)] text-white px-4 py-2 rounded-full font-jakarta font-medium shadow-[0_2px_10px_var(--color-carely-tertiary)] hover:opacity-90 transition-opacity">
          <Plus className="w-5 h-5" /> Add Patient
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-[color:var(--color-carely-surface-lowest)] border-[color:var(--color-carely-surface-high)] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-lexend text-[color:var(--color-carely-on-surface)] text-xl">Add New Patient</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div>
            <label className="block font-jakarta text-sm font-medium text-[color:var(--color-carely-on-surface)] mb-1">Full Name</label>
            <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-[color:var(--color-carely-surface-low)] border-none rounded-xl focus:ring-2 focus:ring-[color:var(--color-carely-primary)] p-3 font-jakarta text-[color:var(--color-carely-on-surface)]" placeholder="John Doe" />
          </div>
          <div>
            <label className="block font-jakarta text-sm font-medium text-[color:var(--color-carely-on-surface)] mb-1">Date of Birth (Optional)</label>
            <input type="date" value={dob} onChange={e => setDob(e.target.value)} className="w-full bg-[color:var(--color-carely-surface-low)] border-none rounded-xl focus:ring-2 focus:ring-[color:var(--color-carely-primary)] p-3 font-jakarta text-[color:var(--color-carely-on-surface)]" />
          </div>
          <button disabled={isSubmitting} type="submit" className="mt-4 w-full bg-[color:var(--color-carely-primary)] text-[color:var(--color-carely-on-primary)] font-jakarta font-semibold text-lg py-3 rounded-xl disabled:opacity-50">
            {isSubmitting ? 'Adding...' : 'Save Patient'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
