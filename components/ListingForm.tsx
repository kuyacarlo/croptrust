"use client";

import { useState } from "react";
import {
  MapPin,
  Satellite,
  Rocket,
  Sprout,
  DollarSign,
  Scale,
  User,
  Hash,
  Crosshair,
  Loader2,
  X,
  MapPinned,
  Image,
} from "lucide-react";
import SatelliteVerificationPanel from "@/components/SatelliteVerificationPanel";

const CROP_TYPES = ["rice", "corn", "wheat", "sugarcane", "soybean", "coconut", "banana", "coffee", "cacao", "mango"] as const;

interface Bbox {
  west: number;
  south: number;
  east: number;
  north: number;
}

interface Props {
  polygonCoords: { lat: number; lng: number }[];
  polygonCenter: { lat: number; lng: number } | null;
  displayBbox: Bbox;
  parcelName: string;
  cropType: string;
  cropTypeCustom: string;
  quantityKg: string;
  priceXlm: string;
  totalYieldKg: string;
  region: string;
  harvestDate: string;
  mintError: string | null;
  ndviBpsResult: number | null;
  ndviRun: boolean;
  mintStep: "form" | "minting";
  formValid: boolean;
  approximateHectares: number;
  onParcelNameChange: (v: string) => void;
  onCropTypeChange: (v: string) => void;
  onCropTypeCustomChange: (v: string) => void;
  onQuantityChange: (v: string) => void;
  onPriceChange: (v: string) => void;
  onTotalYieldChange: (v: string) => void;
  onRegionChange: (v: string) => void;
  onHarvestDateChange: (v: string) => void;
  onRunNdvi?: () => void;
  onNdviResult: (bps: number) => void;
  onSubmit: () => void;
  onClear?: () => void;
  onImageChange?: (url: string) => void;
}

export default function ListingForm({
  polygonCoords,
  polygonCenter,
  displayBbox,
  parcelName,
  cropType,
  cropTypeCustom,
  quantityKg,
  priceXlm,
  totalYieldKg,
  region,
  harvestDate,
  mintError,
  ndviBpsResult,
  ndviRun,
  mintStep,
  formValid,
  approximateHectares,
  onParcelNameChange,
  onCropTypeChange,
  onCropTypeCustomChange,
  onQuantityChange,
  onPriceChange,
  onTotalYieldChange,
  onRegionChange,
  onHarvestDateChange,
  onSubmit,
  onRunNdvi,
  onClear,
  onNdviResult,
  onImageChange,
}: Props) {
  return (
    <div className="card-farm overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600">
          <MapPinned size={12} className="inline mr-1.5" />
          Create Listing
        </h3>
        <button
          onClick={onClear}
          className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
        >
          <X size={14} />
        </button>
      </div>

      {/* Location summary */}
      <div className="mb-4 rounded-lg bg-farm-50 px-3 py-2.5 text-xs text-farm-700">
        <div className="flex items-center gap-1.5 font-semibold">
          <MapPin size={11} />
          {polygonCoords.length} vertex polygon
        </div>
        <p className="mt-0.5 text-stone-500">
          Center: {polygonCenter?.lat.toFixed(4)}, {polygonCenter?.lng.toFixed(4)}
          {polygonCoords.length >= 3 && (
            <> &middot; ~{approximateHectares.toFixed(1)} ha</>
          )}
        </p>
        <div className="mt-1 grid grid-cols-4 gap-1 text-[10px] text-stone-400 font-mono">
          <span>N:{displayBbox.north.toFixed(5)}</span>
          <span>S:{displayBbox.south.toFixed(5)}</span>
          <span>E:{displayBbox.east.toFixed(5)}</span>
          <span>W:{displayBbox.west.toFixed(5)}</span>
        </div>
      </div>

      {/* Form fields */}
      <div className="space-y-3">
        {/* Parcel Name */}
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase text-stone-500">
            <MapPin size={10} className="inline mr-1" /> Parcel Name
          </label>
          <input
            type="text"
            value={parcelName}
            onChange={(e) => onParcelNameChange(e.target.value)}
            placeholder="e.g. Central Valley Field A"
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none focus:border-farm-400"
          />
        </div>

        {/* Crop Type */}
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase text-stone-500">
            <Sprout size={10} className="inline mr-1" /> Crop Type
          </label>
          <div className="grid grid-cols-5 gap-1 mb-1.5">
            {CROP_TYPES.map((ct) => (
              <button
                key={ct}
                onClick={() => onCropTypeChange(ct)}
                className={`rounded-md px-2 py-1 text-[11px] font-medium capitalize transition ${
                  cropType === ct
                    ? "bg-farm-900 text-white"
                    : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                }`}
              >
                {ct}
              </button>
            ))}
            <button
              onClick={() => onCropTypeChange("other")}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                cropType === "other"
                  ? "bg-farm-900 text-white"
                  : "bg-stone-100 text-stone-500 hover:bg-stone-200"
              }`}
            >
              Other
            </button>
          </div>
          {cropType === "other" && (
            <input
              type="text"
              value={cropTypeCustom}
              onChange={(e) => onCropTypeCustomChange(e.target.value)}
              placeholder="Enter crop type..."
              className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-800 outline-none focus:border-farm-400"
            />
          )}
        </div>

        {/* Quantity + Price row */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase text-stone-500">
              <Scale size={10} className="inline mr-1" /> Quantity (kg)
            </label>
            <input
              type="number"
              value={quantityKg}
              onChange={(e) => onQuantityChange(e.target.value)}
              placeholder="5000"
              min={1}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none focus:border-farm-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase text-stone-500">
              <DollarSign size={10} className="inline mr-1" /> Price (XLM)
            </label>
            <input
              type="number"
              value={priceXlm}
              onChange={(e) => onPriceChange(e.target.value)}
              placeholder="250.00"
              min={0}
              step="0.01"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none focus:border-farm-400"
            />
          </div>
        </div>

        {/* Total Yield + Region */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase text-stone-500">
              <Hash size={10} className="inline mr-1" /> Total Yield (kg)
            </label>
            <input
              type="number"
              value={totalYieldKg}
              onChange={(e) => onTotalYieldChange(e.target.value)}
              placeholder="10000"
              min={1}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none focus:border-farm-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase text-stone-500">
              <User size={10} className="inline mr-1" /> Region
            </label>
            <input
              type="text"
              value={region}
              onChange={(e) => onRegionChange(e.target.value)}
              placeholder="e.g. Nueva Ecija"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none focus:border-farm-400"
            />
          </div>
        </div>

        {/* Harvest Date */}
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase text-stone-500">
            <Crosshair size={10} className="inline mr-1" /> Harvest Date
          </label>
          <input
            type="date"
            value={harvestDate}
            onChange={(e) => onHarvestDateChange(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none focus:border-farm-400"
          />
        </div>

        {/* Satellite NDVI Verification */}
        <div className="rounded-lg border border-farm-200 bg-farm-50/20 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase text-farm-700">
            <Satellite size={11} className="inline mr-1" /> NDVI Satellite Check
          </p>
          <SatelliteVerificationPanel
            nftId={0}
            bbox={displayBbox}
            minNdviBps={3500}
            sampleGridSize={20}
            compact
            onNdviResult={(bps) => {
              onNdviResult(bps);
            }}
          />
        </div>

        {ndviBpsResult !== null && (
          <div className="rounded-lg border border-farm-200 bg-farm-50/30 px-3 py-2 text-xs">
            <span className="font-semibold text-farm-700">NDVI: {(ndviBpsResult / 100).toFixed(1)}%</span>
            <span className="ml-2 text-stone-400">Recorded for mint</span>
          </div>
        )}

        {/* Crop image upload */}
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Crop Photo (optional)</label>
          <CropImageUpload onImageChange={(url) => onImageChange?.(url)} />
        </div>

        {/* Mint error */}
        {mintError && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 border border-red-100">
            {mintError}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={onSubmit}
          disabled={!formValid || mintStep === "minting"}
          className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] ${
            formValid && mintStep !== "minting"
              ? "bg-stone-900 text-white hover:bg-stone-800 shadow-sm"
              : "bg-stone-100 text-stone-400 cursor-not-allowed"
          }`}
        >
          {mintStep === "minting" ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Minting Crop NFT...
            </>
          ) : (
            <>
              <Rocket size={15} /> List Crop &mdash; Pending Attestation
            </>
          )}
        </button>
        <p className="text-center text-[10px] text-stone-400 -mt-1.5">
          After minting, an admin will attest NDVI to make it buyable.
        </p>
      </div>
    </div>
  );
}

function CropImageUpload({ onImageChange }: { onImageChange: (url: string) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setUploading(true);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("bucket", "crop-images");
      form.append("folder", "listings");

      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (data.ok) {
        onImageChange(data.url);
      }
    } catch {
      // silently fail — image is optional
    } finally {
      setUploading(false);
    }
  }

  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-stone-300 bg-stone-50/50 px-4 py-3 transition hover:border-farm-400 hover:bg-farm-50/20">
      {preview ? (
        <img src={preview} alt="preview" className="h-12 w-12 rounded-lg object-cover" />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-stone-100 text-stone-400">
          {uploading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Image size={18} />
          )}
        </div>
      )}
      <div className="flex-1 text-xs">
        <p className="font-medium text-stone-600">{preview ? "Change photo" : "Crop photo"}</p>
        <p className="text-stone-400">PNG, JPG up to 5MB</p>
      </div>
      <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFile} />
    </label>
  );
}