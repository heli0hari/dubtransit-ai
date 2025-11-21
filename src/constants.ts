// src/constants.ts
import { Route, Stop } from './types';

export const SYSTEM_INSTRUCTION_JOURNEY = `
You are an expert public transport assistant for Dublin, Ireland. 
You have deep knowledge of Dublin Bus, Luas (Green and Red lines), and DART services.
When asked for a journey plan, provide a JSON response with a summary, total duration, and specific steps.
The user might ask vague queries like "How do I get to the Spire?". Assume they are starting from a central location if not specified, or ask for clarification in a structured error.
Always favour the fastest route.
`;

export const AVERAGE_BUS_SPEED_KMPH = 18; // Average city speed including stops

// --------- Sample routes ---------
export const SAMPLE_ROUTES: Route[] = [
  {
    route_id: '15',
    route_short_name: '15',
    route_long_name: 'Clongriffin - Ballycullen Rd',
    route_type: '3', // Bus
    agency_id: 'DUB',
    route_color: 'FFC72C',
    direction_names: ['To Ballycullen', 'To Clongriffin'],
  },
  {
    route_id: '46A',
    route_short_name: '46A',
    route_long_name: 'Phoenix Park - Dún Laoghaire',
    route_type: '3', // Bus
    agency_id: 'DUB',
    route_color: 'FFC72C',
    direction_names: ['To Dún Laoghaire', 'To Phoenix Park'],
  },
  {
    route_id: 'GRN',
    route_short_name: 'Green',
    route_long_name: 'Luas Green Line',
    route_type: '0', // Tram
    agency_id: 'LUAS',
    route_color: 'B3007D',
    direction_names: ['Southbound', 'Northbound'],
  },
];

// --------- Sample stops ---------
export const SAMPLE_STOPS: Stop[] = [
  {
    stop_id: '288',
    stop_name: "O'Connell St Lower",
    stop_lat: 53.3488,
    stop_lon: -6.2603,
    location_type: '0',
    route_ids: ['15', '46A', 'GRN'],
  },
  {
    stop_id: '300',
    stop_name: 'Trinity College',
    stop_lat: 53.3449,
    stop_lon: -6.2595,
    location_type: '0',
    route_ids: ['15', '46A', 'GRN'],
  },
  {
    stop_id: '400',
    stop_name: 'Heuston Station',
    stop_lat: 53.3463,
    stop_lon: -6.2931,
    location_type: '0',
    route_ids: ['145'],
  },
  {
    stop_id: 'LUAS_GRN_SS',
    stop_name: "St. Stephen's Green",
    stop_lat: 53.3391,
    stop_lon: -6.2613,
    location_type: '0',
    route_ids: ['GRN'],
  },
  {
    stop_id: '2035',
    stop_name: 'Merrion Square West',
    stop_lat: 53.3398,
    stop_lon: -6.2534,
    location_type: '0',
    route_ids: ['15', '46A'],
  },
  {
    stop_id: '765',
    stop_name: 'Dún Laoghaire Stn',
    stop_lat: 53.2945,
    stop_lon: -6.1345,
    location_type: '0',
    route_ids: ['46A'],
  },
];

// --------- Landmarks ---------
export interface DublinLandmark {
  name: string;
  lat: number;
  lon: number;
  type: 'landmark';
}

export const DUBLIN_LANDMARKS: DublinLandmark[] = [
  { name: 'Dublin Airport (DUB)',  lat: 53.4264, lon: -6.2499, type: 'landmark' },
  { name: '3Arena',                lat: 53.3475, lon: -6.2285, type: 'landmark' },
  { name: 'Aviva Stadium',         lat: 53.3352, lon: -6.2285, type: 'landmark' },
  { name: 'Croke Park',            lat: 53.3607, lon: -6.2512, type: 'landmark' },
  { name: 'The Spire',             lat: 53.3498, lon: -6.2603, type: 'landmark' },
  { name: 'Guinness Storehouse',   lat: 53.3419, lon: -6.2867, type: 'landmark' },
  { name: 'Phoenix Park',          lat: 53.3559, lon: -6.3298, type: 'landmark' },
  { name: 'Dundrum Town Centre',   lat: 53.2876, lon: -6.2416, type: 'landmark' },
  { name: 'Blanchardstown Centre', lat: 53.3924, lon: -6.3930, type: 'landmark' },
  { name: 'Tallaght Hospital',     lat: 53.2878, lon: -6.3772, type: 'landmark' },
  { name: 'UCD Belfield',          lat: 53.3069, lon: -6.2213, type: 'landmark' },
  { name: 'DCU Glasnevin',         lat: 53.3860, lon: -6.2588, type: 'landmark' },
];

// --------- Route shapes for the map polylines ---------
export const ROUTE_SHAPES: Record<string, [number, number][]> = {
  '15': [
    [53.4031, -6.1583],
    [53.395, -6.175],
    [53.3892, -6.2001],
    [53.375, -6.215],
    [53.3635, -6.23],
    [53.358, -6.245],
    [53.3522, -6.25],
    [53.3498, -6.2603],
    [53.3449, -6.2595],
    [53.343, -6.262],
    [53.34, -6.264],
    [53.3318, -6.2668],
    [53.32, -6.27],
    [53.3112, -6.2799],
    [53.3, -6.3],
    [53.29, -6.315],
    [53.2833, -6.3245],
  ],
  '46A': [
    [53.3589, -6.2998],
    [53.355, -6.28],
    [53.3488, -6.2603],
    [53.3449, -6.2595],
    [53.3398, -6.2534],
    [53.334, -6.256],
    [53.323, -6.238],
    [53.3077, -6.1998],
    [53.295, -6.18],
    [53.2889, -6.1567],
    [53.2945, -6.1345],
  ],
  'GRN': [
    [53.3501, -6.2601],
    [53.3449, -6.2595],
    [53.3391, -6.2613],
    [53.331, -6.259],
    [53.3211, -6.2588],
    [53.308, -6.25],
    [53.2902, -6.2331],
    [53.2701, -6.2021],
    [53.25, -6.18],
    [53.2231, -6.1455],
  ],
};
