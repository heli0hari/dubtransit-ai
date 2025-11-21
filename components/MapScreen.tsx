import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as L from 'leaflet';
import { Stop, LiveVehicle, Route, ServiceAlert, WeatherSnapshot } from '../types';
import { 
    subscribeToVehicles, 
    getRoutes, 
    seedDatabase, 
    getStopsForRoute, 
    getRouteShape,
    getAlertsForRoute,
    triggerRealtimeFetch
} from '../services/firebase';
import { getWeatherForLocation } from '../services/weatherService';
import { searchLocation } from '../services/geminiService';
import { calculateDistance, estimateArrival, deriveRouteEndpoints } from '../utils';
import { AVERAGE_BUS_SPEED_KMPH } from '../constants';
import { Navigation, RefreshCw, AlertCircle, Loader2, Search, X, MapPin, Bus, Train, TramFront, Database, ArrowRight, ArrowLeftRight, Sun } from 'lucide-react';

// Direction Colors
const DIR_0_COLOR = '#00539F'; // Dublin Bus Blue
const DIR_1_COLOR = '#B3007D'; // Distinct Purple

/**
 * Custom Marker class that interpolates position updates for smooth animation
 */
class SmoothMarker extends L.Marker {
    private _targetLatLng: L.LatLng;
    private _startLatLng: L.LatLng;
    private _startTime: number;
    private _duration: number;
    private _animationFrameId: number | null = null;

    constructor(latlng: L.LatLngExpression, options?: L.MarkerOptions) {
        super(latlng, options);
        this._targetLatLng = L.latLng(latlng);
        this._startLatLng = L.latLng(latlng);
        this._startTime = 0;
        this._duration = 1000; // default duration
    }

    public setLatLngSmooth(latlng: L.LatLngExpression, duration: number = 1000) {
        if (this._animationFrameId) {
            cancelAnimationFrame(this._animationFrameId);
        }

        // TS workaround
        this._startLatLng = (this as any).getLatLng();
        this._targetLatLng = L.latLng(latlng);
        this._startTime = performance.now();
        this._duration = duration;

        if (this._startLatLng.distanceTo(this._targetLatLng) > 500) {
             super.setLatLng(this._targetLatLng);
             return this;
        }

        this._animate = this._animate.bind(this);
        this._animate();
        return this;
    }

    private _animate() {
        const now = performance.now();
        const elapsed = now - this._startTime;
        const progress = Math.min(elapsed / this._duration, 1);

        const lat = this._startLatLng.lat + (this._targetLatLng.lat - this._startLatLng.lat) * progress;
        const lng = this._startLatLng.lng + (this._targetLatLng.lng - this._startLatLng.lng) * progress;

        super.setLatLng([lat, lng]);

        if (progress < 1) {
            this._animationFrameId = requestAnimationFrame(this._animate);
        } else {
            this._animationFrameId = null;
            super.setLatLng(this._targetLatLng);
        }
    }
}

const generateSimulatedVehiclesForRoute = (
  route: Route,
  shapePoints: [number, number][],
  now: Date = new Date()
): LiveVehicle[] => {
  if (!shapePoints || shapePoints.length < 2) return [];

  const cumulative: number[] = [0];
  let total = 0;
  for (let i = 1; i < shapePoints.length; i++) {
    const [lat1, lon1] = shapePoints[i - 1];
    const [lat2, lon2] = shapePoints[i];
    const d = calculateDistance(lat1, lon1, lat2, lon2);
    total += d;
    cumulative.push(total);
  }
  if (total === 0) return [];

  const HEADWAY_MIN = 10;
  const TRIP_MIN = 60;

  const minutesSinceMidnight =
    now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const busesPerDirection = Math.max(1, Math.ceil(TRIP_MIN / HEADWAY_MIN));

  const vehicles: LiveVehicle[] = [];

  const makeVehicleAtFraction = (fraction: number, index: number, dir: number) => {
    let f = ((fraction % 1) + 1) % 1;
    const targetDist = f * total;

    let segIndex = 0;
    while (segIndex < cumulative.length - 1 && cumulative[segIndex + 1] < targetDist) {
      segIndex++;
    }

    const segStart = cumulative[segIndex];
    const segEnd = cumulative[Math.min(segIndex + 1, cumulative.length - 1)];
    const segFraction = segEnd === segStart ? 0 : (targetDist - segStart) / (segEnd - segStart);

    const [lat1, lon1] = shapePoints[segIndex];
    const [lat2, lon2] = shapePoints[Math.min(segIndex + 1, shapePoints.length - 1)];

    const lat = lat1 + (lat2 - lat1) * segFraction;
    const lon = lon1 + (lon2 - lon1) * segFraction;

    const id = `SIM-${route.route_id}-${dir}-${index}`;
    vehicles.push({
      vehicle_id: id,
      trip_id: `${route.route_id}-sim-${dir}-${index}`,
      route_id: route.route_id,
      latitude: lat,
      longitude: lon,
      timestamp: now.getTime(),
      direction_id: dir,
    } as LiveVehicle);
  };

  for (let i = 0; i < busesPerDirection; i++) {
    const startOffset = i * HEADWAY_MIN;
    const prog = (minutesSinceMidnight - startOffset) / TRIP_MIN;
    makeVehicleAtFraction(prog, i, 0);
  }

  for (let i = 0; i < busesPerDirection; i++) {
    const startOffset = i * HEADWAY_MIN;
    const prog = (minutesSinceMidnight - startOffset) / TRIP_MIN;
    makeVehicleAtFraction(1 - prog, i, 1);
  }

  return vehicles;
};

interface MapScreenProps {
    routeSelection?: { id: string, dir: number } | null;
    onSelectionCleared?: () => void;
}

interface RouteOption {
    route: Route;
    directionIndex: number;
    label: string;
}

export const MapScreen: React.FC<MapScreenProps> = ({ routeSelection, onSelectionCleared }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: any }>({});
  const stopMarkersRef = useRef<L.CircleMarker[]>([]);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const routeOutlinePolylineRef = useRef<L.Polyline | null>(null);
  
  const [stops, setStops] = useState<Stop[]>([]);
  const [vehicles, setVehicles] = useState<LiveVehicle[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [routeAlerts, setRouteAlerts] = useState<ServiceAlert[]>([]);
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [routeShape, setRouteShape] = useState<[number, number][]>([]);
  const [simulatedVehicles, setSimulatedVehicles] = useState<LiveVehicle[]>([]);
  
  const [mapReady, setMapReady] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); 
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [permissionError, setPermissionError] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<number>(0); 
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchingLocation, setSearchingLocation] = useState(false);

  useEffect(() => {
      if (routeSelection && routes.length > 0) {
          selectRouteDirection(routeSelection.id, routeSelection.dir);
      }
  }, [routeSelection, routes]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      zoomControl: false
    }).setView([53.3498, -6.2603], 13); 

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
    }).addTo(mapRef.current);

    setMapReady(true);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  const fetchWeatherForMapCenter = async () => {
      if (!mapRef.current) return;
      const center = mapRef.current.getCenter();
      setWeatherLoading(true);
      try {
        const snap = await getWeatherForLocation(center.lat, center.lng);
        setWeather(snap);
      } catch (e) {
        console.error("Failed to get weather:", e);
      } finally {
        setWeatherLoading(false);
      }
  };

  useEffect(() => {
      if (mapReady) {
          fetchWeatherForMapCenter();
      }
  }, [mapReady]);

  useEffect(() => {
    setLoading(true);
    setPermissionError(false);
    
    getRoutes()
      .then((routesData) => {
        setRoutes(routesData);
      })
      .catch(err => {
        console.error('Error loading routes:', err);
        setPermissionError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [refreshKey]);

  useEffect(() => {
    if (!selectedRouteId) {
        setRouteAlerts([]);
        return;
    }
    
    const fetchAlerts = async () => {
        try {
            const alerts = await getAlertsForRoute(selectedRouteId);
            setRouteAlerts(alerts);
        } catch (e) {
            console.error("Failed to load route alerts:", e);
            setRouteAlerts([]);
        }
    };
    fetchAlerts();
  }, [selectedRouteId, refreshKey]);

  useEffect(() => {
    if (selectedRouteId) {
      setLoading(true);
      
      Promise.all([
        getStopsForRoute(selectedRouteId),
        getRouteShape(selectedRouteId)
      ]).then(([routeStops, shapePoints]) => {
        setStops(routeStops);
        setRouteShape(shapePoints || []);

        if (mapRef.current) {
            if (routePolylineRef.current) {
                routePolylineRef.current.remove();
                routePolylineRef.current = null;
            }
            if (routeOutlinePolylineRef.current) {
                routeOutlinePolylineRef.current.remove();
                routeOutlinePolylineRef.current = null;
            }

            if (shapePoints.length > 0) {
                const route = routes.find(r => r.route_id === selectedRouteId);
                const color = route?.route_color ? `#${route.route_color}` : '#00539F';

                // 1. Outline (Background) - thick white casing to pop from map
                routeOutlinePolylineRef.current = L.polyline(shapePoints, {
                    color: 'white',
                    weight: 8, 
                    opacity: 1,
                    lineCap: 'round',
                    lineJoin: 'round'
                }).addTo(mapRef.current);

                // 2. Main Line (Foreground) - route color
                routePolylineRef.current = L.polyline(shapePoints, {
                    color: color,
                    weight: 5,
                    opacity: 1,
                    lineCap: 'round',
                    lineJoin: 'round',
                }).addTo(mapRef.current);
                
                mapRef.current.fitBounds(routePolylineRef.current.getBounds(), { padding: [40, 40] });
            }
        }
      })
      .catch(err => {
          console.error('Error loading route data:', err);
          setStops([]);
      })
      .finally(() => {
          setLoading(false);
      });
    } else {
      setStops([]);
      setRouteShape([]);
      if (routePolylineRef.current) {
          routePolylineRef.current.remove();
          routePolylineRef.current = null;
      }
      if (routeOutlinePolylineRef.current) {
          routeOutlinePolylineRef.current.remove();
          routeOutlinePolylineRef.current = null;
      }
    }
  }, [selectedRouteId, routes]);

  useEffect(() => {
    if (!selectedRouteId || routeShape.length === 0) {
      setSimulatedVehicles([]);
      return;
    }

    const updateSimulated = () => {
      const route = routes.find(r => r.route_id === selectedRouteId);
      if (!route) return;
      const sims = generateSimulatedVehiclesForRoute(route, routeShape, new Date());
      setSimulatedVehicles(sims);
    };

    updateSimulated();
    const intervalId = setInterval(updateSimulated, 15000);

    return () => clearInterval(intervalId);
  }, [selectedRouteId, routeShape, routes]);

  useEffect(() => {
    const unsubscribe = subscribeToVehicles(
      (newVehicles) => {
        setVehicles(newVehicles);
      },
      (error) => {
        console.error("Subscription error", error);
        setPermissionError(true);
      },
      selectedRouteId || undefined 
    );
    
    return () => unsubscribe();
  }, [refreshKey, selectedRouteId]);

  const filteredRouteOptions = useMemo(() => {
    if (!searchQuery) return [];
    const lowerQuery = searchQuery.toLowerCase().replace(/^(bus|route|tram)\s+/g, '').trim();
    
    const matches = routes.filter(r => 
        r.route_short_name.toLowerCase().includes(lowerQuery) ||
        r.route_long_name.toLowerCase().includes(lowerQuery)
    );

    // Sort: Exact match -> Starts with -> Includes
    matches.sort((a, b) => {
        const aShort = a.route_short_name.toLowerCase();
        const bShort = b.route_short_name.toLowerCase();
        
        // Exact match priority
        if (aShort === lowerQuery && bShort !== lowerQuery) return -1;
        if (aShort !== lowerQuery && bShort === lowerQuery) return 1;
        
        // Starts with priority
        if (aShort.startsWith(lowerQuery) && !bShort.startsWith(lowerQuery)) return -1;
        if (!aShort.startsWith(lowerQuery) && bShort.startsWith(lowerQuery)) return 1;
        
        // Alpha sort otherwise
        return aShort.localeCompare(bShort, undefined, { numeric: true });
    });

    const uniqueMatches: Route[] = [];
    const seen = new Set<string>();
    
    for (const r of matches) {
        const key = `${r.route_short_name}|${r.route_long_name}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueMatches.push(r);
        }
    }

    const options: RouteOption[] = [];
    uniqueMatches.forEach(route => {
        const { from, to } = deriveRouteEndpoints(route.route_long_name);
        const baseDirections =
            route.direction_names && route.direction_names.length > 0 &&
            !route.direction_names[0].toLowerCase().includes("inbound") &&
            !route.direction_names[0].toLowerCase().includes("outbound")
                ? route.direction_names
                : [`${from} → ${to}`, `${to} → ${from}`];

        baseDirections.forEach((label, idx) => {
            options.push({
                route,
                directionIndex: idx,
                label,
            });
        });
    });

    return options.slice(0, 10); 
  }, [searchQuery, routes]);

  const liveVehiclesForRoute = useMemo(() => {
    if (!selectedRouteId) return [];
    return vehicles.filter(v => v.route_id === selectedRouteId);
  }, [vehicles, selectedRouteId]);

  const visibleVehicles = useMemo(() => {
    if (!selectedRouteId) return [];
    if (liveVehiclesForRoute.length > 0) return liveVehiclesForRoute;
    return simulatedVehicles;
  }, [selectedRouteId, liveVehiclesForRoute, simulatedVehicles]);

  const getDirectionLabel = (routeId: string, dir: number) => {
    const route = routes.find(r => r.route_id === routeId);
    if (!route) {
      return dir === 0 ? "A → B" : "B → A";
    }
    if (
      route.direction_names &&
      route.direction_names[dir] &&
      !route.direction_names[dir].toLowerCase().includes("inbound") &&
      !route.direction_names[dir].toLowerCase().includes("outbound")
    ) {
      const label = route.direction_names[dir];
      const arrowIndex = label.indexOf("→");
      if (arrowIndex >= 0) {
        return label.slice(arrowIndex + 1).trim();
      }
      const toIndex = label.toLowerCase().indexOf(" to ");
      if (toIndex >= 0) {
        return label.slice(toIndex + 4).trim();
      }
      return label;
    }

    const { from, to } = deriveRouteEndpoints(route.route_long_name);
    return dir === 0 ? to : from;
  };

  const handleStopClick = (stop: Stop) => {
    if (!mapRef.current || !selectedRouteId) return;
    
    const candidateVehicles = visibleVehicles.filter(v => 
        v.direction_id === undefined || v.direction_id === selectedDirection
    );
    const directionName = getDirectionLabel(selectedRouteId, selectedDirection);

    if (candidateVehicles.length === 0) {
        return `
            <div class="p-2 font-sans min-w-[180px]">
                <h3 class="font-bold text-neutral-900 text-sm border-b border-neutral-200 pb-1 mb-2">${stop.stop_name}</h3>
                <div class="bg-neutral-100 p-2 rounded-md text-xs text-center text-neutral-600 font-mono">
                    NO BUSES NEARBY
                </div>
            </div>
        `;
    }

    let minDistance = Infinity;
    let nearestVehicle: LiveVehicle | null = null;

    candidateVehicles.forEach(v => {
        const d = calculateDistance(stop.stop_lat, stop.stop_lon, v.latitude, v.longitude);
        if (d < minDistance) {
            minDistance = d;
            nearestVehicle = v;
        }
    });

    if (nearestVehicle && minDistance < 100) {
        const eta = estimateArrival(minDistance, AVERAGE_BUS_SPEED_KMPH);
        const route = routes.find(r => r.route_id === nearestVehicle!.route_id);
        
        return `
            <div class="p-2 font-sans min-w-[200px]">
                <h3 class="font-bold text-neutral-900 text-sm border-b border-neutral-200 pb-1 mb-2">${stop.stop_name}</h3>
                <div class="flex justify-between items-baseline mb-1">
                   <span class="text-xs text-neutral-500 uppercase tracking-wider">Next Arrival</span>
                   <span class="font-bold text-dub-orange text-xs">${directionName}</span>
                </div>
                
                <div class="bg-neutral-900 text-white p-3 rounded-md shadow-lg">
                    <div class="flex justify-between items-center">
                         <span class="text-xl font-black tracking-tighter">${eta < 1 ? 'NOW' : eta + ' min'}</span>
                         <span class="text-xs font-mono text-neutral-400">${minDistance.toFixed(1)}km</span>
                    </div>
                    <div class="text-[10px] text-neutral-500 mt-1 uppercase tracking-widest">Route ${route?.route_short_name}</div>
                </div>
            </div>
        `;
    } else {
        return `
             <div class="p-2 font-sans">
                <h3 class="font-bold text-neutral-900">${stop.stop_name}</h3>
                <p class="text-xs text-neutral-500">No estimates available</p>
            </div>
        `;
    }
  };

  useEffect(() => {
    if (!mapRef.current) return;
    
    stopMarkersRef.current.forEach(m => m.remove());
    stopMarkersRef.current = [];

    if (!selectedRouteId || !stops.length) return;

    const route = routes.find(r => r.route_id === selectedRouteId);
    const color = route?.route_color ? `#${route.route_color}` : '#171717';

    stops.forEach(stop => {
        if (stop.direction_id !== undefined && stop.direction_id !== selectedDirection) {
            return;
        }

        // Google Maps style stop: white circle with colored border
        const marker = L.circleMarker([stop.stop_lat, stop.stop_lon], {
            radius: 5,
            fillColor: '#FFFFFF',
            color: color, 
            weight: 2,
            opacity: 1,
            fillOpacity: 1
        }).addTo(mapRef.current!);

        marker.on('click', () => {
             const content = handleStopClick(stop);
             marker.bindPopup(content as string).openPopup();
        });

        stopMarkersRef.current.push(marker);
    });
  }, [stops, selectedRouteId, selectedDirection, visibleVehicles]);

  useEffect(() => {
    if (!mapRef.current) return;

    const currentIds = Object.keys(markersRef.current);
    
    currentIds.forEach(id => {
        if (!visibleVehicles.find(v => v.vehicle_id === id)) {
            markersRef.current[id].remove();
            delete markersRef.current[id];
        }
    });

    visibleVehicles.forEach(vehicle => {
        const route = routes.find(r => r.route_id === vehicle.route_id);
        const dir = vehicle.direction_id ?? 0;
        
        const busColor = dir === 1 ? DIR_1_COLOR : DIR_0_COLOR;
        
        const lastUpdate = new Date(vehicle.timestamp).toLocaleTimeString('en-IE', {
            timeZone: 'Europe/Dublin',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        const popupContent = `
            <div class="p-2 font-sans">
                <div class="flex items-center gap-2 mb-2">
                     <span class="bg-neutral-900 text-white text-xs font-bold px-1.5 py-0.5 rounded">RT</span>
                     <h3 class="font-bold text-neutral-900 text-sm">Route ${route?.route_short_name || vehicle.route_id}</h3>
                </div>
                <div class="grid grid-cols-2 gap-2 text-xs border-t border-neutral-200 pt-2">
                     <div>
                        <div class="text-neutral-500 text-[10px] uppercase">Vehicle ID</div>
                        <div class="font-mono font-bold">${vehicle.vehicle_id.replace('SIM-', '')}</div>
                     </div>
                      <div class="text-right">
                        <div class="text-neutral-500 text-[10px] uppercase">Updated</div>
                        <div class="font-mono">${lastUpdate}</div>
                     </div>
                </div>
            </div>
        `;

        const existingMarker = markersRef.current[vehicle.vehicle_id];

        // Clean, modern marker
        const getBusIconHtml = (bgColor: string) => `
          <div class="relative flex items-center justify-center transition-all duration-500">
            <div class="w-9 h-9 rounded-full bg-white border-2 border-neutral-900 shadow-xl flex items-center justify-center z-10 relative hover:scale-110 transition-transform">
                <div class="w-7 h-7 rounded-full flex items-center justify-center text-white font-black text-[10px]" style="background-color: ${bgColor};">
                    ${route?.route_short_name || '?'}
                </div>
            </div>
            <div class="absolute -bottom-1.5 w-2 h-2 bg-neutral-900 transform rotate-45 z-0"></div>
          </div>
        `;

        const icon = L.divIcon({
            html: getBusIconHtml(busColor),
            className: 'bg-transparent',
            iconSize: [36, 36],
            iconAnchor: [18, 42],
            popupAnchor: [0, -42]
        });

        if (existingMarker) {
            existingMarker.setLatLngSmooth([vehicle.latitude, vehicle.longitude], 2000);
            existingMarker.setZIndexOffset(1000);
            existingMarker.setIcon(icon);
            
            if (existingMarker.getPopup()?.isOpen()) {
                existingMarker.setPopupContent(popupContent);
            } else {
                existingMarker.bindPopup(popupContent);
            }
        } else {
            const marker = new SmoothMarker([vehicle.latitude, vehicle.longitude], { icon: icon });
            (marker as any).addTo(mapRef.current!).bindPopup(popupContent);
            markersRef.current[vehicle.vehicle_id] = marker;
        }
    });
  }, [visibleVehicles, routes, mapReady]);

  const handleRefresh = async () => {
    try {
        setLoading(true);
        await triggerRealtimeFetch();
        setRefreshKey(prev => prev + 1);
        fetchWeatherForMapCenter();
    } catch (e) {
        console.error("Refresh error:", e);
    } finally {
        setLoading(false);
    }
  };

  const handleLocationSearch = async () => {
    if (!searchQuery) return;
    setSearchingLocation(true);
    setIsSearchFocused(false); 
    const result = await searchLocation(searchQuery);
    setSearchingLocation(false);
    if (result && mapRef.current) {
        mapRef.current.flyTo([result.lat, result.lon], 15, { duration: 1.5 });
        L.popup().setLatLng([result.lat, result.lon]).setContent(`<div class="font-bold text-sm font-sans">${result.name}</div>`).openOn(mapRef.current);
        setTimeout(fetchWeatherForMapCenter, 1500); 
    }
  };

  const selectRouteDirection = (routeId: string, directionIndex: number) => {
    setSelectedRouteId(routeId);
    setSelectedDirection(directionIndex);
    
    const route = routes.find(r => r.route_id === routeId);
    const label = getDirectionLabel(routeId, directionIndex);
    
    if (route) {
        setSearchQuery(`Route ${route.route_short_name}: ${label}`);
    }
    
    setIsSearchFocused(false);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSelectedRouteId(null);
    setRouteAlerts([]);
    setIsSearchFocused(false);
    if (onSelectionCleared) onSelectionCleared();
    
    if (routePolylineRef.current) {
        routePolylineRef.current.remove();
        routePolylineRef.current = null;
    }
    if (routeOutlinePolylineRef.current) {
        routeOutlinePolylineRef.current.remove();
        routeOutlinePolylineRef.current = null;
    }
  };

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      await seedDatabase();
      setTimeout(handleRefresh, 1000);
    } catch (e) {
      alert("Failed to seed data. Check console.");
    } finally {
      setSeeding(false);
    }
  };

  const getRouteIcon = (route: Route) => {
    const type = parseInt(route.route_type);
    if (type === 0) return <TramFront className="w-4 h-4 text-dub-luas-purple" />;
    if (type === 2) return <Train className="w-4 h-4 text-dub-dart-green" />;
    return <Bus className="w-4 h-4 text-dub-bus-blue" />;
  };

  return (
    <div className="relative w-full h-full bg-neutral-100">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      
      {/* Top Container: Unified Search & Filter & Weather */}
      <div className="absolute top-0 left-0 right-0 z-[1000] p-4 flex flex-col gap-3 bg-gradient-to-b from-white/80 to-transparent pointer-events-none">
         {/* Header Text for Map */}
         <div className="pointer-events-auto flex justify-between items-start">
             <div>
                 <h1 className="text-3xl font-black tracking-tighter text-neutral-900 drop-shadow-sm">dub<span className="text-dub-orange">.</span>transit</h1>
             </div>
         </div>

         {/* Search Bar */}
         <div className={`bg-white border-2 border-neutral-900 rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] transition-all pointer-events-auto ${isSearchFocused ? 'ring-2 ring-dub-orange ring-offset-1' : ''}`}>
            <div className="relative flex items-center">
                <div className="absolute left-3 text-neutral-900">
                    {searchingLocation ? <Loader2 className="w-5 h-5 animate-spin text-dub-orange" /> : <Search className="w-5 h-5" />}
                </div>
                
                <input 
                    type="text"
                    value={searchQuery}
                    onFocus={() => setIsSearchFocused(true)}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                    }}
                    placeholder="Search route or location..."
                    className="w-full bg-transparent py-3.5 pl-11 pr-10 text-neutral-900 placeholder-neutral-400 focus:outline-none font-bold text-sm"
                />

                {searchQuery && (
                    <button onClick={clearSearch} className="absolute right-3 p-1 hover:bg-neutral-100 rounded-full text-neutral-400 hover:text-neutral-900 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Suggestions Dropdown */}
            {isSearchFocused && searchQuery && (
                <div className="border-t-2 border-neutral-900 max-h-[50vh] overflow-y-auto custom-scrollbar bg-white rounded-b-md">
                    {filteredRouteOptions.length > 0 && (
                        <div className="py-2">
                            <h3 className="px-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Select Direction</h3>
                            {filteredRouteOptions.map((option, idx) => (
                                <button
                                    key={`${option.route.route_id}-${option.directionIndex}-${idx}`}
                                    onClick={() => selectRouteDirection(option.route.route_id, option.directionIndex)}
                                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-neutral-50 transition-colors text-left border-b border-neutral-100 last:border-0 group"
                                >
                                    <div className="bg-neutral-900 text-white p-2 rounded-md shrink-0 group-hover:bg-dub-orange transition-colors">
                                        {getRouteIcon(option.route)}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-baseline gap-2">
                                            <span className="font-black text-neutral-900 text-lg">{option.route.route_short_name}</span>
                                            <ArrowRight className="w-3 h-3 text-neutral-400" />
                                            <span className="font-bold text-neutral-600 text-sm truncate">{option.label}</span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                    
                    <div className="border-t-2 border-neutral-100 p-2">
                         <button onClick={handleLocationSearch} className="w-full flex items-center gap-3 px-3 py-3 rounded-md hover:bg-neutral-50 transition-colors text-left">
                             <div className="bg-dub-bus-blue/10 p-2 rounded-md text-dub-bus-blue">
                                 <MapPin className="w-4 h-4" />
                             </div>
                             <div>
                                 <div className="font-bold text-dub-bus-blue text-sm">Search Map Location</div>
                                 <div className="text-xs text-neutral-400">Find places matching "{searchQuery}"</div>
                             </div>
                         </button>
                    </div>
                </div>
            )}
         </div>

         <div className="flex flex-col gap-2 pointer-events-auto">
            {/* Selected Route & Direction Banner */}
            {selectedRouteId && (
                <div className="bg-white border-2 border-neutral-900 rounded-lg p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-in slide-in-from-top-2 flex items-center justify-between">
                    <div>
                        <div className="text-[10px] text-neutral-400 font-black uppercase tracking-widest mb-1">Now Tracking</div>
                        <div className="flex items-center gap-2 font-bold text-sm text-neutral-900">
                             <div className="w-3 h-3 rounded-full border border-black shrink-0" style={{ backgroundColor: selectedDirection === 1 ? DIR_1_COLOR : DIR_0_COLOR }} />
                             <span>Route {routes.find(r => r.route_id === selectedRouteId)?.route_short_name}</span>
                             <ArrowRight className="w-4 h-4 text-dub-orange" />
                             <span className="truncate max-w-[120px]">{getDirectionLabel(selectedRouteId, selectedDirection)}</span>
                        </div>
                    </div>
                    <button 
                        onClick={() => selectRouteDirection(selectedRouteId, selectedDirection === 0 ? 1 : 0)}
                        className="p-2 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors border border-neutral-200"
                        title="Switch Direction"
                    >
                        <ArrowLeftRight className="w-4 h-4 text-neutral-900" />
                    </button>
                </div>
            )}

            {/* Weather Pill */}
            {weather && (
              <div className="self-end bg-white border-2 border-neutral-900 rounded-full px-4 py-2 text-xs text-neutral-900 shadow-md flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                <div className="flex flex-col items-end leading-tight">
                  <span className="font-black">{Math.round(weather.temperature)}°C</span>
                  <span className="text-[10px] text-neutral-500 font-bold uppercase">{weather.conditionLabel ?? "Weather"}</span>
                </div>
                <div className="h-6 w-px bg-neutral-200"></div>
                <button
                  onClick={fetchWeatherForMapCenter}
                  disabled={weatherLoading}
                  className="p-1 hover:text-dub-orange transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${weatherLoading ? "animate-spin" : ""}`} />
                </button>
              </div>
            )}

            {/* Route alerts banner */}
            {selectedRouteId && routeAlerts.length > 0 && (
              <div className="bg-neutral-900 border-2 border-white rounded-lg p-3 text-xs text-white shadow-xl animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2 mb-2 text-dub-orange">
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-black uppercase tracking-widest">
                    {routeAlerts.length} Alert{routeAlerts.length > 1 ? "s" : ""}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {routeAlerts.slice(0, 2).map((a) => (
                    <li key={a.alert_id} className="border-l-2 border-dub-orange pl-2">
                      <span className="line-clamp-1 font-medium">{a.title || a.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
         </div>
      </div>
      
      {/* Bottom Controls */}
      <div className="absolute bottom-24 right-6 z-[400] flex flex-col gap-3 pointer-events-auto">
        <button 
            className={`w-12 h-12 bg-white border-2 border-neutral-900 text-neutral-900 rounded-lg flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ${loading ? 'animate-spin' : ''}`}
            onClick={handleRefresh}
            title="Refresh Data"
        >
            <RefreshCw className="w-5 h-5" />
        </button>
        
        <button 
            className="w-12 h-12 bg-white border-2 border-neutral-900 text-neutral-900 rounded-lg flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
            onClick={() => mapRef.current?.setView([53.3498, -6.2603], 13)}
            title="Recenter Map"
        >
            <Navigation className="w-5 h-5" />
        </button>
      </div>

      {/* Empty State */}
      {!selectedRouteId && !searchingLocation && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[400] pointer-events-none text-center">
             <div className="bg-white border-2 border-neutral-900 p-6 rounded-xl shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] inline-block pointer-events-auto">
                 <div className="bg-neutral-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-neutral-200">
                    <Search className="w-8 h-8 text-dub-orange" />
                 </div>
                 <h3 className="text-neutral-900 font-black text-xl tracking-tight">Start Tracking</h3>
                 <p className="text-neutral-500 text-sm mt-2 font-medium">Search for a route (e.g. "15")<br/>to see live vehicles.</p>
             </div>
          </div>
      )}

      {/* Permission Error */}
      {permissionError && !loading && (
          <div className="absolute top-32 left-1/2 -translate-x-1/2 z-[400] bg-[#E3CC00] text-neutral-900 px-6 py-4 rounded-lg shadow-xl text-sm font-bold flex flex-col gap-3 items-center animate-in slide-in-from-top-2 border-2 border-neutral-900 pointer-events-auto">
              <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  <span>Connection Interrupted</span>
              </div>
              <div className="flex gap-2 w-full">
                <button onClick={handleRefresh} className="flex-1 bg-white text-neutral-900 py-2 px-3 rounded font-bold hover:bg-neutral-100 transition-colors">Retry</button>
                <button onClick={handleSeedData} className="flex-1 bg-black/20 py-2 px-3 rounded font-bold hover:bg-black/30 transition-colors flex items-center justify-center gap-1 text-neutral-900">
                    {seeding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />}
                    Seed
                </button>
              </div>
          </div>
      )}
    </div>
  );
};