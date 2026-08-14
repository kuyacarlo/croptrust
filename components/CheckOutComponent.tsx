"use client";

import { useState, useEffect } from "react";
import { MapPin, Leaf, DollarSign, Scale, Shield, BadgeCheck, ExternalLink, Loader2 } from "lucide-react";
import type { LiveListing } from "@/lib/stellar/live-data";

interface CheckOutProps {
  listing: LiveListing;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirming?: boolean;
}

export default function CheckOutComponent({ listing, onConfirm, onCancel, confirming }: CheckOutProps) {
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiRec, setAiRec] = useState<string | null>(null);
  const [aiLabel, setAiLabel] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const label = listing.parcelName ?? listing.cropType ?? `Parcel #${listing.nftId}`;
  const ndviPercent =
    listing.ndviBps !== null ? `${(listing.ndviBps / 100).toFixed(2)}%` : null;
  const areaLabel =
    listing.parcelAreaHectares !== null
      ? `${listing.parcelAreaHectares.toFixed(2)} ha`
      : null;

  useEffect(() => {
    if (listing.ndviBps === null) return;
    const controller = new AbortController();

    async function fetchAiSummary() {
      setLoadingAi(true);
      try {
        const r = await fetch("/api/ai/ndvi-summary", {
          signal: controller.signal,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ndviBps: listing.ndviBps,
            cropType: listing.cropType,
            region: listing.region,
          }),
        });
        const d = await r.json();
        if (!controller.signal.aborted && d.ok) {
          setAiSummary(d.summary);
          setAiRec(d.recommendation);
          setAiLabel(d.healthLabel);
        }
      } catch {
        // Aborted or network error
      } finally {
        if (!controller.signal.aborted) setLoadingAi(false);
      }
    }

    fetchAiSummary();

    return () => {
      controller.abort();
    };
  }, [listing.ndviBps, listing.cropType, listing.region]);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold tracking-tight text-stone-900">Checkout Summary</h2>

      {/* Parcel info */}
      <div className="mb-4 space-y-2">
        <div className="flex items-start justify-between">
          <p className="font-semibold text-stone-800">{label}</p>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            <BadgeCheck size={12} />
            Farmer
          </span>
        </div>

        {listing.region && (
          <p className="flex items-center gap-1 text-xs text-stone-500">
            <MapPin size={12} />
            {listing.region}
          </p>
        )}

        {listing.farmer && (
          <p className="text-[11px] text-stone-400">
            Seller: {listing.farmer.slice(0, 8)}...{listing.farmer.slice(-6)}
          </p>
        )}
      </div>

      {/* Stats grid */}
      <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl bg-stone-50 p-3">
        {listing.priceXlm && (
          <div className="flex items-center gap-1.5 text-sm">
            <DollarSign size={14} className="text-emerald-700" />
            <span className="font-semibold">{listing.priceXlm}</span>
            <span className="text-xs text-stone-400">XLM</span>
          </div>
        )}
        {listing.quantityKg !== null && (
          <div className="flex items-center gap-1.5 text-sm">
            <Scale size={14} className="text-emerald-700" />
            <span className="font-semibold">{listing.quantityKg.toLocaleString()}</span>
            <span className="text-xs text-stone-400">kg</span>
          </div>
        )}
        {areaLabel && (
          <div className="flex items-center gap-1.5 text-sm">
            <Leaf size={14} className="text-emerald-700" />
            <span className="font-semibold">{areaLabel}</span>
          </div>
        )}
        {ndviPercent && (
          <div className="flex items-center gap-1.5 text-sm">
            <Shield size={14} className="text-emerald-700" />
            <span className="font-semibold">NDVI {ndviPercent}</span>
          </div>
        )}
      </div>

      {/* AI NDVI explanation */}
      {ndviPercent && (
        <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-800">
            NDVI Analysis
          </p>
          {loadingAi ? (
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <Loader2 size={12} className="animate-spin" />
              Analyzing satellite data...
            </div>
          ) : (
            <>
              {aiLabel && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    aiLabel === "Healthy"
                      ? "bg-emerald-100 text-emerald-700"
                      : aiLabel === "Moderate"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-50 text-red-600"
                  }`}
                >
                  {aiLabel}
                </span>
              )}
              {aiSummary && <p className="mt-1.5 text-xs leading-relaxed text-stone-600">{aiSummary}</p>}
              {aiRec && (
                <p className="mt-1.5 text-xs font-medium text-emerald-700">{aiRec}</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Payment breakdown */}
      <div className="mb-4 rounded-xl border border-stone-100 bg-stone-50/50 p-3">
        <p className="mb-2 text-xs font-semibold text-stone-500">Payment Split</p>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between text-stone-600">
            <span>Farmer (upfront)</span>
            <span className="font-medium">20%</span>
          </div>
          <div className="flex justify-between text-stone-600">
            <span>Escrow (on delivery)</span>
            <span className="font-medium">70%</span>
          </div>
          <div className="flex justify-between text-stone-500">
            <span>Treasury pool</span>
            <span className="font-medium">10%</span>
          </div>
        </div>
      </div>

      {/* Map link */}
      {listing.parcelBboxHash && (
        <a
          href={`/explore`}
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 underline-offset-2 hover:underline"
        >
          <ExternalLink size={12} />
          View on map
        </a>
      )}

      <div className="mt-auto flex gap-2">
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
          >
            Cancel
          </button>
        )}
        <button
          onClick={onConfirm}
          disabled={!onConfirm || confirming}
          className="flex-1 rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
        >
          {confirming ? <><Loader2 size={16} className="animate-spin mr-1" /> Processing...</> : "Confirm Purchase"}
        </button>
      </div>
    </div>
  );
}