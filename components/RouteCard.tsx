import React from 'react';
import { Route } from '../types';
import { Bus, Train, TramFront, ArrowRight, CornerDownRight } from 'lucide-react';

interface RouteCardProps {
  route: Route;
  directionLabel?: string;
  onClick?: () => void;
}

export const RouteCard: React.FC<RouteCardProps> = ({ route, directionLabel, onClick }) => {
  const getIcon = () => {
    const type = parseInt(route.route_type);
    if (type === 0) return <TramFront className="w-5 h-5 text-dub-luas-purple" />;
    if (type === 2) return <Train className="w-5 h-5 text-dub-dart-green" />;
    return <Bus className="w-5 h-5 text-dub-bus-blue" />;
  };

  return (
    <button 
      onClick={onClick}
      className="w-full bg-white rounded-lg p-5 border-2 border-neutral-100 hover:border-neutral-900 transition-all active:scale-[0.99] text-left group relative shadow-sm hover:shadow-md"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-4">
          <div className="bg-neutral-50 p-3 rounded-md border border-neutral-200 shrink-0 group-hover:bg-neutral-900 group-hover:text-white transition-colors">
            {getIcon()}
          </div>
          <div>
            <h3 className="font-black text-3xl text-neutral-900 leading-none tracking-tighter">{route.route_short_name}</h3>
             {directionLabel ? (
               <div className="flex items-center gap-1 mt-1 text-dub-orange font-bold text-[10px] uppercase tracking-widest">
                  <CornerDownRight className="w-3 h-3" />
                  {directionLabel}
               </div>
            ) : (
               <span className="text-xs text-neutral-400 font-mono">SELECT_DIRECTION</span>
            )}
          </div>
        </div>
        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-neutral-50 group-hover:bg-dub-orange group-hover:text-neutral-900 transition-colors">
           <ArrowRight className="w-4 h-4" />
        </div>
      </div>
      
      <div className="text-neutral-500 text-xs font-medium pl-1 border-t border-neutral-100 pt-3 mt-1 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 group-hover:bg-dub-orange"></span>
        {route.route_long_name}
      </div>
    </button>
  );
};