import { TransportType, Route, Stop } from './types';

export const SYSTEM_INSTRUCTION_JOURNEY = `
You are an expert public transport assistant for Dublin, Ireland. 
You have deep knowledge of Dublin Bus, Luas (Green and Red lines), and DART services.
When asked for a journey plan, provide a JSON response with a summary, total duration, and specific steps.
The user might ask vague queries like "How do I get to the Spire?". Assume they are starting from a central location if not specified, or ask for clarification in a structured error.
Always favor the fastest route.
`;

export const AVERAGE_BUS_SPEED_KMPH = 18; // Average city speed including stops

// Sample Data for Seeding Firestore
export const SAMPLE_ROUTES: Route[] = [
  {
    route_id: "15",
    route_short_name: "15",
    route_long_name: "Clongriffin - Ballycullen Rd",
    route_type: "3", // Bus
    agency_id: "DUB",
    route_color: "FFC72C",
    direction_names: ["To Ballycullen", "To Clongriffin"]
  },
  {
    route_id: "46A",
    route_short_name: "46A",
    route_long_name: "Phoenix Park - Dún Laoghaire",
    route_type: "3", // Bus
    agency_id: "DUB",
    route_color: "FFC72C",
    direction_names: ["To Dún Laoghaire", "To Phoenix Park"]
  },
  {
    route_id: "GRN",
    route_short_name: "Green",
    route_long_name: "Luas Green Line",
    route_type: "0", // Tram
    agency_id: "LUAS",
    route_color: "B3007D",
    direction_names: ["Southbound", "Northbound"]
  }
];

export const SAMPLE_STOPS: Stop[] = [
  {
    stop_id: "288",
    stop_name: "O'Connell St Lower",
    stop_lat: 53.3488,
    stop_lon: -6.2603,
    location_type: "0",
    route_ids: ["15", "46A", "GRN"]
  },
  {
    stop_id: "300",
    stop_name: "Trinity College",
    stop_lat: 53.3449,
    stop_lon: -6.2595,
    location_type: "0",
    route_ids: ["15", "46A", "GRN"]
  },
  {
    stop_id: "400",
    stop_name: "Heuston Station",
    stop_lat: 53.3463,
    stop_lon: -6.2931,
    location_type: "0",
    route_ids: ["145"]
  },
  {
    stop_id: "LUAS_GRN_SS",
    stop_name: "St. Stephen's Green",
    stop_lat: 53.3391,
    stop_lon: -6.2613,
    location_type: "0",
    route_ids: ["GRN"]
  },
  {
    stop_id: "2035",
    stop_name: "Merrion Square West",
    stop_lat: 53.3398,
    stop_lon: -6.2534,
    location_type: "0",
    route_ids: ["15", "46A"]
  },
  {
    stop_id: "765",
    stop_name: "Dún Laoghaire Stn",
    stop_lat: 53.2945,
    stop_lon: -6.1345,
    location_type: "0",
    route_ids: ["46A"]
  }
];

// Mock Shape Data (Lat/Lon arrays) for key routes to draw polylines
// In a real app, this comes from shapes.txt in GTFS
export const ROUTE_SHAPES: Record<string, [number, number][]> = {
  "15": [
    [53.4031, -6.1583], // Clongriffin
    [53.3950, -6.1750], // Hole in the wall
    [53.3892, -6.2001], // Malahide Rd
    [53.3750, -6.2150],
    [53.3635, -6.2300], // Fairview
    [53.3580, -6.2450],
    [53.3522, -6.2500], // Connolly
    [53.3498, -6.2603], // O'Connell
    [53.3449, -6.2595], // Trinity
    [53.3430, -6.2620], // Dame St
    [53.3400, -6.2640], // Georges St
    [53.3318, -6.2668], // Rathmines
    [53.3200, -6.2700],
    [53.3112, -6.2799], // Terenure
    [53.3000, -6.3000], // Templeogue
    [53.2900, -6.3150],
    [53.2833, -6.3245]  // Ballycullen
  ],
  "46A": [
    [53.3589, -6.2998], // Phoenix Park
    [53.3550, -6.2800], // NCR
    [53.3488, -6.2603], // O'Connell
    [53.3449, -6.2595], // Trinity
    [53.3398, -6.2534], // Merrion Sq
    [53.3340, -6.2560], // Leeson St
    [53.3230, -6.2380], // Donnybrook
    [53.3077, -6.1998], // Stillorgan
    [53.2950, -6.1800], // Foxrock
    [53.2889, -6.1567], // Glenageary
    [53.2945, -6.1345]  // Dun Laoghaire
  ],
  "GRN": [
    [53.3501, -6.2601], // Parnell
    [53.3449, -6.2595],
    [53.3391, -6.2613], // St Stephens
    [53.3310, -6.2590], // Harcourt
    [53.3211, -6.2588], // Ranelagh
    [53.3080, -6.2500], // Milltown
    [53.2902, -6.2331], // Dundrum
    [53.2701, -6.2021], // Sandyford
    [53.2500, -6.1800], // Leopardstown
    [53.2231, -6.1455]  // Brides Glen
  ]
};