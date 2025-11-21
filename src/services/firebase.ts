
import { SAMPLE_ROUTES, SAMPLE_STOPS, ROUTE_SHAPES } from "../constants";
import { Route, Stop, LiveVehicle, ServiceAlert } from "../types";
import { deriveRouteEndpoints } from "../utils";

// Mock Service: No longer connects to real Firebase to avoid permission errors.
// Serves static data from constants.ts

export async function triggerRealtimeFetch(): Promise<void> {
  console.log("Triggering mock realtime fetch");
  return Promise.resolve();
}

export async function getRoutes(): Promise<Route[]> {
  // Simulate slight network delay
  await new Promise(resolve => setTimeout(resolve, 200));
  return SAMPLE_ROUTES;
}

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

export async function getStops(): Promise<Stop[]> {
  return SAMPLE_STOPS;
}

export async function getLiveVehicles(): Promise<LiveVehicle[]> {
  return [];
}

export function subscribeToVehicles(
  callback: (vehicles: LiveVehicle[]) => void,
  onError?: (error: any) => void,
  routeId?: string
): () => void {
  // Immediately return empty array.
  // The MapScreen will detect no live vehicles and fallback to its internal simulation logic.
  setTimeout(() => callback([]), 0);
  return () => {};
}

export async function getAlertsForRoute(routeId: string): Promise<ServiceAlert[]> {
    return [];
}

export async function getServiceAlerts(): Promise<ServiceAlert[]> {
    return [];
}

export async function getStopsForRoute(routeId: string, radiusKm: number = 0.5): Promise<Stop[]> {
    // Filter SAMPLE_STOPS based on route association
    const stops = SAMPLE_STOPS.filter(s => s.route_ids?.includes(routeId));
    return stops;
}

export async function getRouteShape(routeId: string): Promise<[number, number][]> {
    return ROUTE_SHAPES[routeId] || [];
}

export async function seedDatabase(): Promise<void> {
    console.log("Mock seed database called");
}
