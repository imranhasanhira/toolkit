import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, Thermometer, Droplet, Heart, Wind } from 'lucide-react';
import { deleteCarelyVitalLog } from 'wasp/client/operations';
import { useAuth } from 'wasp/client/auth';
import { VitalLogForm } from './VitalLogForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../client/components/ui/dialog';
import toast from 'react-hot-toast';

const TYPE_ICONS: Record<string, any> = {
  BLOOD_PRESSURE: Activity,
  GLUCOSE: Droplet,
  TEMPERATURE: Thermometer,
  SPO2: Wind,
  HEART_RATE: Heart
};

function useLongPress(callback: () => void, ms = 500) {
  const timerRef = useRef<any>(null);
  const callbackRef = useRef(callback);
  
  useEffect(() => { 
    callbackRef.current = callback; 
  }, [callback]);

  const start = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setTimeout(() => {
      callbackRef.current();
      timerRef.current = null;
    }, ms);
  }, [ms]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: start,
    onTouchEnd: stop,
    onTouchCancel: stop,
  };
}

export function VitalLogItem({
  log,
  parentId,
  onUpdate,
  canEdit,
  isOwner,
  temperatureUnit,
}: {
  log: any,
  parentId: string,
  onUpdate: () => void,
  canEdit: boolean,
  isOwner?: boolean,
  temperatureUnit?: 'C' | 'F',
}) {
  const { data: user } = useAuth();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  const canDelete = !!(user?.id && (user.id === log.loggedByUserId || isOwner));
  const longPressProps = useLongPress(() => {
    if (!canDelete) return;
    setIsConfirmDeleteOpen(true);
  }, 600);

  const handleDelete = async () => {
    try {
      await deleteCarelyVitalLog({ id: log.id });
      toast.success('Measurement deleted');
      setIsConfirmDeleteOpen(false);
      onUpdate();
    } catch (err: any) {
      toast.error('Failed to delete: ' + err.message);
    }
  };

  const Icon = TYPE_ICONS[log.type] || Activity;
  
  // Create local, display-friendly date
  const dateObj = new Date(log.loggedAt);
  const isToday = new Date().toDateString() === dateObj.toDateString();
  const time = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = isToday ? 'Today' : dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });

  let valueDisp = '';
  if (log.type === 'BLOOD_PRESSURE') valueDisp = `${log.value.systolic}/${log.value.diastolic} ${log.value.unit}`;
  else valueDisp = `${log.value.value} ${log.value.unit}`;

  return (
    <>
      <div 
        {...longPressProps}
        onClick={() => { if (canEdit) setIsEditOpen(true); }}
        className={`${canEdit ? 'cursor-pointer' : 'cursor-default'} flex items-center gap-4 bg-[color:var(--color-carely-surface-lowest)] p-4 rounded-xl border border-[color:var(--color-carely-surface-high)] shadow-xs hover:border-[color:var(--color-carely-primary)] hover:shadow-sm transition-all active:scale-[0.99] group`}
      >
        <div className="w-12 h-12 rounded-full bg-[color:var(--color-carely-surface-low)] flex items-center justify-center text-[color:var(--color-carely-primary)] shrink-0 group-hover:bg-[color:var(--color-carely-primary)] group-hover:text-white transition-colors">
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0 pointer-events-none">
          <div className="flex justify-between items-start">
            <h4 className="font-lexend font-semibold text-[color:var(--color-carely-on-surface)] truncate pr-2">{log.type.replace('_', ' ')}</h4>
            <span className="text-xs font-jakarta text-[color:var(--color-carely-on-surface-variant)] shrink-0">{dateStr}, {time}</span>
          </div>
          <div className="flex justify-between items-end mt-0.5">
            <p className="font-lexend font-bold text-[color:var(--color-carely-primary)] text-lg">{valueDisp}</p>
            <p className="text-[10px] font-jakarta text-[color:var(--color-carely-on-surface-variant)] truncate">by {log.loggedByUser?.username}</p>
          </div>
          {log.notes && <p className="text-xs font-jakarta text-[color:var(--color-carely-on-surface-variant)] mt-2 bg-[color:var(--color-carely-surface-low)] p-2 rounded-lg">{log.notes}</p>}
        </div>
      </div>

      {isEditOpen && (
        <VitalLogForm 
          open={isEditOpen} 
          onOpenChange={setIsEditOpen} 
          parentId={parentId} 
          initialLog={log} 
          temperatureUnit={temperatureUnit}
          onLogged={onUpdate} 
        />
      )}

      {isConfirmDeleteOpen && canDelete && (
        <Dialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
          <DialogContent className="sm:max-w-xs bg-[color:var(--color-carely-surface-lowest)] border-[color:var(--color-carely-surface-high)] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="font-lexend text-[color:var(--color-carely-error)] text-lg">Delete Log?</DialogTitle>
              <DialogDescription className="font-jakarta text-sm text-[color:var(--color-carely-on-surface-variant)] mt-1">
                Are you sure you want to permanently delete this {log.type.replace('_', ' ')} measurement? This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4 flex gap-2">
              <button onClick={() => setIsConfirmDeleteOpen(false)} className="flex-1 py-2 rounded-xl text-[color:var(--color-carely-on-surface)] bg-[color:var(--color-carely-surface-low)] hover:bg-[color:var(--color-carely-surface-high)] transition-colors font-jakarta font-medium text-sm">
                Cancel
              </button>
              <button onClick={handleDelete} className="flex-1 py-2 rounded-xl text-[color:var(--color-carely-error)] bg-[color:var(--color-carely-error)]/10 hover:bg-[color:var(--color-carely-error)] hover:text-white transition-colors font-jakarta font-semibold text-sm">
                Delete
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
