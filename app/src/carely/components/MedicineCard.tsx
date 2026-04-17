import React, { useState } from 'react';
import { DoseString } from './DoseString';
import { SlotCheckbox } from './SlotCheckbox';
import { deactivateCarelyPrescription, logCarelyMedicineIntake, unlogCarelyMedicineIntake } from "wasp/client/operations";
import { Edit2, Trash2 } from "lucide-react";
import toast from 'react-hot-toast';
import { PrescriptionForm } from './PrescriptionForm';
import { ConfirmDialog } from './ConfirmDialog';

export function MedicineCard({
  prescription,
  logs,
  dateStr,
  onUpdate,
  canEditPrescription,
  canLogIntake,
}: {
  prescription: any,
  logs: any[],
  dateStr: string,
  onUpdate: () => void,
  canEditPrescription: boolean,
  canLogIntake: boolean,
}) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const handleToggle = async (slot: string, checked: boolean) => {
    setIsUpdating(true);
    try {
      if (checked) {
        await logCarelyMedicineIntake({ prescriptionId: prescription.id, slot, intakeDateStr: dateStr });
      } else {
        await unlogCarelyMedicineIntake({ prescriptionId: prescription.id, slot, intakeDateStr: dateStr });
      }
      onUpdate();
    } catch (e: any) {
      toast.error('Failed to update: ' + e.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const schedule = prescription.doseSchedule;
  const isCustom = schedule.type === 'custom';

  const slots = ['morning', 'afternoon', 'evening', 'night'];
  const activeSlots = isCustom 
    ? [{ id: 'custom_0', label: 'Done' }]
    : slots.filter(s => schedule[s] > 0).map(s => ({ id: s, label: s.charAt(0).toUpperCase() + s.slice(1) }));

  return (
    <div className="bg-[color:var(--color-carely-surface-lowest)] p-5 rounded-2xl border border-[color:var(--color-carely-surface-high)] shadow-xs relative overflow-hidden group">
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remove prescription?"
        description="This will mark the prescription as inactive. Existing intake history is kept."
        confirmText={isDeleting ? "Removing..." : "Remove"}
        confirmTone="danger"
        isConfirming={isDeleting}
        onConfirm={async () => {
          try {
            setIsDeleting(true);
            await deactivateCarelyPrescription({ id: prescription.id } as any);
            toast.success("Prescription removed");
            setConfirmOpen(false);
            onUpdate();
          } catch (e: any) {
            toast.error("Failed to remove: " + e.message);
          } finally {
            setIsDeleting(false);
          }
        }}
      />
      <div className="absolute top-3 right-3 flex items-center gap-2">
        {!prescription.isActive && (
          <span className="text-[10px] font-jakarta bg-[color:var(--color-carely-surface-low)] text-[color:var(--color-carely-on-surface-variant)] px-2 py-0.5 rounded-full uppercase tracking-widest font-bold">Inactive</span>
        )}
        {canEditPrescription && (
          <>
            {prescription.isActive && (
              <button
                onClick={() => setConfirmOpen(true)}
                className="p-1.5 rounded-full bg-[color:var(--color-carely-surface-low)] text-[color:var(--color-carely-error)] hover:bg-[color:var(--color-carely-error)]/10 transition-colors"
                title="Remove prescription"
                type="button"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setIsEditing(true)}
              className="p-1.5 rounded-full bg-[color:var(--color-carely-surface-low)] text-[color:var(--color-carely-on-surface-variant)] hover:bg-[color:var(--color-carely-primary)]/10 hover:text-[color:var(--color-carely-primary)] transition-colors"
              title="Edit prescription"
              type="button"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
      
      <div
        className={`mb-4 ${canEditPrescription ? 'cursor-pointer' : ''}`}
        onClick={() => { if (canEditPrescription) setIsEditing(true); }}
      >
        <h3 className="font-lexend font-bold text-xl text-[color:var(--color-carely-on-surface)] pr-16 hover:text-[color:var(--color-carely-primary)] transition-colors">{prescription.medicineName}</h3>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <DoseString schedule={schedule} />
          {prescription.doseNote && (
            <span className="text-xs font-jakarta text-[color:var(--color-carely-on-surface-variant)] border-l border-[color:var(--color-carely-surface-high)] pl-2 py-0.5">{prescription.doseNote}</span>
          )}
        </div>
      </div>
      
      {prescription.isActive && (
        <div className="bg-[color:var(--color-carely-surface-low)] rounded-xl p-3 flex flex-wrap gap-x-5 gap-y-3">
          {activeSlots.map(slot => {
            const isChecked = logs.some(l => l.slot === slot.id);
            return (
              <SlotCheckbox 
                key={slot.id} 
                label={slot.label} 
                checked={isChecked} 
                onChange={(c) => handleToggle(slot.id, c)} 
                disabled={isUpdating || !canLogIntake}
              />
            );
          })}
        </div>
      )}

      {isEditing && canEditPrescription && (
        <PrescriptionForm 
          parentId={prescription.parentId} 
          initialRx={prescription}
          open={isEditing} 
          onOpenChange={setIsEditing}
          onCreated={() => { setIsEditing(false); onUpdate(); }} 
        />
      )}
    </div>
  );
}
