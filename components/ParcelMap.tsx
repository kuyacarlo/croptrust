"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type MapMarkerData = {
  id: number;
  title: string;
  lat: number;
  lng: number;
};

type Props = {
  markers: MapMarkerData[];
  activeMarkerId?: number;
  onSelectMarker: (id: number) => void;
  onBoundsChange: (bounds: { north: number; south: number; east: number; west: number }) => void;
  drawMode?: "rect" | "polygon" | "none";
  onPolygonComplete?: (coords: { lat: number; lng: number }[]) => void;
  polygonCoords?: { lat: number; lng: number }[];
  polygonCenter?: { lat: number; lng: number } | null;
  savedPolygons?: { id: number; coords: { lat: number; lng: number }[]; center: { lat: number; lng: number } }[];
};

type GMap = {
  Map: new (el: HTMLElement, cfg: Record<string, unknown>) => Record<string, unknown>;
  LatLng: new (lat: number, lng: number) => { lat: () => number; lng: () => number };
  LatLngBounds: new (sw: unknown, ne: unknown) => unknown;
  marker?: { AdvancedMarkerElement: new (cfg: Record<string, unknown>) => Record<string, unknown> };
  Polygon: new (cfg: Record<string, unknown>) => {
    setPaths: (paths: { lat: number; lng: number }[]) => void;
    setMap: (m: unknown) => void;
    getPath?: () => { getArray: () => { lat: () => number; lng: () => number }[] };
  };
  event: {
    addListener: (src: unknown, e: string, h: (arg: { latLng?: { lat: () => number; lng: () => number } }) => void) => { remove: () => void };
    clearInstanceListeners: (src: unknown) => void;
  };
  Rectangle: new (cfg: Record<string, unknown>) => {
    setBounds: (b: unknown) => void;
    setMap: (m: unknown) => void;
    getBounds: () => { getNorthEast: () => { lat: () => number; lng: () => number }; getSouthWest: () => { lat: () => number; lng: () => number } };
    addListener: (e: string, h: () => void) => void;
  };
};

type GoogleWindow = Window & { google?: { maps: GMap }; [key: string]: unknown };

const SCRIPT_ID = "agri-con-google-maps";
let loader: Promise<void> | null = null;

function loadApi(key: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  const w = window as unknown as GoogleWindow;
  if (w.google?.maps?.Map && w.google?.maps?.Polygon) return Promise.resolve();
  if (loader) return loader;

  loader = new Promise<void>((resolve, reject) => {
    const cb = "agriConMapsReady";
    w[cb] = () => { resolve(); delete w[cb]; };
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.async = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&libraries=marker&v=weekly&callback=${cb}`;
    s.onerror = () => { loader = null; reject(new Error("Maps load failed")); };
    document.head.appendChild(s);
  });
  return loader;
}

function centerOf(coords: { lat: number; lng: number }[]): { lat: number; lng: number } {
  if (coords.length === 0) return { lat: 0, lng: 0 };
  const lat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
  const lng = coords.reduce((s, c) => s + c.lng, 0) / coords.length;
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

export default function ParcelMap({
  markers,
  activeMarkerId,
  onSelectMarker,
  onBoundsChange,
  drawMode = "rect",
  onPolygonComplete,
  polygonCoords = [],
  polygonCenter,
  savedPolygons = [],
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Record<string, unknown> | null>(null);
  const markersStore = useRef<Record<string, unknown>[]>([]);
  const rectRef = useRef<{ setBounds: (b: unknown) => void; setMap: (m: unknown) => void; addListener: (e: string, h: () => void) => void } | null>(null);
  const savedPolyRef = useRef<{ setMap: (m: unknown) => void } | null>(null);
  const centerMarkerRef = useRef<Record<string, unknown> | null>(null);
  const [drawingDone, setDrawingDone] = useState(false);

  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || undefined;
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  // Init map
  useEffect(() => {
    if (!ref.current || !key || mapRef.current) return;
    let cancelled = false;

    loadApi(key).then(() => {
      if (cancelled || !ref.current) return;
      const gmap = (window as unknown as GoogleWindow).google?.maps as GMap | undefined;
      if (!gmap) return;

      const center = markers.length > 0
        ? { lat: markers[0].lat, lng: markers[0].lng }
        : { lat: 14.5995, lng: 120.9842 };

      const mapCfg: Record<string, unknown> = {
        center,
        zoom: 12,
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
      };
      if (mapId) mapCfg.mapId = mapId;

      mapRef.current = new gmap.Map(ref.current, mapCfg);
    }).catch(() => {});

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Markers
  useEffect(() => {
    const gmap = (window as unknown as GoogleWindow).google?.maps as GMap | undefined;
    if (!gmap?.marker?.AdvancedMarkerElement || !mapRef.current) return;

    markersStore.current.forEach((m) => { try { (m as { setMap: (m: null) => void }).setMap(null); } catch {} });
    markersStore.current = [];

    const Adv = gmap.marker.AdvancedMarkerElement;
    markers.forEach((item) => {
      const cfg: Record<string, unknown> = { map: mapRef.current, position: { lat: item.lat, lng: item.lng }, title: item.title, gmpClickable: true };
      const am = new Adv(cfg);
      try { (am as { addListener: (e: string, h: () => void) => void }).addListener("gmp-click", () => onSelectMarker(item.id)); } catch {}
      markersStore.current.push(am);
    });
  }, [markers, onSelectMarker]);

  // Rectangle + pan for selected marker
  useEffect(() => {
    const gmap = (window as unknown as GoogleWindow).google?.maps as GMap | undefined;
    if (!gmap || !mapRef.current) return;

    if (activeMarkerId == null) {
      if (rectRef.current) { rectRef.current.setMap(null); rectRef.current = null; }
      return;
    }

    const active = markers.find((m) => m.id === activeMarkerId);
    if (!active || (active.lat === 0 && active.lng === 0)) {
      if (rectRef.current) { rectRef.current.setMap(null); rectRef.current = null; }
      return;
    }

    (mapRef.current as { panTo?: (p: unknown) => void }).panTo?.({ lat: active.lat, lng: active.lng });
    (mapRef.current as { setZoom?: (z: number) => void }).setZoom?.(13);

    if (rectRef.current) {
      rectRef.current.setBounds(new gmap.LatLngBounds(new gmap.LatLng(active.lat - 0.05, active.lng - 0.05), new gmap.LatLng(active.lat + 0.05, active.lng + 0.05)));
    } else {
      const rect = new gmap.Rectangle({
        map: mapRef.current,
        bounds: { north: active.lat + 0.05, south: active.lat - 0.05, east: active.lng + 0.05, west: active.lng - 0.05 },
        editable: true, draggable: true, strokeColor: "#10b981", strokeOpacity: 0.8, strokeWeight: 2, fillColor: "#10b981", fillOpacity: 0.1,
      });
      rect.addListener("bounds_changed", () => {
        try {
          const b = rect.getBounds();
          if (b) onBoundsChange({ north: b.getNorthEast().lat(), south: b.getSouthWest().lat(), east: b.getNorthEast().lng(), west: b.getSouthWest().lng() });
        } catch {}
      });
      rectRef.current = rect;
    }
  }, [activeMarkerId, markers, onBoundsChange]);

  // Polygon drawing — native click-to-place, double-click to close
  useEffect(() => {
    const gmap = (window as unknown as GoogleWindow).google?.maps as GMap | undefined;
    if (!gmap || !mapRef.current) return;

    if (drawMode !== "polygon") {
      return;
    }

    const points: { lat: number; lng: number }[] = [];
    let drawingPoly: { setPaths: (p: { lat: number; lng: number }[]) => void; setMap: (m: unknown) => void } | null = null;
    const vertexMarkers: Record<string, unknown>[] = [];

    // Create invisible polygon for visual feedback (empty initially)
    drawingPoly = new gmap.Polygon({
      map: mapRef.current,
      paths: [],
      strokeColor: "#10b981", strokeOpacity: 0.8, strokeWeight: 2,
      fillColor: "#10b981", fillOpacity: 0.15,
      editable: false, draggable: false, clickable: false,
    }) as { setPaths: (p: { lat: number; lng: number }[]) => void; setMap: (m: unknown) => void };

    const clickHandler = (e: { latLng?: { lat: () => number; lng: () => number } }) => {
      if (!e.latLng) return;
      const pt = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      points.push(pt);

      // Update polygon outline only. Individual vertex markers are intentionally
      // not rendered — a single marker is placed at the polygon's center once it
      // is closed (see the saved-polygon display effect below).
      drawingPoly?.setPaths([...points]);
    };

    const dblClickHandler = () => {
      if (points.length < 3) return;

      // Clean up
      gmap.event.clearInstanceListeners(mapRef.current);
      vertexMarkers.forEach((m) => { try { (m as { setMap: (m: null) => void }).setMap(null); } catch {} });
      if (drawingPoly) drawingPoly.setMap(null);

      onPolygonComplete?.(points);
      setDrawingDone(true);
    };

    gmap.event.addListener(mapRef.current, "click", clickHandler);
    gmap.event.addListener(mapRef.current, "dblclick", dblClickHandler);

    return () => {
      gmap.event.clearInstanceListeners(mapRef.current);
      vertexMarkers.forEach((m) => { try { (m as { setMap: (m: null) => void }).setMap(null); } catch {} });
      if (drawingPoly) drawingPoly.setMap(null);
      setDrawingDone(false);
    };
  }, [drawMode, onPolygonComplete]);

  // Display saved polygon overlay + center marker
  useEffect(() => {
    const gmap = (window as unknown as GoogleWindow).google?.maps as GMap | undefined;
    if (!gmap || !mapRef.current) return;

    if (savedPolyRef.current) { savedPolyRef.current.setMap(null); savedPolyRef.current = null; }
    if (centerMarkerRef.current) { try { (centerMarkerRef.current as { setMap: (m: null) => void }).setMap(null); } catch {}; centerMarkerRef.current = null; }

    if (polygonCoords.length >= 3 && gmap.Polygon) {
      const poly = new gmap.Polygon({
        map: mapRef.current,
        paths: polygonCoords,
        strokeColor: "#8b5cf6", strokeOpacity: 0.8, strokeWeight: 2,
        fillColor: "#8b5cf6", fillOpacity: 0.15,
        editable: false, draggable: false,
      });
      savedPolyRef.current = poly as { setMap: (m: unknown) => void };
    }

    if (polygonCenter && gmap.marker?.AdvancedMarkerElement) {
      const m = new gmap.marker.AdvancedMarkerElement({
        map: mapRef.current, position: polygonCenter, title: "Area Center", gmpClickable: true,
      });
      try {
        (m as { addListener: (e: string, h: () => void) => void }).addListener("gmp-click", () => {
          const active = markers.find((mk) => mk.lat === polygonCenter.lat && mk.lng === polygonCenter.lng);
          if (active) onSelectMarker(active.id);
        });
      } catch {}
      centerMarkerRef.current = m;
    }
  }, [polygonCoords, polygonCenter]);

  return (
    <div className="relative h-full w-full">
      <div ref={ref} className="h-full w-full" />
      {drawMode === "polygon" && !drawingDone && (
        <div className="absolute bottom-3 left-3 rounded-lg bg-emerald-900/85 px-3 py-1.5 text-xs font-medium text-emerald-100 shadow-lg z-10">
          Click to place vertices. Double-click to finish (&ge;3 points).
        </div>
      )}
    </div>
  );
}