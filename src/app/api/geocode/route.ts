import { NextResponse } from "next/server";

/** U.S. Census Geocoder (TIGER) — reliable for Texas street addresses; no API key. */
const CENSUS_ONE_LINE =
  "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "Missing q" }, { status: 400 });
  }

  const url = new URL(CENSUS_ONE_LINE);
  url.searchParams.set("address", q);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "my-home-info-community-app/1.0 (resident directory; contact via site owner)",
      },
      next: { revalidate: 60 * 60 * 24 * 7 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Geocoder error" }, { status: 502 });
    }
    const data = (await res.json()) as {
      result?: { addressMatches?: Array<{ coordinates: { x: number; y: number } }> };
    };
    const m = data.result?.addressMatches?.[0];
    if (!m?.coordinates) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const lon = Number(m.coordinates.x);
    const lat = Number(m.coordinates.y);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ lat, lon });
  } catch {
    return NextResponse.json({ error: "Geocoder failed" }, { status: 502 });
  }
}
