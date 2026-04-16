import React from 'react';
import { useQuery, getCarelyParents } from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";
import { Heart } from 'lucide-react';
import { ParentCard } from './components/ParentCard';
import { AddParentModal } from './components/AddParentModal';
import { EmptyState } from './components/EmptyState';

export default function CarelyHomePage() {
  const { data: user } = useAuth();
  const { data: parents, isLoading, refetch } = useQuery(getCarelyParents);

  if (isLoading) return <div className="flex h-[50vh] items-center justify-center font-jakarta text-[color:var(--color-carely-on-surface-variant)]">Loading overview...</div>;

  return (
    <div className="min-h-screen bg-[color:var(--color-carely-surface)] px-4 py-8 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="font-lexend text-3xl font-bold text-[color:var(--color-carely-on-surface)]">Carely</h1>
            <p className="font-jakarta text-[color:var(--color-carely-on-surface-variant)] mt-1">Hello, {user?.username || 'Caregiver'}. Here's the health overview.</p>
          </div>
          <AddParentModal onCreated={refetch} />
        </div>
        
        {parents && parents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {parents.map((parent: any) => (
              <ParentCard 
                key={parent.id} 
                parent={parent} 
                isOwner={parent.createdByUserId === user?.id} 
              />
            ))}
          </div>
        ) : (
          <div className="max-w-md mx-auto mt-16">
            <EmptyState 
              icon={Heart} 
              title="No patients yet" 
              description="Add a patient to start tracking vitals, medications, and health history in one place."
            />
          </div>
        )}
      </div>
    </div>
  );
}
