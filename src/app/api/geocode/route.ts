import { NextResponse } from "next/server";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

let lastRequestAt = 0;

async function throttledFetch(url: string): Promise<Response> {
  const now = Date.now();
  const wait = Math.max(0, 1100 - (now - lastRequestAt));
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestAt = Date.now();
  return fetch(url, {
    headers: {
      "User-Agent": "home-info-community-app/1.0 (resident directory; contact via site owner)",
    },
    next: { revalidate: 60 * 60 * 24 * 30 },
  });
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "Missing q" }, { status: 400 });
  }

  const url = new URL(NOMINATIM);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", q);

  try {
    const res = await throttledFetch(url.toString());
    if (!res.ok) {
      return NextResponse.json({ error: "Geocoder error" }, { status: 502 });
    }
    const data = (await res.json()) as { lat?: string; lon?: string }[];
    const hit = data[0];
    if (!hit?.lat || !hit?.lon) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      lat: Number.parseFloat(hit.lat),
      lon: Number.parseFloat(hit.lon),
    });
  } catch {
    return NextResponse.json({ error: "Geocoder failed" }, { status: 502 });
  }
}
