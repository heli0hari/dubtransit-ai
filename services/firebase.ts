// Legacy Firebase Service - Deprecated
// All functionality moved to transportService.ts
import * as transportService from './transportService';

export const {
  getRoutes,
  getStops,
  getLiveVehicles,
  subscribeToVehicles,
  getAlertsForRoute,
  getServiceAlerts,
  getStopsForRoute,
  getRouteShape,
  seedDatabase,
  triggerRealtimeFetch
} = transportService;
