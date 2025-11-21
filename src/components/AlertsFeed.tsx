import React, { useEffect, useState } from 'react';
import { generateSimulatedAlerts } from '../services/geminiService';
import { ServiceAlert } from '../types';
import { RefreshCw, AlertOctagon, CloudRain, Calendar, ShieldAlert } from 'lucide-react';

export const AlertsFeed: React.FC = () => {
  const [alerts, setAlerts] = useState<ServiceAlert[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
        // Use Gemini to generate realistic alerts instead of fetching from restricted DB
        const newAlerts = await generateSimulatedAlerts();
        setAlerts(newAlerts);
    } catch (e) {
        console.error("Failed to fetch alerts", e);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const getIcon = (category?: string) => {
    switch (category) {
        case 'ACCIDENT': return <AlertOctagon className="w-4 h-4 text-dub-orange" />;
        case 'WEATHER': return <CloudRain className="w-4 h-4 text-dub-orange" />;
        case 'EVENT': return <Calendar className="w-4 h-4 text-dub-orange" />;
        default: return <ShieldAlert className="w-4 h-4 text-dub-orange" />;
    }
  };

  return (
    <div className="flex flex-col h-full px-6 pt-6">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div className="flex items-center gap-2">
           <span className="w-2 h-2 bg-dub-orange rounded-full animate-pulse"></span>
           <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">System Status: Live</span>
        </div>
        <button 
            onClick={fetchAlerts}
            disabled={loading}
            className="p-2 hover:bg-neutral-200 rounded-full transition-colors disabled:opacity-50"
        >
            <RefreshCw className={`w-4 h-4 text-neutral-900 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-4 overflow-y-auto custom-scrollbar pb-28 flex-1 -mx-2 px-2">
        {alerts.length === 0 && !loading && (
            <div className="bg-white border-2 border-dashed border-neutral-200 rounded-xl p-8 text-center">
                <p className="text-neutral-400 font-bold">No active alerts detected.</p>
            </div>
        )}
        
        {alerts.map((alert, index) => (
          <div key={alert.alert_id || index} className="bg-white border-2 border-neutral-100 rounded-xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md hover:border-neutral-300 transition-all">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-neutral-50 rounded-md border border-neutral-100">
                        {getIcon(alert.category)}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                        {alert.category ?? "GENERAL"}
                    </span>
                </div>
                {alert.severity && (
                    <span className={`text-[10px] font-bold px-2 py-1 rounded border ${
                        alert.severity === 'HIGH' 
                        ? 'bg-dub-orange/10 text-dub-black border-dub-orange' 
                        : 'bg-neutral-50 text-neutral-600 border-neutral-200'
                    }`}>
                        {alert.severity} PRIORITY
                    </span>
                )}
            </div>

            <div>
                <h4 className="font-black text-neutral-900 text-lg mb-1">{alert.title}</h4>
                <p className="text-sm text-neutral-600 leading-relaxed font-medium">{alert.description}</p>
            </div>

            {alert.routes && alert.routes.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                    {alert.routes.map(r => (
                        <span key={r} className="text-[10px] font-bold bg-neutral-900 text-white px-1.5 py-0.5 rounded">
                            {r}
                        </span>
                    ))}
                </div>
            )}

            {alert.timestamp && (
                <div className="text-[10px] text-neutral-400 text-right mt-1 font-mono">
                    UPDATED: {new Date(alert.timestamp * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};