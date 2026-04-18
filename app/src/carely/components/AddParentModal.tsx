import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../client/components/ui/dialog';
import { createCarelyParent } from "wasp/client/operations";
import { Plus } from "lucide-react";
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

export function AddParentModal({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { t } = useTranslation('carely');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setIsSubmitting(true);
    try {
      await createCarelyParent({ name, dateOfBirth: dob ? new Date(dob) : undefined });
      toast.success(t('addParent.toasts.added'));
      setOpen(false);
      setName(''); setDob('');
      onCreated();
    } catch (e: any) {
      toast.error(t('addParent.toasts.addFailed', { reason: e.message }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap bg-[color:var(--color-carely-primary)] text-white px-4 py-2 rounded-full font-jakarta font-medium shadow-[0_2px_10px_var(--color-carely-tertiary)] hover:opacity-90 transition-opacity">
          <Plus className="w-5 h-5 shrink-0" /> {t('addParent.triggerButton')}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-[color:var(--color-carely-surface-lowest)] border-[color:var(--color-carely-surface-high)] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-lexend text-[color:var(--color-carely-on-surface)] text-xl">{t('addParent.title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div>
            <label className="block font-jakarta text-sm font-medium text-[color:var(--color-carely-on-surface)] mb-1">{t('addParent.fullName')}</label>
            <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-[color:var(--color-carely-surface-low)] border-none rounded-xl focus:ring-2 focus:ring-[color:var(--color-carely-primary)] p-3 font-jakarta text-[color:var(--color-carely-on-surface)]" placeholder={t('addParent.fullNamePlaceholder')} />
          </div>
          <div>
            <label className="block font-jakarta text-sm font-medium text-[color:var(--color-carely-on-surface)] mb-1">{t('addParent.dob')}</label>
            <input type="date" value={dob} onChange={e => setDob(e.target.value)} className="w-full bg-[color:var(--color-carely-surface-low)] border-none rounded-xl focus:ring-2 focus:ring-[color:var(--color-carely-primary)] p-3 font-jakarta text-[color:var(--color-carely-on-surface)]" />
          </div>
          <button disabled={isSubmitting} type="submit" className="mt-4 w-full bg-[color:var(--color-carely-primary)] text-[color:var(--color-carely-on-primary)] font-jakarta font-semibold text-lg py-3 rounded-xl disabled:opacity-50">
            {isSubmitting ? t('addParent.saving') : t('addParent.save')}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
