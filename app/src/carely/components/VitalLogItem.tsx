import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, Thermometer, Droplet, Heart, Wind, ChevronRight, Scale } from 'lucide-react';
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
  HEART_RATE: Heart,
  WEIGHT: Scale,
};

function formatVitalType(type: string): string {
  return type
    .toLowerCase()
    .split('_')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/** Cancel long-press if the pointer moves (e.g. user is scrolling the list). */
const LONG_PRESS_MOVE_PX = 12;

function useLongPress(callback: () => void, ms = 500) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0]?.clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0]?.clientY : e.clientY;
      if (clientX == null || clientY == null) return;
      startPosRef.current = { x: clientX, y: clientY };
      if (timerRef.current) return;
      timerRef.current = setTimeout(() => {
        callbackRef.current();
        timerRef.current = null;
        startPosRef.current = null;
      }, ms);
    },
    [ms]
  );

  const stop = useCallback(() => {
    clearTimer();
    startPosRef.current = null;
  }, [clearTimer]);

  const onMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!startPosRef.current) return;
      const clientX = "touches" in e ? e.touches[0]?.clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0]?.clientY : e.clientY;
      if (clientX == null || clientY == null) return;
      const dx = Math.abs(clientX - startPosRef.current.x);
      const dy = Math.abs(clientY - startPosRef.current.y);
      if (dx > LONG_PRESS_MOVE_PX || dy > LONG_PRESS_MOVE_PX) {
        clearTimer();
        startPosRef.current = null;
      }
    },
    [clearTimer]
  );

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onMouseMove: onMove,
    onTouchStart: start,
    onTouchEnd: stop,
    onTouchCancel: stop,
    onTouchMove: onMove,
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
  const longPressProps = useLongPress(() => setIsConfirmDeleteOpen(true), 600);

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
        {...(canDelete ? longPressProps : {})}
        onClick={() => { if (canEdit) setIsEditOpen(true); }}
        className={`${canEdit ? 'cursor-pointer' : 'cursor-default'} flex items-center gap-3 bg-[color:var(--color-carely-surface-lowest)] px-4 py-3.5 rounded-xl border border-[color:var(--color-carely-surface-high)] shadow-xs hover:border-[color:var(--color-carely-primary)] hover:shadow-sm transition-all active:scale-[0.99] group`}
      >
        <div className="w-11 h-11 rounded-full bg-[color:var(--color-carely-surface-low)] flex items-center justify-center text-[color:var(--color-carely-primary)] shrink-0 group-hover:bg-[color:var(--color-carely-primary)] group-hover:text-white transition-colors">
          <Icon className="w-5.5 h-5.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="font-lexend font-semibold text-[color:var(--color-carely-on-surface)] truncate">
                {formatVitalType(log.type)}
              </h4>
              <p className="font-lexend font-bold text-[color:var(--color-carely-primary)] text-lg leading-tight">
                {valueDisp}
              </p>
            </div>
            <div className="shrink-0 flex items-end gap-1.5">
              <div className="text-right">
                <div className="text-xs font-jakarta text-[color:var(--color-carely-on-surface-variant)]">
                  {dateStr} · {time}
                </div>
                <div className="text-[10px] font-jakarta text-[color:var(--color-carely-on-surface-variant)] truncate max-w-[120px]">
                  {log.loggedByUser?.username ? `by ${log.loggedByUser.username}` : null}
                </div>
              </div>
              {canEdit ? (
                <ChevronRight className="w-4 h-4 text-[color:var(--color-carely-on-surface-variant)] opacity-70" />
              ) : null}
            </div>
          </div>
          {log.notes && (
            <p className="text-xs font-jakarta text-[color:var(--color-carely-on-surface-variant)] mt-2 bg-[color:var(--color-carely-surface-low)] px-3 py-2 rounded-lg">
              {log.notes}
            </p>
          )}
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
