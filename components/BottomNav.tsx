import React from 'react';
import { Map, List, Compass, AlertTriangle } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'home', label: 'Map', icon: Map },
    { id: 'routes', label: 'Routes', icon: List },
    { id: 'planner', label: 'Plan', icon: Compass },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
  ];

  return (
    <div className="bg-neutral-900 border-t-4 border-neutral-900 pb-safe pt-2 px-6 flex justify-between items-end h-20 w-full fixed bottom-0 z-[9999] shadow-2xl">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center gap-1 pb-4 transition-all duration-200 group relative ${isActive ? 'text-dub-orange' : 'text-neutral-500'}`}
          >
            <div className={`p-1.5 rounded-md transition-all ${isActive ? 'bg-neutral-800 -translate-y-2' : 'group-hover:bg-neutral-800'}`}>
                <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
            </div>
            <span className={`text-[10px] font-black uppercase tracking-widest transition-all ${isActive ? 'text-white -translate-y-1' : 'opacity-0'}`}>
                {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};