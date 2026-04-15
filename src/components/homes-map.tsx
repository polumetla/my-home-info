"use client";

import type { HomeRecord } from "@/lib/homes";
import { filterHomesByQuery, formatAddress, formatLivingAreaSqft } from "@/lib/homes";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "@/lib/map-config";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const GEO_CACHE_KEY = "my-home-info-geocode-v1";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Coord = { lat: number; lon: number };

function loadCoordCache(): Record<string, Coord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(GEO_CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, Coord>;
  } catch {
    return {};
  }
}

function saveCoordCache(cache: Record<string, Coord>) {
  try {
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore quota */
  }
}

function fixLeafletIcons() {
  delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  });
}

export default function HomesMap({ homes }: { homes: HomeRecord[] }) {
  const [query, setQuery] = useState("");
  const [coords, setCoords] = useState<Record<string, Coord>>({});
  const [geocodeDone, setGeocodeDone] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const markerByIdRef = useRef<Map<string, L.Marker>>(new Map());

  const filtered = useMemo(() => filterHomesByQuery(homes, query), [homes, query]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    fixLeafletIcons();
    const map = L.map(mapRef.current, { zoomControl: true }).setView(
      DEFAULT_MAP_CENTER,
      DEFAULT_MAP_ZOOM,
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    const layer = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    markersLayerRef.current = layer;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      markerByIdRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (homes.length === 0) {
      setGeocodeDone(true);
      return;
    }

    let cancelled = false;
    const cache = { ...loadCoordCache() };
    setCoords(cache);
    setGeocodeProgress(0);

    async function run() {
      let done = 0;
      for (const h of homes) {
        if (cancelled) break;
        if (cache[h.id]) {
          done++;
          setGeocodeProgress(done);
          continue;
        }

        const addr = formatAddress(h);
        try {
          const res = await fetch(`/api/geocode?q=${encodeURIComponent(addr)}`);
          if (res.ok) {
            const j = (await res.json()) as { lat: number; lon: number };
            if (typeof j.lat === "number" && typeof j.lon === "number") {
              cache[h.id] = { lat: j.lat, lon: j.lon };
              setCoords({ ...cache });
              saveCoordCache(cache);
            }
          }
        } catch {
          /* skip */
        }
        done++;
        setGeocodeProgress(done);
        await new Promise((r) => setTimeout(r, 1100));
      }

      if (!cancelled) setGeocodeDone(true);
    }

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- homes list is static from bundled JSON
  }, [homes.length]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    markerByIdRef.current.clear();

    const bounds: L.LatLngExpression[] = [];
    for (const h of filtered) {
      const c = coords[h.id];
      if (!c) continue;
      const ll: L.LatLngExpression = [c.lat, c.lon];
      bounds.push(ll);
      const detailHref = `/homes/${encodeURIComponent(h.id)}`;
      const popup = [
        `<strong>${escapeHtml(formatAddress(h))}</strong>`,
        typeof h.septicField === "number" ? `Septic field #${h.septicField}` : "",
        h.builder?.trim() ? `Builder: ${escapeHtml(h.builder.trim())}` : "",
        typeof h.squareFeet === "number" && Number.isFinite(h.squareFeet)
          ? `Living area: ${escapeHtml(formatLivingAreaSqft(h))}`
          : "",
        `<a href="${detailHref}">House page</a>`,
      ]
        .filter(Boolean)
        .join("<br/>");
      const m = L.marker(ll).bindPopup(popup);
      m.addTo(layer);
      markerByIdRef.current.set(h.id, m);
    }

    if (bounds.length === 1) {
      map.setView(bounds[0]!, 17);
    } else if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 17 });
    } else {
      map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
    }
  }, [filtered, coords]);

  const flyToHome = useCallback((id: string) => {
    setSelectedId(id);
    const c = coords[id];
    const map = mapInstanceRef.current;
    const marker = markerByIdRef.current.get(id);
    if (!map || !c) return;
    map.setView([c.lat, c.lon], Math.max(map.getZoom(), 16));
    marker?.openPopup();
  }, [coords]);

  return (
    <div className="relative -mx-4 -my-10 w-[100vw] max-w-none self-stretch md:left-1/2 md:right-1/2 md:-ml-[50vw] md:-mr-[50vw] md:w-screen">
      <div className="relative h-[calc(100dvh-5.5rem)] min-h-[28rem] w-full md:h-[calc(100dvh-4.5rem)]">
        <div ref={mapRef} className="absolute inset-0 z-0 h-full w-full bg-surface-muted" />

        <div className="pointer-events-none absolute inset-0 z-[400] flex flex-col p-3 sm:p-4">
          <div className="pointer-events-auto flex max-h-[min(52vh,28rem)] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-lg backdrop-blur-sm">
            <div className="border-b border-slate-100 p-3">
              <div className="flex items-center justify-between gap-2">
                <Link
                  href="/homes"
                  className="text-sm font-medium text-accent-dark hover:underline"
                >
                  ← List
                </Link>
                <span className="text-xs tabular-nums text-slate-500">
                  {filtered.length}/{homes.length}
                </span>
              </div>
              <label className="mt-2 block">
                <span className="sr-only">Search</span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search address or septic #"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  autoComplete="off"
                />
              </label>
              {!geocodeDone && homes.length > 0 && (
                <p className="mt-2 text-xs tabular-nums text-slate-500">
                  {geocodeProgress}/{homes.length}
                </p>
              )}
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {filtered.map((h) => {
                const hasPin = coords[h.id] != null;
                const active = selectedId === h.id;
                return (
                  <li key={h.id} className="flex border-b border-slate-100">
                    <button
                      type="button"
                      disabled={!hasPin}
                      onClick={() => flyToHome(h.id)}
                      className={`flex min-w-0 flex-1 flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm transition hover:bg-slate-50 disabled:cursor-default disabled:opacity-50 ${
                        active ? "bg-teal-50" : ""
                      }`}
                    >
                      <span className="font-medium text-ink">{formatAddress(h)}</span>
                      {typeof h.septicField === "number" && (
                        <span className="text-xs text-ink-muted">Septic #{h.septicField}</span>
                      )}
                      {h.builder?.trim() && (
                        <span className="text-xs text-ink-muted">{h.builder.trim()}</span>
                      )}
                      {typeof h.squareFeet === "number" && Number.isFinite(h.squareFeet) && (
                        <span className="text-xs tabular-nums text-ink-muted">
                          {h.squareFeet.toLocaleString()} sq ft
                        </span>
                      )}
                    </button>
                    <Link
                      href={`/homes/${encodeURIComponent(h.id)}`}
                      className="flex shrink-0 items-center px-3 py-2.5 text-sm font-medium text-accent-dark hover:bg-slate-50"
                    >
                      Page
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
