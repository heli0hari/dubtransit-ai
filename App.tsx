import React, { useState, useEffect, useMemo } from 'react';
import { MapScreen } from './components/MapScreen';
import { BottomNav } from './components/BottomNav';
import { JourneyPlanner } from './components/JourneyPlanner';
import { AlertsFeed } from './components/AlertsFeed';
import { getRoutes } from './services/transportService';
import { Route } from './types';
import { deriveRouteEndpoints } from './utils';
import { RouteCard } from './components/RouteCard';
import { Search, Loader2, RefreshCw } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('planner');
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRouteNav, setSelectedRouteNav] = useState<{id: string, dir: number} | null>(null);

  const fetchRoutes = () => {
    setLoadingRoutes(true);
    getRoutes().then(data => {
        setRoutes(data);
        setLoadingRoutes(false);
    }).catch(err => {
        console.error("Failed routes fetch", err);
        setLoadingRoutes(false);
    });
  };

  useEffect(() => {
    if (activeTab === 'routes' && routes.length === 0) {
        fetchRoutes();
    }
  }, [activeTab, routes.length]);

  const handleRouteClick = (routeId: string, directionIndex: number) => {
    setSelectedRouteNav({ id: routeId, dir: directionIndex });
    setActiveTab('map');
  };

  const filteredRoutes = useMemo(() => {
    const cleanTerm = searchTerm.toLowerCase().replace(/^(bus|route|tram)\s+/g, '').trim();
    const matched = routes.filter(r => 
        r.route_short_name.toLowerCase().includes(cleanTerm) || 
        r.route_long_name.toLowerCase().includes(cleanTerm)
    );

    matched.sort((a, b) => {
        const aShort = a.route_short_name.toLowerCase();
        const bShort = b.route_short_name.toLowerCase();
        if (aShort === cleanTerm && bShort !== cleanTerm) return -1;
        if (aShort !== cleanTerm && bShort === cleanTerm) return 1;
        if (aShort.startsWith(cleanTerm) && !bShort.startsWith(cleanTerm)) return -1;
        if (!aShort.startsWith(cleanTerm) && bShort.startsWith(cleanTerm)) return 1;
        return aShort.localeCompare(bShort, undefined, { numeric: true });
    });

    const unique: Route[] = [];
    const seen = new Set<string>();
    for (const r of matched) {
        const key = `${r.route_short_name}|${r.route_long_name}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(r);
        }
    }
    return unique;
  }, [routes, searchTerm]);

  const renderScreen = () => {
    switch (activeTab) {
      case 'planner':
        return (
            <div className="flex flex-col h-full bg-neutral-50">
                 <div className="p-6 pt-20 border-b border-neutral-200 bg-neutral-50 shrink-0 z-20">
                     <h1 className="text-5xl font-black tracking-tighter text-neutral-900 mb-1">dub<span className="text-dub-orange">.</span>transit</h1>
                     <p className="text-xs font-mono text-neutral-500 uppercase tracking-widest">AI Journey Assistant</p>
                 </div>
                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar pb-24"><JourneyPlanner /></div>
            </div>
        );
      case 'routes':
        return (
            <div className="flex flex-col h-full bg-neutral-50">
                <div className="p-6 pt-20 sticky top-0 z-10 bg-neutral-50/95 backdrop-blur-sm border-b border-neutral-200">
                     <h1 className="text-5xl font-black tracking-tighter text-neutral-900 mb-1">routes<span className="text-dub-orange">.</span></h1>
                     <p className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-6">Network Directory</p>
                    <div className="relative group">
                        <Search className="absolute left-4 top-3.5 w-5 h-5 text-neutral-400 group-focus-within:text-dub-orange transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Search route number (e.g. 15, 46A)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white border-2 border-neutral-200 rounded-lg py-3 pl-12 pr-4 text-neutral-900 font-medium focus:outline-none focus:border-neutral-900 transition-all placeholder-neutral-400 shadow-sm"
                        />
                        <div className="absolute right-3 top-3">
                           <button onClick={fetchRoutes} disabled={loadingRoutes} className="p-1 hover:bg-neutral-100 rounded transition-colors text-neutral-400 hover:text-neutral-900">
                                <RefreshCw className={`w-4 h-4 ${loadingRoutes ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>
                </div>
                <div className="p-6 space-y-3 overflow-y-auto pb-28 custom-scrollbar">
                    {loadingRoutes ? (
                        <div className="flex flex-col items-center py-20 space-y-4">
                            <Loader2 className="w-8 h-8 text-dub-orange animate-spin" />
                            <p className="font-mono text-xs text-neutral-400">LOADING_NETWORK_DATA...</p>
                        </div>
                    ) : (
                        <>
                            {filteredRoutes.length > 0 ? (
                                filteredRoutes.flatMap(route => {
                                    const { from, to } = deriveRouteEndpoints(route.route_long_name);
                                    const directions =
                                      route.direction_names && route.direction_names.length > 0 &&
                                      !route.direction_names[0].toLowerCase().includes("inbound") &&
                                      !route.direction_names[0].toLowerCase().includes("outbound")
                                        ? route.direction_names
                                        : [`${from} → ${to}`, `${to} → ${from}`];
                                    return directions.map((dirName, idx) => (
                                        <RouteCard 
                                            key={`${route.route_id}-${idx}`} 
                                            route={route} 
                                            directionLabel={dirName}
                                            onClick={() => handleRouteClick(route.route_id, idx)}
                                        />
                                    ));
                                })
                            ) : (
                                <div className="text-center py-20 text-neutral-400"><p>No routes found matching "{searchTerm}"</p></div>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
      case 'map':
        return <MapScreen routeSelection={selectedRouteNav} onSelectionCleared={() => setSelectedRouteNav(null)} />;
      case 'alerts':
        return (
            <div className="flex flex-col h-full bg-neutral-50">
                <div className="p-6 pt-20 sticky top-0 z-10 bg-neutral-50/95 backdrop-blur-sm border-b border-neutral-200 shrink-0">
                     <h1 className="text-5xl font-black tracking-tighter text-neutral-900 mb-1">alerts<span className="text-dub-orange">.</span></h1>
                     <p className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Live Service Updates</p>
                 </div>
                <div className="flex-1 overflow-hidden custom-scrollbar"><AlertsFeed /></div>
            </div>
        );
      default:
        return (
            <div className="flex flex-col h-full bg-neutral-50">
                 <div className="p-6 pt-20 border-b border-neutral-200 bg-neutral-50 shrink-0">
                     <h1 className="text-5xl font-black tracking-tighter text-neutral-900 mb-1">dub<span className="text-dub-orange">.</span>transit</h1>
                     <p className="text-xs font-mono text-neutral-500 uppercase tracking-widest">AI Journey Assistant</p>
                 </div>
                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar pb-24"><JourneyPlanner /></div>
            </div>
        );
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-neutral-50 overflow-hidden font-sans text-neutral-900">
      <main className="flex-1 relative overflow-hidden">{renderScreen()}</main>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};
export default App;