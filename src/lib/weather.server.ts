import { windDirectionToCompass, wmoWeatherCodeToEmoji, wmoWeatherCodeToLabel } from "./weather";

/** Reference address for neighborhood weather (OSM may not resolve the street). */
export const WEATHER_ADDRESS_QUERY = "2406 Skywalk Ln, Spicewood, TX 78669, USA";

/** Travis County ZIP 78669 centroid when geocoding the street has no hit. */
const FALLBACK_LAT = 30.4149916;
const FALLBACK_LON = -98.0732441;

export type WeatherDay = {
  date: string;
  weekday: string;
  code: number;
  label: string;
  emoji: string;
  highF: number;
  lowF: number;
  precipProb: number | null;
};

export type WeatherPayload = {
  locationLabel: string;
  lat: number;
  lon: number;
  resolvedFrom: "address" | "zip";
  asOf: string;
  current: {
    tempF: number;
    apparentF: number;
    humidity: number;
    code: number;
    label: string;
    emoji: string;
    windMph: number;
    windDir: string;
  };
  daily: WeatherDay[];
};

type OpenMeteoResponse = {
  current?: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
  };
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max?: (number | null)[];
  };
};

async function resolveCoordinates(): Promise<{ lat: number; lon: number; resolvedFrom: "address" | "zip" }> {
  const q = encodeURIComponent(WEATHER_ADDRESS_QUERY);
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`, {
      headers: {
        "User-Agent": "my-home-info-community-app/1.0 (resident directory; contact via site owner)",
      },
      next: { revalidate: 86_400 },
    });
    if (!res.ok) throw new Error("geocode http");
    const data = (await res.json()) as { lat?: string; lon?: string }[];
    const hit = data[0];
    if (hit?.lat && hit?.lon) {
      return {
        lat: Number.parseFloat(hit.lat),
        lon: Number.parseFloat(hit.lon),
        resolvedFrom: "address",
      };
    }
  } catch {
    /* use fallback */
  }
  return { lat: FALLBACK_LAT, lon: FALLBACK_LON, resolvedFrom: "zip" };
}

export async function getWeatherForHomeArea(): Promise<WeatherPayload | null> {
  const { lat, lon, resolvedFrom } = await resolveCoordinates();

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("precipitation_unit", "inch");
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m",
  );
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max");
  url.searchParams.set("timezone", "America/Chicago");
  url.searchParams.set("forecast_days", "7");

  let json: OpenMeteoResponse;
  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 1800 },
    });
    if (!res.ok) return null;
    json = (await res.json()) as OpenMeteoResponse;
  } catch {
    return null;
  }

  const cur = json.current;
  const daily = json.daily;
  if (!cur || !daily?.time?.length) return null;

  const days: WeatherDay[] = daily.time.map((dateStr, i) => {
    const code = daily.weather_code[i] ?? 0;
    const highF = daily.temperature_2m_max[i] ?? 0;
    const lowF = daily.temperature_2m_min[i] ?? 0;
    const precipProb =
      daily.precipitation_probability_max?.[i] != null
        ? Number(daily.precipitation_probability_max[i])
        : null;
    const d = new Date(`${dateStr}T12:00:00`);
    const weekday = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "America/Chicago" });
    return {
      date: dateStr,
      weekday,
      code,
      label: wmoWeatherCodeToLabel(code),
      emoji: wmoWeatherCodeToEmoji(code),
      highF: Math.round(highF),
      lowF: Math.round(lowF),
      precipProb: precipProb != null && Number.isFinite(precipProb) ? Math.round(precipProb) : null,
    };
  });

  const code = cur.weather_code;
  const locationLabel =
    resolvedFrom === "address"
      ? "2406 Skywalk Ln · Spicewood"
      : "Spicewood area (ZIP 78669)";

  return {
    locationLabel,
    lat,
    lon,
    resolvedFrom,
    asOf: cur.time,
    current: {
      tempF: Math.round(cur.temperature_2m),
      apparentF: Math.round(cur.apparent_temperature),
      humidity: Math.round(cur.relative_humidity_2m),
      code,
      label: wmoWeatherCodeToLabel(code),
      emoji: wmoWeatherCodeToEmoji(code),
      windMph: Math.round(cur.wind_speed_10m * 10) / 10,
      windDir: windDirectionToCompass(cur.wind_direction_10m),
    },
    daily: days,
  };
}
