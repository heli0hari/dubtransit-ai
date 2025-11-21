
// Firebase configuration and service functions for Dublin Bus Tracker
// This connects to your REAL Firestore data (routes, stops, etc.)

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, onSnapshot, query, limit, where, writeBatch, doc } from "firebase/firestore";
import { SAMPLE_ROUTES, SAMPLE_STOPS, ROUTE_SHAPES } from "../constants";
import { Route, Stop, LiveVehicle, ServiceAlert, AlertCategory, AlertSeverity } from "../types";
import { deriveRouteEndpoints } from "../utils";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDJ8EG6GT7twXdFmr-IN67EN2IhITxlRrk",
  authDomain: "public-transport-tracking-sys.firebaseapp.com",
  projectId: "public-transport-tracking-sys",
  storageBucket: "public-transport-tracking-sys.firebasestorage.app",
  messagingSenderId: "541109844630",
  appId: "1:541109844630:web:7d9b136b76903a0d55a0b7",
  measurementId: "G-B7R9MF1XDM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

// ============================================
// CLOUD FUNCTIONS HELPERS
// ============================================

const REALTIME_FUNCTION_URL =
  "https://us-central1-public-transport-tracking-sys.cloudfunctions.net/fetchRealtimeData";

/**
 * Manually trigger the Cloud Function to fetch GTFS realtime
 * and write into Firestore (live_vehicles, service_alerts, etc.)
 */
export async function triggerRealtimeFetch(): Promise<void> {
  try {
    const res = await fetch(REALTIME_FUNCTION_URL, {
        method: "POST", 
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        // Log warning but don't crash app flow, as this might be CORS restricted in dev or offline
        console.warn(`Failed to trigger realtime fetch: ${res.status} ${res.statusText} ${text}`);
    }
  } catch (e) {
    console.warn("Could not trigger cloud function (likely offline or CORS):", e);
  }
}

// ============================================
// FIRESTORE DATA FETCHING FUNCTIONS
// ============================================

/**
 * Get all routes from Firestore
 */
export async function getRoutes(): Promise<Route[]> {
  try {
    const routesRef = collection(db, 'routes');
    const snapshot = await getDocs(routesRef);
    return snapshot.docs.map(doc => ({
      route_id: doc.id,
      ...doc.data()
    } as Route));
  } catch (error) {
    console.error('Error fetching routes:', error);
    return [];
  }
}

/**
 * Helper to get specific route directions. 
 * In this implementation it extracts them from the route document structure.
 */
export async function getRouteDirections(routeShortName: string) {
  const q = query(
    collection(db, "routes"),
    where("route_short_name", "==", routeShortName)
  );

  const snapshot = await getDocs(q);

  // Flatten results: if multiple routes share a short name (unlikely in DB but possible conceptually), we map them all
  // Returns array of direction objects suitable for UI selection
  const directions = snapshot.docs.flatMap((doc) => {
    const data = doc.data() as Route;
    const { from, to } = deriveRouteEndpoints(data.route_long_name);
    const dirNames = data.direction_names || [`${from} → ${to}`, `${to} → ${from}`];
    
    return dirNames.map((name, index) => ({
       route_id: doc.id,
       route_short_name: data.route_short_name,
       direction_id: index,
       direction_label: name
    }));
  });

  return directions;
}

/**
 * Get all stops from Firestore
 */
export async function getStops(): Promise<Stop[]> {
  try {
    const stopsRef = collection(db, 'stops');
    const snapshot = await getDocs(stopsRef);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        stop_id: doc.id,
        stop_code: data.stop_code || data.stopcode,
        stop_name: data.stop_name || data.stopname,
        stop_lat: parseFloat(data.stop_lat || data.stoplat),
        stop_lon: parseFloat(data.stop_lon || data.stoplon),
        location_type: data.location_type || data.locationtype,
        parent_station: data.parent_station || data.parentstation,
        route_ids: data.route_ids || [],
        direction_id: data.direction_id
      } as Stop;
    });
  } catch (error) {
    console.error('Error fetching stops:', error);
    return [];
  }
}

/**
 * Get live vehicle positions (real-time)
 * This will be populated by your Cloud Function
 */
export async function getLiveVehicles(): Promise<LiveVehicle[]> {
  try {
    const vehiclesRef = collection(db, 'live_vehicles');
    const snapshot = await getDocs(vehiclesRef);
    return snapshot.docs.map(doc => ({
      vehicle_id: doc.id,
      ...doc.data()
    } as LiveVehicle));
  } catch (error) {
    console.error('Error fetching live vehicles:', error);
    return [];
  }
}

/**
 * Subscribe to live vehicle updates (real-time listener)
 * Updates automatically when Cloud Function writes new positions
 * UPDATED: Supports optional routeId filtering for efficiency
 */
export function subscribeToVehicles(
  callback: (vehicles: LiveVehicle[]) => void,
  onError?: (error: any) => void,
  routeId?: string
): () => void {
  const vehiclesRef = collection(db, 'live_vehicles');
  let q;
  
  // Optimization: If routeId provided, only listen to relevant docs
  if (routeId) {
      q = query(vehiclesRef, where('route_id', '==', routeId));
  } else {
      q = vehiclesRef;
  }
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const vehicles = snapshot.docs.map(doc => {
      const data = doc.data();
      
      // We rely on the data. If direction_id is missing, we leave it undefined.
      // Previous logic randomly assigned it, causing "wrong direction" visual bugs.
      let dirId = data.direction_id;

      return {
        vehicle_id: doc.id,
        trip_id: data.trip_id,
        route_id: data.route_id,
        latitude: data.latitude,
        longitude: data.longitude,
        // Convert Unix timestamp (seconds) to milliseconds for JavaScript Date
        timestamp: data.timestamp ? data.timestamp * 1000 : Date.now(),
        updated_at: data.updated_at,
        direction_id: dirId,
        heading: data.heading
      } as LiveVehicle;
    });
    callback(vehicles);
  }, (error) => {
    console.error('Error in vehicle subscription:', error);
    if (onError) onError(error);
  });

  return unsubscribe;
}

/**
 * Get active alerts relevant to a specific route.
 * Assumes service_alerts documents have a `routes` array of route_ids,
 * and optional time window.
 */
export async function getAlertsForRoute(routeId: string): Promise<ServiceAlert[]> {
  try {
    const alertsRef = collection(db, "service_alerts");
    const snapshot = await getDocs(alertsRef);

    const nowSec = Math.floor(Date.now() / 1000);

    return snapshot.docs
      .map((docSnap) => {
        const data = docSnap.data();
        return {
          alert_id: docSnap.id,
           // Map new fields, fall back to old fields if necessary
           title: data.title || data.header || 'Service Update',
           description: data.description || '',
           routes: data.routes || data.affected_routes || [],
           stops: data.stops || [],
           severity: (data.severity as AlertSeverity) || AlertSeverity.MEDIUM,
           category: (data.category as AlertCategory) || 'GENERAL',
           start_time: data.start_time,
           end_time: data.end_time,
           timestamp: data.timestamp
        } as ServiceAlert;
      })
      .filter((a) => {
        // Filter by route
        if (a.routes && a.routes.length > 0 && !a.routes.includes(routeId)) return false;

        // Filter by active time window if present
        if (a.start_time && a.start_time > nowSec) return false;
        if (a.end_time && a.end_time < nowSec) return false;

        return true;
      });
  } catch (e) {
    console.error("Error fetching route alerts:", e);
    return [];
  }
}

/**
 * Get service alerts from Firestore
 * Maps legacy data fields (header -> title) to match new ServiceAlert interface
 */
export async function getServiceAlerts(): Promise<ServiceAlert[]> {
  try {
    const alertsRef = collection(db, 'service_alerts');
    const snapshot = await getDocs(alertsRef);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        alert_id: doc.id,
        // Map new fields, fall back to old fields if necessary
        title: data.title || data.header || 'Service Update',
        description: data.description || '',
        routes: data.routes || data.affected_routes || [],
        stops: data.stops || [],
        severity: (data.severity as AlertSeverity) || AlertSeverity.MEDIUM,
        category: (data.category as AlertCategory) || 'GENERAL',
        start_time: data.start_time,
        end_time: data.end_time,
        timestamp: data.timestamp
      } as ServiceAlert;
    });
  } catch (error) {
    console.error('Error fetching service alerts:', error);
    return [];
  }
}

/**
 * Get stops for a specific route
 * Priority 1: Query stops where route_ids contains routeId
 * Priority 2: Fallback to spatial query if route_ids not present
 */
export async function getStopsForRoute(routeId: string, radiusKm: number = 0.5): Promise<Stop[]> {
  try {
    // 1. Try to fetch using route association (Better/Accurate)
    const stopsRef = collection(db, 'stops');
    const q = query(stopsRef, where('route_ids', 'array-contains', routeId));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          stop_id: doc.id,
          stop_name: data.stop_name || data.stopname,
          stop_lat: parseFloat(data.stop_lat || data.stoplat),
          stop_lon: parseFloat(data.stop_lon || data.stoplon),
          route_ids: data.route_ids || [],
          direction_id: data.direction_id
        } as Stop;
      });
    }

    // 2. Fallback: Spatial query (if data hasn't been seeded with route_ids)
    // Get all vehicles on this route
    const vehiclesRef = collection(db, 'live_vehicles');
    const vQ = query(vehiclesRef, where('route_id', '==', routeId));
    const vSnapshot = await getDocs(vQ);
    
    if (vSnapshot.empty) return [];
    
    const allStops = await getStops();
    const relevantStops = new Set<string>();
    
    vSnapshot.docs.forEach(doc => {
      const vehicle = doc.data();
      allStops.forEach(stop => {
        const distance = calculateDistance(
          vehicle.latitude,
          vehicle.longitude,
          stop.stop_lat,
          stop.stop_lon
        );
        if (distance <= radiusKm) {
          relevantStops.add(stop.stop_id);
        }
      });
    });
    
    return allStops.filter(stop => relevantStops.has(stop.stop_id));
  } catch (error) {
    console.error('Error fetching stops for route:', error);
    return [];
  }
}

/**
 * Get the polyline shape for a route
 * Returns an array of [lat, lon] points
 */
export async function getRouteShape(routeId: string): Promise<[number, number][]> {
    // In a full implementation, this would query a 'shapes' collection in Firestore
    // For this demo, we return pre-defined shapes from constants
    return ROUTE_SHAPES[routeId] || [];
}

/**
 * Seed the database with sample data if empty
 * Useful for initial setup
 */
export async function seedDatabase(): Promise<void> {
  try {
    const batch = writeBatch(db);

    // Seed Routes
    SAMPLE_ROUTES.forEach(route => {
      const ref = doc(db, 'routes', route.route_id);
      batch.set(ref, route);
    });

    // Seed Stops
    SAMPLE_STOPS.forEach(stop => {
      const ref = doc(db, 'stops', stop.stop_id);
      batch.set(ref, stop);
    });

    await batch.commit();
    console.log("Database seeded successfully");
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Export the Firestore instance for advanced queries
export { db };
