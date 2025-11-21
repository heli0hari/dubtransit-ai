
export enum TransportType {
  BUS = 'BUS',
  LUAS = 'LUAS',
  DART = 'DART'
}

export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

export type AlertCategory = 'GENERAL' | 'EVENT' | 'ACCIDENT' | 'WEATHER';

// Matches Firestore Route
export interface Route {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  route_type: string;
  route_color?: string;
  agency_id: string;
  direction_names?: string[]; // ["Inbound", "Outbound"]
}

// Matches Firestore Stop
export interface Stop {
  stop_id: string;
  stop_code?: string;
  stop_name: string;
  stop_lat: number;
  stop_lon: number;
  location_type?: string;
  parent_station?: string;
  route_ids?: string[]; // Array of route IDs that serve this stop
  direction_id?: number; // 0 or 1, if known
}

// Matches Firestore LiveVehicle
export interface LiveVehicle {
  vehicle_id: string;
  trip_id?: string;
  route_id?: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  updated_at?: any;
  direction_id?: number; // 0 or 1
  heading?: number;
}

export interface ServiceAlert {
  alert_id: string;
  title: string;
  description: string;

  // Optional targeting
  routes?: string[];      // e.g. ["15", "46A"]
  stops?: string[];       // stop_ids affected

  // Metadata
  severity?: AlertSeverity;
  category?: AlertCategory;

  // Unix timestamps in seconds
  start_time?: number;
  end_time?: number;
  timestamp?: number;
}

export interface JourneyPlan {
  summary: string;
  totalDuration: string;
  steps: JourneyStep[];
}

export interface JourneyStep {
  instruction: string;
  duration: string;
  mode: string;
}

export interface WeatherSnapshot {
  lat: number;
  lon: number;
  temperature: number;            // °C
  feelsLike?: number;             // °C
  precipitationProbability?: number; // %
  windSpeed?: number;             // km/h
  conditionCode?: number;         // raw weathercode from API
  conditionLabel?: string;        // simple text like "Light rain"
  timestamp: number;              // ms since epoch
}
