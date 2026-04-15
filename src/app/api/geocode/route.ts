import { geocodeAddress } from "@/lib/geocode.server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "Missing q" }, { status: 400 });
  }

  try {
    const out = await geocodeAddress(q);
    if (!out) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ lat: out.lat, lon: out.lon });
  } catch {
    return NextResponse.json({ error: "Geocoder failed" }, { status: 502 });
  }
}
