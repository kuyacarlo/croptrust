"use client";

import { X } from "lucide-react";

export type FilterState = {
  cropType: string;
  region: string;
  status: string;
  ndviMin: number | null;
  ndviMax: number | null;
};

interface FilterProps {
  activeFilters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  variant?: "full" | "compact";
}

const CROP_TYPES = ["", "rice", "corn", "wheat", "soy", "coconut", "sugarcane", "coffee"];
const REGIONS = [
  "",
  "bicol",
  "calabarzon",
  "central-luzon",
  "ilocos",
  "cagayan-valley",
  "western-visayas",
  "davao",
];
const STATUSES = [
  { value: "", label: "All" },
  { value: "buyable", label: "Buyable" },
  { value: "pending", label: "Pending Verification" },
  { value: "verified", label: "Verified" },
];

export default function Filter({ activeFilters, onFilterChange, variant = "full" }: FilterProps) {
  const hasActive = Object.entries(activeFilters).some(([k, v]) => {
    if (k === "ndviMin" || k === "ndviMax") return v !== null;
    return v !== "";
  });

  function update<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    onFilterChange({ ...activeFilters, [key]: value });
  }

  function clearAll() {
    onFilterChange({
      cropType: "",
      region: "",
      status: "",
      ndviMin: null,
      ndviMax: null,
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Filter by crop type"
        value={activeFilters.cropType}
        onChange={(e) => update("cropType", e.target.value)}
        className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600 outline-none transition focus:border-emerald-400"
      >
        <option value="">All Crops</option>
        {CROP_TYPES.filter(Boolean).map((c) => (
          <option key={c} value={c}>
            {c.charAt(0).toUpperCase() + c.slice(1)}
          </option>
        ))}
      </select>

      {variant === "full" && (
        <>
          <select
            aria-label="Filter by region"
            value={activeFilters.region}
            onChange={(e) => update("region", e.target.value)}
            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600 outline-none transition focus:border-emerald-400"
          >
            <option value="">All Regions</option>
            {REGIONS.filter(Boolean).map((r) => (
              <option key={r} value={r}>
                {r
                  .split("-")
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(" ")}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by status"
            value={activeFilters.status}
            onChange={(e) => update("status", e.target.value)}
            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600 outline-none transition focus:border-emerald-400"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </>
      )}

      {hasActive && (
        <button
          onClick={clearAll}
          className="inline-flex items-center gap-1 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-100"
        >
          <X size={14} />
          Clear
        </button>
      )}
    </div>
  );
}