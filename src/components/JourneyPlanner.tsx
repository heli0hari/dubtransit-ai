import React, { useState, useRef, useEffect } from 'react';
import * as L from 'leaflet';
import { getJourneyPlan, searchLocation } from '../services/geminiService';
import { JourneyPlan, WeatherSnapshot } from '../types';
import { getWeatherForLocation, getWeatherForLocationAtTime } from '../services/weatherService';
import { parseDurationToMinutes } from '../utils';
import { DUBLIN_LANDMARKS, SAMPLE_STOPS } from '../constants';
import { Navigation, Loader2, Footprints, Bus, Train, TramFront, MapPin, LocateFixed, Map as MapIcon, Crosshair } from 'lucide-react';

interface Suggestion {
  name: string;
  type: 'stop' | 'landmark';
}

export const JourneyPlanner: React.FC = () => {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [plan, setPlan] = useState<JourneyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Map & Picking State
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [pickingMode, setPickingMode] = useState<'origin' | 'destination' | null>(null);
  const [originCoords, setOriginCoords] = useState<{lat: number, lon: number} | null>(null);
  const [destCoords, setDestCoords] = useState<{lat: number, lon: number} | null>(null);
  
  // Weather State
  const [originWeather, setOriginWeather] = useState<WeatherSnapshot | null>(null);
  const [destinationWeather, setDestinationWeather] = useState<WeatherSnapshot | null>(null);

  // Suggestions State
  const [activeInput, setActiveInput] = useState<'origin' | 'destination' | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView([53.3498, -6.2603], 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(mapRef.current);

    // Map Click Handler
    mapRef.current.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        
        // We need to read the current value of pickingMode from a ref or use a functional update if inside effect
        // For simplicity, we dispatch a custom event or check state if possible. 
        // Since Leaflet event listener is closed over initial state, we need a ref for pickingMode if we defined it here.
        // Better approach: handle click logic in a separate effect dependent on pickingMode
    });

    return () => {
        mapRef.current?.remove();
        mapRef.current = null;
    };
  }, []);

  // Handle Picking Mode and Map Clicks
  useEffect(() => {
    if (!mapRef.current) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
        if (!pickingMode) return;
        
        const { lat, lng } = e.latlng;
        const coordsString = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        
        if (pickingMode === 'origin') {
            setOrigin(coordsString);
            setOriginCoords({ lat, lon: lng });
            // Add marker
            L.marker([lat, lng]).addTo(mapRef.current!).bindPopup("Origin").openPopup();
        } else {
            setDestination(coordsString);
            setDestCoords({ lat, lon: lng });
            L.marker([lat, lng]).addTo(mapRef.current!).bindPopup("Destination").openPopup();
        }
        
        setPickingMode(null);
    };

    mapRef.current.on('click', handleMapClick);
    
    // Update Cursor
    const container = mapRef.current.getContainer();
    if (pickingMode) {
        container.style.cursor = 'crosshair';
    } else {
        container.style.cursor = 'grab';
    }

    return () => {
        mapRef.current?.off('click', handleMapClick);
    };
  }, [pickingMode]);

  useEffect(() => {
    // Click outside handler to close suggestions
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setActiveInput(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (type: 'origin' | 'destination', value: string) => {
    if (type === 'origin') setOrigin(value);
    else setDestination(value);

    // Filter suggestions
    const query = value.toLowerCase();
    const stops = SAMPLE_STOPS.map(s => ({ name: s.stop_name, type: 'stop' as const }));
    const landmarks = DUBLIN_LANDMARKS.map(l => ({ name: l.name, type: 'landmark' as const }));
    const all = [...landmarks, ...stops];

    const filtered = all.filter(item => item.name.toLowerCase().includes(query)).slice(0, 5);
    setSuggestions(filtered);
    setActiveInput(type);
  };

  const handleSelectSuggestion = (name: string) => {
    if (activeInput === 'origin') setOrigin(name);
    else setDestination(name);
    setActiveInput(null);
  };

  const handleUseCurrentLocation = () => {
      if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition((pos) => {
              const { latitude, longitude } = pos.coords;
              const txt = "Current Location";
              if (activeInput === 'origin' || !activeInput) { // Default to origin if clicked outside logic
                  setOrigin(txt);
                  setOriginCoords({ lat: latitude, lon: longitude });
              } else {
                  setDestination(txt);
                  setDestCoords({ lat: latitude, lon: longitude });
              }
              setActiveInput(null);
          });
      } else {
          alert("Geolocation not supported");
      }
  };

  const startPickingOnMap = (type: 'origin' | 'destination') => {
     setPickingMode(type);
     setActiveInput(null);
  };

  const handlePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin || !destination) return;

    setLoading(true);
    setOriginWeather(null);
    setDestinationWeather(null);
    setPlan(null);

    try {
      const result = await getJourneyPlan(origin, destination);
      setPlan(result);

      if (!result) return;

      const minutes = parseDurationToMinutes(result.totalDuration);
      
      // If coords are missing, search for them
      let oLat = originCoords?.lat;
      let oLon = originCoords?.lon;
      let dLat = destCoords?.lat;
      let dLon = destCoords?.lon;

      // Fetch coordinates if we don't have them from map/gps
      if ((!oLat || !oLon) && origin !== "Current Location") {
         const s = await searchLocation(origin);
         if (s) { oLat = s.lat; oLon = s.lon; }
      }
      if ((!dLat || !dLon) && destination !== "Current Location") {
         const s = await searchLocation(destination);
         if (s) { dLat = s.lat; dLon = s.lon; }
      }

      if (oLat && oLon) {
        const ow = await getWeatherForLocation(oLat, oLon);
        setOriginWeather(ow);
      }

      if (dLat && dLon && minutes) {
        const arrivalTime = new Date(Date.now() + minutes * 60 * 1000);
        const dw = await getWeatherForLocationAtTime(dLat, dLon, arrivalTime);
        setDestinationWeather(dw);
      }
    } catch (err) {
      console.error('Failed to plan journey', err);
    } finally {
      setLoading(false);
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
        case 'BUS': return <Bus className="w-4 h-4 text-white" />;
        case 'LUAS': return <TramFront className="w-4 h-4 text-white" />;
        case 'DART': return <Train className="w-4 h-4 text-white" />;
        case 'WALK': return <Footprints className="w-4 h-4 text-neutral-400" />;
        default: return <Navigation className="w-4 h-4 text-white" />;
    }
  };

  const getModeColor = (mode: string) => {
    switch (mode) {
        case 'BUS': return 'bg-dub-bus-blue';
        case 'LUAS': return 'bg-dub-luas-purple';
        case 'DART': return 'bg-dub-dart-green';
        case 'WALK': return 'bg-neutral-200 border border-neutral-300';
        default: return 'bg-neutral-900';
    }
  };

  return (
    <div className="flex flex-col gap-6" ref={wrapperRef}>
      
      {/* Inputs Card */}
      <form onSubmit={handlePlan} className="bg-white border-2 border-neutral-900 rounded-xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-4 relative z-30">
        
        {/* Origin Input */}
        <div className="relative group">
            <div className="absolute left-3 top-3.5 w-2 h-2 rounded-full bg-neutral-900 group-focus-within:bg-dub-orange transition-colors z-10" />
            <input 
                type="text"
                value={origin}
                onFocus={() => handleInputChange('origin', origin)}
                onChange={(e) => handleInputChange('origin', e.target.value)}
                placeholder="Where from?"
                className="w-full bg-white border-b-2 border-neutral-200 rounded-t-lg py-3 pl-8 pr-24 text-neutral-900 font-bold placeholder-neutral-400 focus:border-neutral-900 focus:outline-none transition-all"
            />
             {/* Quick Actions */}
            <div className={`absolute right-2 top-2 flex gap-1 z-10 transition-opacity ${activeInput === 'origin' || !origin ? 'opacity-100' : 'opacity-50 hover:opacity-100'}`}>
                <button type="button" onClick={handleUseCurrentLocation} className="p-1.5 hover:bg-neutral-100 rounded-md text-neutral-400 hover:text-dub-bus-blue transition-colors" title="Use Current Location">
                    <LocateFixed className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => startPickingOnMap('origin')} className={`p-1.5 hover:bg-neutral-100 rounded-md transition-colors ${pickingMode === 'origin' ? 'bg-dub-orange text-neutral-900' : 'text-neutral-400 hover:text-dub-orange'}`} title="Select on Map">
                    <MapIcon className="w-4 h-4" />
                </button>
            </div>
        </div>

        {/* Destination Input */}
        <div className="relative group">
            <div className="absolute left-3 top-3.5 w-2 h-2 rounded-full border-2 border-neutral-900 group-focus-within:border-dub-orange transition-colors z-10" />
            <input 
                type="text"
                value={destination}
                onFocus={() => handleInputChange('destination', destination)}
                onChange={(e) => handleInputChange('destination', e.target.value)}
                placeholder="Where to?"
                className="w-full bg-white border-b-2 border-neutral-200 rounded-t-lg py-3 pl-8 pr-24 text-neutral-900 font-bold placeholder-neutral-400 focus:border-neutral-900 focus:outline-none transition-all"
            />
            <div className={`absolute right-2 top-2 flex gap-1 z-10 transition-opacity ${activeInput === 'destination' || !destination ? 'opacity-100' : 'opacity-50 hover:opacity-100'}`}>
                <button type="button" onClick={handleUseCurrentLocation} className="p-1.5 hover:bg-neutral-100 rounded-md text-neutral-400 hover:text-dub-bus-blue transition-colors" title="Use Current Location">
                    <LocateFixed className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => startPickingOnMap('destination')} className={`p-1.5 hover:bg-neutral-100 rounded-md transition-colors ${pickingMode === 'destination' ? 'bg-dub-orange text-neutral-900' : 'text-neutral-400 hover:text-dub-orange'}`} title="Select on Map">
                    <MapIcon className="w-4 h-4" />
                </button>
            </div>
        </div>

        {/* Suggestions Dropdown */}
        {activeInput && suggestions.length > 0 && (
          <div className="absolute top-[130px] left-0 right-0 bg-white border-2 border-neutral-900 rounded-b-lg shadow-xl z-50 overflow-hidden">
             {suggestions.map((s, idx) => (
               <button
                 key={idx}
                 type="button"
                 onMouseDown={() => handleSelectSuggestion(s.name)}
                 className="w-full text-left px-4 py-3 hover:bg-neutral-50 flex items-center gap-3 border-b border-neutral-100 last:border-0"
               >
                 {s.type === 'stop' ? <Bus className="w-4 h-4 text-neutral-400" /> : <MapPin className="w-4 h-4 text-neutral-400" />}
                 <span className="font-bold text-sm text-neutral-800">{s.name}</span>
               </button>
             ))}
          </div>
        )}

        <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-neutral-900 hover:bg-black text-white font-black uppercase tracking-widest py-4 rounded-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-3"
        >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Generate Plan'}
        </button>
      </form>

      {/* Picking Mode Indicator */}
      {pickingMode && (
          <div className="bg-dub-orange border-2 border-neutral-900 rounded-lg p-3 flex items-center justify-between animate-in slide-in-from-top-2 z-20">
              <div className="flex items-center gap-2 text-neutral-900 font-bold text-sm">
                  <Crosshair className="w-5 h-5 animate-pulse" />
                  <span>Tap map to select {pickingMode}</span>
              </div>
              <button onClick={() => setPickingMode(null)} className="bg-white/50 hover:bg-white/80 p-1 rounded transition-colors">
                  <span className="text-xs font-black uppercase px-2">Cancel</span>
              </button>
          </div>
      )}

      {/* Map Container */}
      <div className="relative rounded-xl overflow-hidden border-2 border-neutral-200 h-64 w-full z-0 shadow-inner bg-neutral-100 shrink-0">
         <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
         {!pickingMode && !plan && (
             <div className="absolute bottom-2 right-2 bg-white/90 px-2 py-1 rounded text-[10px] font-bold text-neutral-400 pointer-events-none">
                 Preview Map
             </div>
         )}
      </div>

      {/* Results Area */}
      <div className="flex-1 z-0">
        {plan ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-8">
                <div className="bg-white p-5 border-l-4 border-dub-orange rounded-r-lg shadow-sm">
                    <p className="text-neutral-400 text-[10px] uppercase tracking-widest font-bold mb-1">Total Duration</p>
                    <p className="text-4xl font-black text-neutral-900 mb-2">{plan.totalDuration}</p>
                    <p className="text-neutral-600 leading-relaxed text-sm font-medium">{plan.summary}</p>
                </div>

                { (originWeather || destinationWeather) && (
                  <div className="grid grid-cols-2 gap-4">
                      {originWeather && (
                        <div className="bg-neutral-100 p-3 rounded-lg border border-neutral-200">
                          <div className="text-[10px] font-bold uppercase text-neutral-400 mb-1">Departure</div>
                          <div className="text-neutral-900 font-bold text-lg">{Math.round(originWeather.temperature)}°C</div>
                          <div className="text-xs text-neutral-600">{originWeather.conditionLabel}</div>
                        </div>
                      )}
                      {destinationWeather && (
                        <div className="bg-neutral-100 p-3 rounded-lg border border-neutral-200">
                           <div className="text-[10px] font-bold uppercase text-neutral-400 mb-1">Arrival</div>
                           <div className="text-neutral-900 font-bold text-lg">{Math.round(destinationWeather.temperature)}°C</div>
                           <div className="text-xs text-neutral-600">{destinationWeather.conditionLabel}</div>
                        </div>
                      )}
                  </div>
                )}

                <div className="space-y-0 relative pl-2">
                    {/* Timeline line */}
                    <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-neutral-200 z-0"></div>

                    {plan.steps.map((step, idx) => (
                        <div key={idx} className="relative z-10 flex gap-4 items-start pb-8 last:pb-0 group">
                            <div className={`w-10 h-10 rounded-full ${getModeColor(step.mode)} border-4 border-white shadow-sm flex items-center justify-center shrink-0`}>
                                {getModeIcon(step.mode)}
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-neutral-100 shadow-sm flex-1 group-hover:border-neutral-300 transition-colors">
                                <div className="flex justify-between mb-1">
                                    <span className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">{step.mode}</span>
                                    <span className="text-xs font-bold text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded">{step.duration}</span>
                                </div>
                                <p className="text-neutral-800 text-sm font-medium">{step.instruction}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        ) : (
            !loading && (
                <div className="text-center text-neutral-300 mt-4">
                    <p className="font-bold text-neutral-400 text-sm">Use the map above to help plan your trip.</p>
                </div>
            )
        )}
      </div>
    </div>
  );
};