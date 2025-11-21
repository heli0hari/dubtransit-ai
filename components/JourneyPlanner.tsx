import React, { useState } from 'react';
import { getJourneyPlan, searchLocation } from '../services/geminiService';
import { JourneyPlan, TransportType, WeatherSnapshot } from '../types';
import { getWeatherForLocation, getWeatherForLocationAtTime } from '../services/weatherService';
import { parseDurationToMinutes } from '../utils';
import { MapPin, Navigation, Loader2, Footprints, Bus, Train, TramFront, ArrowDown } from 'lucide-react';

export const JourneyPlanner: React.FC = () => {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [plan, setPlan] = useState<JourneyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [originWeather, setOriginWeather] = useState<WeatherSnapshot | null>(null);
  const [destinationWeather, setDestinationWeather] = useState<WeatherSnapshot | null>(null);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);

  const handlePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin || !destination) return;

    setLoading(true);
    setOriginWeather(null);
    setDestinationWeather(null);
    setEtaMinutes(null);

    try {
      const result = await getJourneyPlan(origin, destination);
      setPlan(result);

      if (!result) {
        return;
      }

      const minutes = parseDurationToMinutes(result.totalDuration);
      if (!minutes) {
        return;
      }
      setEtaMinutes(minutes);

      const [originLoc, destLoc] = await Promise.all([
        searchLocation(origin),
        searchLocation(destination),
      ]);

      if (originLoc) {
        const ow = await getWeatherForLocation(originLoc.lat, originLoc.lon);
        setOriginWeather(ow);
      }

      if (destLoc) {
        const arrivalTime = new Date(Date.now() + minutes * 60 * 1000);
        const dw = await getWeatherForLocationAtTime(
          destLoc.lat,
          destLoc.lon,
          arrivalTime
        );
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
    <div className="flex flex-col gap-6">
      
      <form onSubmit={handlePlan} className="bg-white border-2 border-neutral-900 rounded-xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-4">
        <div className="space-y-3">
            <div className="relative group">
                <div className="absolute left-3 top-3.5 w-2 h-2 rounded-full bg-neutral-900 group-focus-within:bg-dub-orange transition-colors" />
                <input 
                    type="text"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder="Where from?"
                    className="w-full bg-neutral-50 border-b-2 border-neutral-200 rounded-t-lg py-3 pl-8 pr-4 text-neutral-900 font-bold placeholder-neutral-400 focus:border-neutral-900 focus:outline-none focus:bg-white transition-all"
                />
            </div>
            <div className="relative group">
                <div className="absolute left-3 top-3.5 w-2 h-2 rounded-full border-2 border-neutral-900 group-focus-within:border-dub-orange transition-colors" />
                <input 
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Where to?"
                    className="w-full bg-neutral-50 border-b-2 border-neutral-200 rounded-t-lg py-3 pl-8 pr-4 text-neutral-900 font-bold placeholder-neutral-400 focus:border-neutral-900 focus:outline-none focus:bg-white transition-all"
                />
            </div>
        </div>
        <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-neutral-900 hover:bg-black text-white font-black uppercase tracking-widest py-4 rounded-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-3"
        >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Generate Plan'}
        </button>
      </form>

      <div className="flex-1">
        {plan ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                <div className="text-center text-neutral-300 mt-10">
                    <Navigation className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p className="font-bold text-neutral-400">Enter locations to start planning</p>
                </div>
            )
        )}
      </div>
    </div>
  );
};