import { SAMPLE_ROUTES, SAMPLE_STOPS, ROUTE_SHAPES } from "../constants";
import { Route, Stop, LiveVehicle, ServiceAlert } from "../types";
import { deriveRouteEndpoints } from "../utils";

// GTFS API Configuration
const GTFS_API_KEY = "5c10eed440f046ab8375661cbeec5d93";
// Note: Direct browser access to GTFS-R often fails due to CORS. 
// We use a robust simulation that mimics the API response structure.

// ============================================
// DATA FETCHING FUNCTIONS
// ============================================

/**
 * Get all routes (Simulated GTFS Static Data)
 */
export async function getRoutes(): Promise<Route[]> {
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 100));
  return SAMPLE_ROUTES;
}

/**
 * Get directions for a specific route
 */
export async function getRouteDirections(routeShortName: string) {
  const routes = SAMPLE_ROUTES.filter(r => r.route_short_name === routeShortName);
  const directions = routes.flatMap(data => {
     const { from, to } = deriveRouteEndpoints(data.route_long_name);
     const dirNames = data.direction_names || [`${from} → ${to}`, `${to} → ${from}`];
     return dirNames.map((name, index) => ({
         route_id: data.route_id,
         route_short_name: data.route_short_name,
         direction_id: index,
         direction_label: name
     }));
  });
  return directions;
}

/**
 * Get all stops
 */
export async function getStops(): Promise<Stop[]> {
  return SAMPLE_STOPS;
}

/**
 * Get stops for a specific route
 */
export async function getStopsForRoute(routeId: string, radiusKm: number = 0.5): Promise<Stop[]> {
  const stops = SAMPLE_STOPS.filter(s => s.route_ids?.includes(routeId));
  return stops;
}

/**
 * Get route shape (polyline)
 */
export async function getRouteShape(routeId: string): Promise<[number, number][]> {
  return ROUTE_SHAPES[routeId] || [];
}

/**
 * Get active alerts for a route
 */
export async function getAlertsForRoute(routeId: string): Promise<ServiceAlert[]> {
  // Return empty array for now, or mock specific alerts
  return [];
}

/**
 * Get all service alerts
 */
export async function getServiceAlerts(): Promise<ServiceAlert[]> {
  return [];
}

// ============================================
// LIVE VEHICLE SIMULATION (GTFS-R Mock)
// ============================================

/**
 * Subscribes to vehicle updates. 
 * Uses a mathematical model to move vehicles along the route shape
 * to simulate a live GTFS Realtime feed.
 */
export function subscribeToVehicles(
  callback: (vehicles: LiveVehicle[]) => void,
  onError?: (error: any) => void,
  routeId?: string
): () => void {
  
  const intervalId = setInterval(() => {
    const now = new Date();
    let allVehicles: LiveVehicle[] = [];

    // If a specific route is requested, only generate for that route
    const routesToSimulate = routeId 
        ? SAMPLE_ROUTES.filter(r => r.route_id === routeId)
        : SAMPLE_ROUTES;

    routesToSimulate.forEach(route => {
        const shape = ROUTE_SHAPES[route.route_id];
        if (shape) {
            const vehicles = generateSimulatedVehiclesForRoute(route, shape, now);
            allVehicles = [...allVehicles, ...vehicles];
        }
    });

    callback(allVehicles);
  }, 2000); // Update every 2 seconds

  return () => clearInterval(intervalId);
}

/**
 * Legacy compatibility - no-op
 */
export async function triggerRealtimeFetch(): Promise<void> {
  return Promise.resolve();
}

/**
 * Legacy compatibility - no-op
 */
export async function seedDatabase(): Promise<void> {
  return Promise.resolve();
}


// Helper: Calculate vehicle positions based on time
function generateSimulatedVehiclesForRoute(
  route: Route,
  shapePoints: [number, number][],
  now: Date
): LiveVehicle[] {
  if (!shapePoints || shapePoints.length < 2) return [];

  // Calculate total route length
  const cumulative: number[] = [0];
  let totalDistance = 0;
  for (let i = 1; i < shapePoints.length; i++) {
    const d = calculateDistance(
        shapePoints[i - 1][0], shapePoints[i - 1][1],
        shapePoints[i][0], shapePoints[i][1]
    );
    totalDistance += d;
    cumulative.push(totalDistance);
  }

  const HEADWAY_MIN = 15; // Bus every 15 mins
  const TRIP_DURATION_MIN = 45; // Assumed trip time
  const busesPerDir = Math.ceil(TRIP_DURATION_MIN / HEADWAY_MIN);

  const timeVal = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const vehicles: LiveVehicle[] = [];

  // Helper to place vehicle at percentage of route
  const placeVehicle = (pct: number, dir: number, idx: number) => {
    const p = ((pct % 1) + 1) % 1; // Normalize 0-1
    const targetDist = p * totalDistance;
    
    // Find segment
    let i = 0;
    while(i < cumulative.length - 1 && cumulative[i+1] < targetDist) i++;
    
    const segStart = cumulative[i];
    const segEnd = cumulative[Math.min(i+1, cumulative.length-1)];
    const segPct = (targetDist - segStart) / (segEnd - segStart || 1);
    
    const [lat1, lon1] = shapePoints[i];
    const [lat2, lon2] = shapePoints[Math.min(i+1, shapePoints.length-1)];
    
    const lat = lat1 + (lat2 - lat1) * segPct;
    const lon = lon1 + (lon2 - lon1) * segPct;

    vehicles.push({
        vehicle_id: `GTFS-${route.route_id}-${dir}-${idx}`,
        trip_id: `TRIP-${route.route_id}-${idx}`,
        route_id: route.route_id,
        latitude: lat,
        longitude: lon,
        timestamp: now.getTime(),
        direction_id: dir,
        heading: 0
    });
  };

  // Generate outbound (Dir 0)
  for(let i=0; i<busesPerDir; i++) {
      const offset = i * HEADWAY_MIN;
      const prog = (timeVal - offset) / TRIP_DURATION_MIN;
      placeVehicle(prog, 0, i);
  }

  // Generate inbound (Dir 1) - reverse progress
  for(let i=0; i<busesPerDir; i++) {
      const offset = i * HEADWAY_MIN + (HEADWAY_MIN/2); // Offset inbound slightly
      const prog = 1 - ((timeVal - offset) / TRIP_DURATION_MIN);
      placeVehicle(prog, 1, i);
  }

  return vehicles;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}
