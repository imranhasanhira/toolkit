import React, { useState } from 'react';
import { useQuery, getCarelyVitalLogs } from "wasp/client/operations";
import { useAuth } from 'wasp/client/auth';
import { VitalTypeChip } from '../components/VitalTypeChip';
import { VitalLogItem } from '../components/VitalLogItem';
import { VitalLogForm } from '../components/VitalLogForm';
import { EmptyState } from '../components/EmptyState';
import { Activity, ListFilter, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../client/components/ui/dialog';

const ADD_TYPES = ['BLOOD_PRESSURE', 'GLUCOSE', 'TEMPERATURE', 'SPO2', 'HEART_RATE'];

export function MeasurementsTab({ parent }: { parent: any }) {
  const { data: user } = useAuth();
  const [quickAddType, setQuickAddType] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const isOwner = user?.id === parent.createdByUserId;
  const collab = parent.collaborators?.find((c: any) => c.userId === user?.id);
  const canAddVitals = !!(isOwner || collab?.canAddVitals);
  
  // We fetch all logs and filter instantly on the frontend
  const { data: logs, isLoading, refetch } = useQuery(getCarelyVitalLogs, { parentId: parent.id });

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
      <div className="flex justify-between items-center">
         <div className="flex items-center gap-3">
            <h2 className="font-lexend font-bold text-[color:var(--color-carely-on-surface)] text-xl">Recent Measurements</h2>
            
            <div className="flex items-center gap-2">
              {activeFilters.length > 0 && (
                <button onClick={() => setActiveFilters([])} className="p-2 rounded-xl bg-red-50 text-red-500 border border-red-100 hover:bg-red-100 transition-colors shadow-sm" title="Clear filters">
                  <X className="w-4 h-4" />
                </button>
              )}
              
              <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <DialogTrigger asChild>
                  <button className={`p-2 rounded-xl transition-colors border ${activeFilters.length > 0 ? 'bg-[color:var(--color-carely-primary)]/10 text-[color:var(--color-carely-primary)] border-[color:var(--color-carely-primary)]/30' : 'bg-[color:var(--color-carely-surface-lowest)] text-[color:var(--color-carely-on-surface-variant)] border-[color:var(--color-carely-surface-high)]'} hover:bg-[color:var(--color-carely-surface-low)] shadow-sm`} title="Filter Logs">
                    <ListFilter className="w-4 h-4" />
                  </button>
                </DialogTrigger>
              <DialogContent className="sm:max-w-xs bg-[color:var(--color-carely-surface-lowest)] border-[color:var(--color-carely-surface-high)] rounded-2xl">
                 <DialogHeader>
                   <DialogTitle className="font-lexend text-[color:var(--color-carely-on-surface)] text-lg">Filter Measurements</DialogTitle>
                 </DialogHeader>
                 <div className="flex flex-col gap-3 mt-4">
                   {ADD_TYPES.map(type => {
                     const isSelected = activeFilters.includes(type);
                     return (
                       <label key={type} className="flex items-center gap-3 p-3 rounded-xl hover:bg-[color:var(--color-carely-surface-low)] cursor-pointer transition-colors border border-[color:var(--color-carely-surface-high)]">
                         <input type="checkbox" checked={isSelected} onChange={() => toggleFilter(type)} className="w-5 h-5 rounded border-[color:var(--color-carely-surface-high)] text-[color:var(--color-carely-primary)] focus:ring-[color:var(--color-carely-primary)]" />
                         <span className="font-jakarta font-medium text-[color:var(--color-carely-on-surface)]">{type.replace('_', ' ')}</span>
                       </label>
                     );
                   })}
                   <div className="flex gap-2 w-full mt-4">
                     <button onClick={() => setIsFilterOpen(false)} className="w-full bg-[color:var(--color-carely-primary)] text-white font-jakarta font-semibold py-3 rounded-xl shadow-xs hover:opacity-90 transition-opacity">
                       Apply ({activeFilters.length || 'All'})
                     </button>
                   </div>
                 </div>
              </DialogContent>
            </Dialog>
            </div>
         </div>

         {canAddVitals && <VitalLogForm parentId={parent.id} temperatureUnit={parent.temperatureUnit} onLogged={refetch} />}
      </div>

      {canAddVitals && (
        <div className="flex overflow-x-auto no-scrollbar gap-2 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          {ADD_TYPES.map(vt => (
            <VitalTypeChip key={vt} label={`+ ${vt.replace('_', ' ')}`} selected={false} onClick={() => setQuickAddType(vt)} />
          ))}
        </div>
      )}

      <div className="space-y-3 pb-20 lg:pb-0">
        {isLoading ? (
          <div className="text-center py-10 font-jakarta text-[color:var(--color-carely-on-surface-variant)]">Loading logs...</div>
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
            />
          ))
        ) : (
          <EmptyState icon={Activity} title="No measurements" description="No vitals match your criteria." />
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
