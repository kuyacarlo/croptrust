import { Leaf, MapPin, ChevronRight, CheckCircle } from "lucide-react";

interface Parcel {
  id: number;
  title: string;
  lat: number;
  lng: number;
  temporalExtent: { start: string; end: string };
  region?: string | null;
  ndviBps?: number | null;
  buyable?: boolean;
  noCoords?: boolean;
}

interface Props {
  parcels: Parcel[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export default function ParcelList({ parcels, selectedId, onSelect }: Props) {
  return (
    <div className="card-farm flex-1 overflow-y-auto p-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-600">
        <Leaf size={12} className="inline mr-1.5" />
        Registered Parcels
      </h3>
      {parcels.length === 0 ? (
        <div className="flex flex-col items-center py-8">
          <MapPin size={24} className="mb-2 text-stone-300" />
          <p className="text-xs text-stone-400">No parcels available</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {parcels.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                selectedId === p.id
                  ? "border-farm-400 bg-farm-50 shadow-sm"
                  : "border-stone-100 hover:border-farm-200 hover:bg-farm-50/30"
              }`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  selectedId === p.id
                    ? "bg-farm-200 text-farm-800"
                    : "bg-farm-50 text-farm-600"
                }`}
              >
                <Leaf size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-stone-800">{p.title}</p>
                <p className="text-[11px] text-stone-400">
                  {p.region ?? "Unknown"}
                  {p.ndviBps != null && <> &middot; NDVI {(p.ndviBps / 100).toFixed(0)}%</>}
                </p>
              </div>
              {p.buyable && (
                <span className="shrink-0 badge-buyable">
                  <CheckCircle size={10} /> Ready
                </span>
              )}
              <ChevronRight size={14} className="shrink-0 text-stone-300" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}