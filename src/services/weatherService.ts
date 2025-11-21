import { WeatherSnapshot } from "../types";

// Simple mapping from Open-Meteo weathercode to a label
function mapWeatherCodeToLabel(code: number): string {
  if (code === 0) return "Clear sky";
  if ([1, 2].includes(code)) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if ([51, 53, 55, 61, 63, 65].includes(code)) return "Rain";
  if ([71, 73, 75].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Mixed conditions";
}

/**
 * Fetch current weather for a lat/lon using Open-Meteo (no API key).
 */
export async function getWeatherForLocation(
  lat: number,
  lon: number
): Promise<WeatherSnapshot | null> {
  const url = "https://api.open-meteo.com/v1/forecast?" + new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current_weather: "true",
    hourly: "temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,weathercode",
    timezone: "auto"
  }).toString();

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error("Failed to fetch weather:", res.status);
      return null;
    }

    const data = await res.json();

    if (!data.current_weather) return null;

    const current = data.current_weather;
    const now = Date.now();

    const snapshot: WeatherSnapshot = {
      lat,
      lon,
      temperature: current.temperature,
      windSpeed: current.windspeed,
      conditionCode: current.weathercode,
      conditionLabel: mapWeatherCodeToLabel(current.weathercode),
      timestamp: now,
      feelsLike: current.temperature // approximate fallback
    };

    return snapshot;
  } catch (error) {
    console.error("Error fetching weather", error);
    return null;
  }
}

/**
 * Fetch forecast weather for a given time at a lat/lon using Open-Meteo hourly data.
 */
export async function getWeatherForLocationAtTime(
  lat: number,
  lon: number,
  targetTime: Date
): Promise<WeatherSnapshot | null> {
  const url = "https://api.open-meteo.com/v1/forecast?" + new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    hourly: "temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,weathercode",
    timezone: "auto"
  }).toString();

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error("Failed to fetch hourly weather:", res.status);
      return null;
    }

    const data = await res.json();
    if (!data.hourly || !data.hourly.time) return null;

    const targetMs = targetTime.getTime();
    let bestIndex = 0;
    let bestDiff = Number.POSITIVE_INFINITY;

    data.hourly.time.forEach((iso: string, idx: number) => {
      const t = Date.parse(iso);
      const diff = Math.abs(t - targetMs);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIndex = idx;
      }
    });

    const snapshot: WeatherSnapshot = {
      lat,
      lon,
      temperature: data.hourly.temperature_2m[bestIndex],
      feelsLike: data.hourly.apparent_temperature?.[bestIndex],
      precipitationProbability: data.hourly.precipitation_probability?.[bestIndex],
      windSpeed: data.hourly.wind_speed_10m?.[bestIndex],
      conditionCode: data.hourly.weathercode?.[bestIndex],
      conditionLabel: mapWeatherCodeToLabel(data.hourly.weathercode?.[bestIndex]),
      timestamp: targetMs,
    };

    return snapshot;
  } catch (error) {
    console.error("Error fetching forecast weather", error);
    return null;
  }
}
