import React, { useMemo, useState } from 'react';
import { useQuery, getCarelyVitalLogs, getCarelyVitalCategories } from "wasp/client/operations";
import { useAuth } from 'wasp/client/auth';
import { useTranslation } from 'react-i18next';
import { VitalTypeChip } from '../components/VitalTypeChip';
import { VitalLogItem } from '../components/VitalLogItem';
import { VitalLogForm } from '../components/VitalLogForm';
import { EmptyState } from '../components/EmptyState';
import { Activity, ListFilter, X, Thermometer, Droplet, Heart, Wind, Scale } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../client/components/ui/dialog';
import { vitalDisplayName } from '../utils/vitalLabels';

const TYPE_ICONS: Record<string, any> = {
  BLOOD_PRESSURE: Activity,
  GLUCOSE: Droplet,
  TEMPERATURE: Thermometer,
  SPO2: Wind,
  HEART_RATE: Heart,
  WEIGHT: Scale,
};

export function MeasurementsTab({ parent }: { parent: any }) {
  const { data: user } = useAuth();
  const { t } = useTranslation('carely');
  const [quickAddType, setQuickAddType] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const isOwner = user?.id === parent.createdByUserId;
  const collab = parent.collaborators?.find((c: any) => c.userId === user?.id);
  const canAddVitals = !!(isOwner || collab?.canAddVitals);
  
  // We fetch all logs and filter instantly on the frontend
  const { data: logs, isLoading, refetch } = useQuery(getCarelyVitalLogs, { parentId: parent.id });
  const { data: categories } = useQuery(getCarelyVitalCategories);

  const activeCategories = useMemo(() => {
    const list = (categories ?? []).filter((c: any) => c.isActive !== false);
    return list.sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [categories]);

  const typeLabelByKey = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of activeCategories) map[c.key] = vitalDisplayName(t, c);
    return map;
  }, [activeCategories, t]);

  const orderedTypes = useMemo(() => activeCategories.map((c: any) => c.key), [activeCategories]);

  const displayLogs = logs 
    ? (activeFilters.length > 0 ? logs.filter((l: any) => activeFilters.includes(l.type)) : logs)
    : [];

  const toggleFilter = (type: string) => {
    setActiveFilters(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-lexend font-bold text-[color:var(--color-carely-on-surface)] text-xl">
            {t('measurements.title')}
          </h2>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {activeFilters.length > 0 && (
            <button
              onClick={() => setActiveFilters([])}
              className="h-10 w-10 inline-flex items-center justify-center rounded-xl bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-colors shadow-sm"
              title={t('measurements.clearFilters')}
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <DialogTrigger asChild>
              <button
                className={`h-10 w-10 inline-flex items-center justify-center rounded-xl transition-colors border ${
                  activeFilters.length > 0
                    ? 'bg-[color:var(--color-carely-primary)]/10 text-[color:var(--color-carely-primary)] border-[color:var(--color-carely-primary)]/30'
                    : 'bg-[color:var(--color-carely-surface-lowest)] text-[color:var(--color-carely-on-surface-variant)] border-[color:var(--color-carely-surface-high)]'
                } hover:bg-[color:var(--color-carely-surface-low)] shadow-sm`}
                title={t('measurements.filterMeasurements')}
              >
                <ListFilter className="w-4 h-4" />
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xs bg-[color:var(--color-carely-surface-lowest)] border-[color:var(--color-carely-surface-high)] rounded-2xl">
              <DialogHeader>
                <DialogTitle className="font-lexend text-[color:var(--color-carely-on-surface)] text-lg">
                  {t('measurements.filterTitle')}
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3 mt-4">
                {orderedTypes.map((type: string) => {
                  const isSelected = activeFilters.includes(type);
                  return (
                    <label
                      key={type}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-[color:var(--color-carely-surface-low)] cursor-pointer transition-colors border border-[color:var(--color-carely-surface-high)]"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleFilter(type)}
                        className="w-5 h-5 rounded border-[color:var(--color-carely-surface-high)] text-[color:var(--color-carely-primary)] focus:ring-[color:var(--color-carely-primary)]"
                      />
                      <span className="font-jakarta font-medium text-[color:var(--color-carely-on-surface)]">
                        {typeLabelByKey[type] ?? type.replace('_', ' ')}
                      </span>
                    </label>
                  );
                })}
                <div className="flex gap-2 w-full mt-4">
                  <button
                    onClick={() => setIsFilterOpen(false)}
                    className="w-full bg-[color:var(--color-carely-primary)] text-white font-jakarta font-semibold py-3 rounded-xl shadow-xs hover:opacity-90 transition-opacity"
                  >
                    {activeFilters.length > 0
                      ? t('measurements.apply', { count: activeFilters.length })
                      : t('measurements.applyAllBtn', { value: t('measurements.applyAll') })}
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {canAddVitals && (
            <VitalLogForm
              parentId={parent.id}
              temperatureUnit={parent.temperatureUnit}
              onLogged={refetch}
            />
          )}
        </div>
      </div>

      {canAddVitals && (
        <div className="flex overflow-x-auto no-scrollbar gap-2.5 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          {orderedTypes.map((vt: string) => (
            <VitalTypeChip
              key={vt}
              label={typeLabelByKey[vt] ?? vt.replace('_', ' ')}
              icon={TYPE_ICONS[vt] || Activity}
              selected={false}
              onClick={() => setQuickAddType(vt)}
            />
          ))}
        </div>
      )}

      <div className="space-y-3 pb-20 lg:pb-0">
        {isLoading ? (
          <div className="text-center py-10 font-jakarta text-[color:var(--color-carely-on-surface-variant)]">{t('measurements.loading')}</div>
        ) : displayLogs.length > 0 ? (
          displayLogs.map((log: any) => (
            <VitalLogItem
              key={log.id}
              log={log}
              parentId={parent.id}
              onUpdate={refetch}
              canEdit={canAddVitals}
              isOwner={!!isOwner}
              temperatureUnit={parent.temperatureUnit}
              typeLabel={typeLabelByKey[log.type]}
            />
          ))
        ) : (
          <EmptyState icon={Activity} title={t('measurements.empty.title')} description={t('measurements.empty.description')} />
        )}
      </div>

      {canAddVitals && (
        <VitalLogForm 
          open={!!quickAddType} 
          onOpenChange={(o) => { if (!o) setQuickAddType(null) }} 
          initialType={quickAddType || undefined} 
          parentId={parent.id} 
          temperatureUnit={parent.temperatureUnit}
          onLogged={refetch}
          hideTrigger={true}
        />
      )}
    </div>
  );
}
