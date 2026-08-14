"use client";

import { useState } from "react";
import ParcelMap from "@/components/ParcelMap";
import SatelliteVerificationPanel from "@/components/SatelliteVerificationPanel";

type LandParcel = {
  id: number;
  title: string;
  lat: number;
  lng: number;
  temporalExtent: { start: string; end: string };
};

type Props = {
  parcels: LandParcel[];
};

function round(value: number) {
  return Number(value.toFixed(6));
}

export default function ParcelVerificationWorkspace({ parcels }: Props) {
  const [selectedParcel, setSelectedParcel] = useState<LandParcel | null>(null);
  const [aiQuery, setAiQuery] = useState("");
  const [bbox, setBbox] = useState({ west: 0, south: 0, east: 0, north: 0 });

  const approxKmWidth = selectedParcel ? ((bbox.east - bbox.west) * 111).toFixed(1) : "0.0";
  const approxKmHeight = selectedParcel ? ((bbox.north - bbox.south) * 111).toFixed(1) : "0.0";
  const estimatedAcres = selectedParcel
    ? Math.round(Math.abs(bbox.east - bbox.west) * 111 * Math.abs(bbox.north - bbox.south) * 111 * 247.105)
    : 0;

  const handleMarkerSelect = (parcelId: number) => {
    const match = parcels.find((p) => p.id === parcelId);
    if (!match) return;

    setSelectedParcel(match);
    setBbox({
      west: round(match.lng - 0.05),
      south: round(match.lat - 0.05),
      east: round(match.lng + 0.05),
      north: round(match.lat + 0.05),
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <section className="relative h-[calc(100vh-4rem)] w-full overflow-hidden bg-stone-100 rounded-2xl border border-stone-200 shadow-sm">
      {/* 1. Full space Map Layer - Set to absolute to guarantee 100% coverage */}
      <div className="absolute inset-0 z-0 h-full w-full">
        <ParcelMap
          markers={parcels}
          activeMarkerId={selectedParcel?.id}
          onSelectMarker={handleMarkerSelect}
          onBoundsChange={(bounds) => setBbox({
            west: round(bounds.west),
            south: round(bounds.south),
            east: round(bounds.east),
            north: round(bounds.north),
          })}
        />
      </div>

      {/* Dynamic Status Overlay - Floating over the map layout */}
      {selectedParcel && (
        <div className="absolute top-4 left-4 z-10 flex gap-4 text-sm bg-white/95 backdrop-blur border border-stone-200 rounded-xl p-3 shadow-md pointer-events-auto">
          <div>
            <span className="text-[10px] uppercase font-bold text-stone-400 block tracking-wider">Scanner Size</span>
            <span className="font-bold text-stone-800">{approxKmWidth} x {approxKmHeight} km</span>
          </div>
          <div className="border-l border-stone-200 pl-4">
            <span className="text-[10px] uppercase font-bold text-stone-400 block tracking-wider">Calculated Area</span>
            <span className="font-bold text-emerald-600">{estimatedAcres.toLocaleString()} Acres</span>
          </div>
        </div>
      )}

      {/* 2. Slide-out Control Sidebar Panel */}
      <div
        className={`absolute top-0 right-0 h-full w-full max-w-sm sm:max-w-md bg-stone-900 border-l border-stone-800 shadow-2xl p-6 text-stone-100 flex flex-col justify-between transition-transform duration-300 ease-in-out z-20 ${
          selectedParcel ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {selectedParcel && (
          <div className="flex flex-col h-full justify-between">
            <div className="space-y-6 overflow-y-auto pr-1">
              <div className="flex items-start justify-between border-b border-stone-800 pb-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Selected Farmstead</span>
                  <h1 className="text-xl font-bold text-white mt-0.5 tracking-tight">{selectedParcel.title}</h1>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedParcel(null)}
                  className="rounded-lg bg-stone-800 p-2 text-stone-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="bg-stone-950/50 rounded-xl p-4 border border-stone-800/80 space-y-2.5">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-stone-400">Time-window:</span>
                  <span className="font-medium text-stone-200">
                    {formatDate(selectedParcel.temporalExtent.start)} – {formatDate(selectedParcel.temporalExtent.end)}
                  </span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm items-center">
                  <span className="text-stone-400">System Mode:</span>
                  <span className="text-[10px] font-bold uppercase bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800/50">
                    Satellite Oracle
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-emerald-950/30 border border-emerald-800/20 p-4">
                <div className="flex gap-2.5 items-center">
                  <span className="text-emerald-400 text-lg">💡</span>
                  <p className="text-xs text-emerald-100 font-medium leading-relaxed">
                    <strong>Canva Sizing Mode Active:</strong> Use the dot handles on the green map rectangle to stretch or shrink the verification grid directly over your land bounds.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-stone-800 bg-stone-950 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm">✨</span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-200">Ask Farm AI</h3>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ask about this parcel's index..."
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    className="flex-1 rounded-lg bg-stone-900 border border-stone-800 p-2 text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
                    onClick={() => alert(`AI Analysis requested for: "${aiQuery}"`)}
                  >
                    Query
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-stone-800">
              <SatelliteVerificationPanel
                nftId={selectedParcel.id}
                bbox={bbox}
                minNdviBps={3500}
                temporalExtent={selectedParcel.temporalExtent}
                sampleGridSize={20}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
