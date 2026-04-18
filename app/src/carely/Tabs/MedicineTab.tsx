import React, { useState, useMemo } from 'react';
import { useQuery, getCarelyPrescriptions, getCarelyMedicineIntakeLogs, getCarelyMedicineLogsByRange } from "wasp/client/operations";
import { Pill, ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MedicineCard } from '../components/MedicineCard';
import { PrescriptionForm } from '../components/PrescriptionForm';
import { EmptyState } from '../components/EmptyState';
import { ProgressBar } from '../components/ProgressBar';
import { MedicineWeekStrip } from '../components/MedicineWeekStrip';

import { useAuth } from 'wasp/client/auth';

function toLocalDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ─── Shared date-range for the adherence queries ─────────────────────────────
function buildMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 2, 1); // 2 months back
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 14);  // buffer forward
  return { start, end };
}

// ─── Status logic (shared by both WeekStrip and CalendarModal) ───────────────
function useAdherenceStatus(parentId: string, prescriptions: any, allLogs: any) {
  const getStatusForDate = (epochMs: number): string => {
    const d = new Date(epochMs);
    d.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);

    if (!prescriptions || !allLogs) return 'LOADING';

    const activeRx = prescriptions.filter((rx: any) => {
      const start = new Date(rx.startDate); start.setHours(0, 0, 0, 0);
      const end = rx.endDate ? new Date(rx.endDate) : null;
      if (end) end.setHours(23, 59, 59, 999);
      return d >= start && (!end || d <= end);
    });

    let totalSlots = 0;
    activeRx.forEach((rx: any) => {
      const s = rx.doseSchedule;
      if (s.type === 'custom') totalSlots += 1;
      else {
        if (s.morning > 0) totalSlots++;
        if (s.afternoon > 0) totalSlots++;
        if (s.evening > 0) totalSlots++;
        if (s.night > 0) totalSlots++;
      }
    });

    if (totalSlots === 0) return 'EMPTY';

    const strDate = toLocalDateKey(d);
    const dateLogs = allLogs.filter(
      (l: any) => toLocalDateKey(new Date(l.intakeDate)) === strDate
    );

    if (dateLogs.length >= totalSlots) return 'TICK';
    if (dateLogs.length > 0) return 'DOT';
    if (d > today) return 'FUTURE';
    return 'CROSS';
  };

  const renderStatusDot = (status: string): React.ReactNode => {
    if (status === 'LOADING') return <div className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-carely-surface-high)] animate-pulse" />;
    if (status === 'EMPTY')   return <div className="w-1.5 h-1.5 rounded-full border border-[color:var(--color-carely-on-surface-variant)] opacity-30" />;
    if (status === 'FUTURE')  return <div className="w-1 h-1 rounded-full bg-[color:var(--color-carely-surface-high)]" />;
    if (status === 'TICK')    return <div className="w-2 h-2 rounded-full bg-[#106A6A]" />;
    if (status === 'DOT')     return <div className="w-2 h-2 rounded-full bg-amber-400" />;
    if (status === 'CROSS')   return <div className="w-2 h-2 rounded-full bg-[#FA746F]" />;
    return null;
  };

  return { getStatusForDate, renderStatusDot };
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────
export function MedicineTab({ parent }: { parent: any }) {
  const { data: user } = useAuth();
  const { t } = useTranslation('carely');
  const [dateOffset, setDateOffset] = useState(0);

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - dateOffset);
  const dateStr = toLocalDateKey(targetDate);

  const { start, end } = useMemo(() => buildMonthRange(), []);

  const { data: prescriptions, refetch: refetchRx } = useQuery(getCarelyPrescriptions, { parentId: parent.id });
  const { data: logs, refetch: refetchLogs } = useQuery(getCarelyMedicineIntakeLogs, { parentId: parent.id, date: dateStr });
  const { data: allLogs } = useQuery(getCarelyMedicineLogsByRange, { parentId: parent.id, startDate: start, endDate: end });

  const isOwner = user?.id === parent.createdByUserId;
  const collab = parent.collaborators?.find((c: any) => c.userId === user?.id);
  const canEditPrescription = isOwner || collab?.canEditPrescription;
  const canLogIntake = isOwner || collab?.canEditPrescription || collab?.canAddVitals;

  const { getStatusForDate, renderStatusDot } = useAdherenceStatus(parent.id, prescriptions, allLogs);

  const handleUpdate = () => refetchLogs();

  const activeRx = prescriptions?.filter((p: any) => p.isActive) || [];

  let totalSlots = 0;
  activeRx.forEach((rx: any) => {
    const s = rx.doseSchedule as any;
    if (s.type === 'custom') totalSlots += 1;
    else {
      if (s.morning > 0) totalSlots++;
      if (s.afternoon > 0) totalSlots++;
      if (s.evening > 0) totalSlots++;
      if (s.night > 0) totalSlots++;
    }
  });

  const completedSlots = logs?.length || 0;
  const overallProgress = totalSlots > 0 ? (completedSlots / totalSlots) * 100 : 0;

  let title = t('medicine.titles.today');
  if (dateOffset === 1) title = t('medicine.titles.yesterday');
  else if (dateOffset === -1) title = t('medicine.titles.tomorrow');
  else if (dateOffset !== 0) {
    title = t('medicine.titles.other', { date: targetDate.toLocaleDateString([], { month: 'short', day: 'numeric' }) });
  }

  return (
    // pb-[148px] = week strip (~72px) + bottom nav (~76px) on mobile; desktop just pb-6
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-[148px] lg:pb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-lexend font-bold text-[color:var(--color-carely-on-surface)] text-xl">{title}</h2>
          <p className="font-jakarta text-sm text-[color:var(--color-carely-on-surface-variant)]">{t('medicine.dosesScheduled', { count: totalSlots })}</p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex bg-[color:var(--color-carely-surface-lowest)] border border-[color:var(--color-carely-surface-high)] rounded-lg overflow-hidden shadow-xs">
            <button onClick={() => setDateOffset(o => o + 1)} className="px-2 py-1 text-[color:var(--color-carely-on-surface-variant)] hover:bg-[color:var(--color-carely-surface-low)] transition-colors border-r border-[color:var(--color-carely-surface-high)]"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setDateOffset(o => o - 1)} className="px-2 py-1 text-[color:var(--color-carely-on-surface-variant)] hover:bg-[color:var(--color-carely-surface-low)] transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="flex-1" />
          {canEditPrescription && <PrescriptionForm parentId={parent.id} onCreated={refetchRx} />}
        </div>
      </div>

      {totalSlots > 0 && (
        <div className="bg-[color:var(--color-carely-surface-lowest)] p-4 rounded-xl shadow-xs border border-[color:var(--color-carely-surface-high)]">
          <div className="flex justify-between text-sm font-jakarta mb-2 font-medium">
            <span className="text-[color:var(--color-carely-on-surface-variant)]">{t('medicine.dailyProgress')}</span>
            <span className="text-[color:var(--color-carely-primary)]">{t('medicine.completedOf', { completed: completedSlots, total: totalSlots })}</span>
          </div>
          <ProgressBar progress={overallProgress} />
        </div>
      )}

      <div className="space-y-4">
        {activeRx.length > 0 ? (
          activeRx.map((rx: any) => {
            const rxLogs = logs?.filter((l: any) => l.prescriptionId === rx.id) || [];
            return (
              <MedicineCard
                key={rx.id}
                prescription={rx}
                logs={rxLogs}
                dateStr={dateStr}
                onUpdate={handleUpdate}
                canEditPrescription={!!canEditPrescription}
                canLogIntake={!!canLogIntake}
              />
            );
          })
        ) : (
          <EmptyState icon={Pill} title={t('medicine.empty.title')} description={t('medicine.empty.description')} />
        )}
      </div>

      {/* ── Adherence bar: stacks above the bottom nav on mobile ── */}
      <MedicineWeekStrip
        parentId={parent.id}
        activeOffset={dateOffset}
        onDateSelect={setDateOffset}
        getStatusForDate={getStatusForDate}
        renderStatusDot={renderStatusDot}
      />
    </div>
  );
}
