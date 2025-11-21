// Geographic calculation utilities

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
};

const deg2rad = (deg: number) => {
  return deg * (Math.PI / 180);
};

export const estimateArrival = (distanceKm: number, speedKmph: number): number => {
    // Time = Distance / Speed * 60 (to get minutes)
    return Math.round((distanceKm / speedKmph) * 60);
};

// Parse a human-friendly duration string into total minutes.
// Examples it can handle:
//  - "35 min", "35 minutes"
//  - "1 h 10 m", "1 hour 10 min"
//  - "45" (assumed minutes)
export const parseDurationToMinutes = (duration: string): number | null => {
  if (!duration) return null;
  const lower = duration.toLowerCase();

  let total = 0;

  const hourMatch = lower.match(/(\d+)\s*h/);
  const hourWordMatch = lower.match(/(\d+)\s*hour/);
  const minMatch = lower.match(/(\d+)\s*m/);
  const minWordMatch = lower.match(/(\d+)\s*min/);

  const hStr = (hourMatch && hourMatch[1]) || (hourWordMatch && hourWordMatch[1]);
  const mStr = (minMatch && minMatch[1]) || (minWordMatch && minWordMatch[1]);

  if (hStr) {
    const h = parseInt(hStr, 10);
    if (!Number.isNaN(h)) total += h * 60;
  }

  if (mStr) {
    const m = parseInt(mStr, 10);
    if (!Number.isNaN(m)) total += m;
  }

  if (!total) {
    const fallback = parseInt(lower, 10);
    return Number.isNaN(fallback) ? null : fallback;
  }

  return total;
};

// Derive simple "from" and "to" labels for a route based on its long name.
// For example: "Clongriffin - City Centre" -> { from: "Clongriffin", to: "City Centre" }
export const deriveRouteEndpoints = (longName: string): { from: string; to: string } => {
  if (!longName) {
    return { from: "A", to: "B" };
  }

  const cleaned = longName.replace(/\s+/g, " ").trim();

  const trySplit = (sep: string): { from: string; to: string } | null => {
    const parts = cleaned.split(sep);
    if (parts.length >= 2) {
      return {
        from: parts[0].trim(),
        to: parts[parts.length - 1].trim(),
      };
    }
    return null;
  };

  return (
    trySplit(" - ") ||
    trySplit(" – ") ||
    trySplit(" — ") ||
    trySplit(" to ") ||
    { from: cleaned, to: cleaned }
  );
};
