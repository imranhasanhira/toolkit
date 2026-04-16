import React from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router';
import { useQuery, getCarelyParentById } from "wasp/client/operations";
import { ArrowLeft } from 'lucide-react';
import { MeasurementsTab } from './Tabs/MeasurementsTab';
import { MedicineTab } from './Tabs/MedicineTab';
import { StatsTab } from './Tabs/StatsTab';
import { SettingsTab } from './Tabs/SettingsTab';
import { TabSwitcher } from './components/TabSwitcher';
import { BottomTabBar } from './components/BottomTabBar';
import { ParentAvatar } from './components/ParentAvatar';
import { RoleBadge } from './components/RoleBadge';
import { useAuth } from 'wasp/client/auth';
import { Activity, Pill, LineChart, Settings } from 'lucide-react';

export default function CarelyParentPage() {
  const { parentId } = useParams<{ parentId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: user } = useAuth();
  
  // Wasp's query cache mechanism ensures data is auto-updated when mutations occur.
  const { data: parent, isLoading, error } = useQuery(getCarelyParentById, { id: parentId as string }, { enabled: !!parentId });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center font-jakarta text-[color:var(--color-carely-on-surface-variant)] bg-[color:var(--color-carely-surface)]">Loading patient...</div>;
  if (error || !parent) return <div className="min-h-screen flex items-center justify-center font-jakarta text-[color:var(--color-carely-error)] bg-[color:var(--color-carely-surface)]">Patient not found or access denied.</div>;

  const isOwner = user?.id === parent.createdByUserId;

  const query = new URLSearchParams(location.search);
  const activeTab = query.get('tab') || 'measurements';

  const setTab = (tabId: string) => navigate(`?tab=${tabId}`);

  const TABS = [
    { id: 'measurements', label: 'Log Book', icon: <Activity className="w-4 h-4" /> },
    { id: 'medicine', label: 'Medications', icon: <Pill className="w-4 h-4" /> },
    { id: 'stats', label: 'Stats', icon: <LineChart className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[color:var(--color-carely-surface)] flex flex-col relative w-full">
      <div className="flex-1 w-full max-w-4xl mx-auto px-4 lg:px-8 py-8">
        
        {/* Header / Top Panel */}
        <div className="mb-8 relative z-10">
          <Link to="/carely" className="inline-flex items-center gap-2 text-sm font-jakarta text-[color:var(--color-carely-on-surface-variant)] hover:text-[color:var(--color-carely-on-surface)] transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          
          <div className="bg-[color:var(--color-carely-surface-lowest)] p-4 rounded-3xl shadow-sm border border-[color:var(--color-carely-surface-high)] relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-48 h-48 bg-gradient-to-br from-[color:var(--color-carely-primary)]/10 to-transparent rounded-full blur-3xl" />
            
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-4">
                <ParentAvatar name={parent.name} url={parent.avatarUrl} size="md" />
                <div>
                  <h1 className="flex items-center gap-2 font-lexend font-bold text-xl text-[color:var(--color-carely-on-surface)]">
                    {parent.name}
                    <RoleBadge isOwner={isOwner} />
                  </h1>
                  {parent.dateOfBirth && (
                    <p className="font-jakarta text-[color:var(--color-carely-on-surface-variant)] text-sm">
                      {new Date().getFullYear() - new Date(parent.dateOfBirth).getFullYear()} years old
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Desktop Tabs */}
            <div className="hidden lg:block mt-8">
              <TabSwitcher tabs={TABS} activeId={activeTab} onChange={setTab} />
            </div>
          </div>
        </div>

        {/* Tab Content Area */}
        <div className="relative z-0">
          {activeTab === 'measurements' && <MeasurementsTab parent={parent} />}
          {activeTab === 'medicine' && <MedicineTab parent={parent} />}
          {activeTab === 'stats' && <StatsTab parent={parent} />}
          {activeTab === 'settings' && <SettingsTab parent={parent} />}
        </div>

      </div>

      {/* Mobile Tab Bar */}
      <BottomTabBar parentId={parent.id} />
    </div>
  );
}
