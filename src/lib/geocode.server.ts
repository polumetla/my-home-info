/** Server-side geocoding: Google (optional key) then U.S. Census (no key). */

const CENSUS_ONE_LINE =
  "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";

const UA = "my-home-info-community-app/1.0 (resident directory; contact via site owner)";

export type GeocodeResult = { lat: number; lon: number };

export async function geocodeWithGoogle(q: string, apiKey: string): Promise<GeocodeResult | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", q);
  url.searchParams.set("components", "country:US");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": UA },
    next: { revalidate: 60 * 60 * 24 * 7 },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    status?: string;
    results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } } }>;
  };
  if (data.status !== "OK" || !data.results?.length) return null;

  const loc = data.results[0]?.geometry?.location;
  const lat = Number(loc?.lat);
  const lon = Number(loc?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

export async function geocodeWithCensus(q: string): Promise<GeocodeResult | null> {
  const url = new URL(CENSUS_ONE_LINE);
  url.searchParams.set("address", q);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": UA },
    next: { revalidate: 60 * 60 * 24 * 7 },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    result?: { addressMatches?: Array<{ coordinates: { x: number; y: number } }> };
  };
  const m = data.result?.addressMatches?.[0];
  if (!m?.coordinates) return null;
  const lon = Number(m.coordinates.x);
  const lat = Number(m.coordinates.y);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

/** Prefer `GOOGLE_GEOCODING_API_KEY` when set; otherwise Census only. */
export async function geocodeAddress(q: string): Promise<GeocodeResult | null> {
  const key = process.env.GOOGLE_GEOCODING_API_KEY?.trim();
  if (key) {
    const g = await geocodeWithGoogle(q, key);
    if (g) return g;
  }
  return geocodeWithCensus(q);
}
