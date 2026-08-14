"use client";

import { useState, useCallback, useMemo } from "react";
import {
  X,
  Square,
  Edit,
  Target,
  Trash2,
} from "lucide-react";
import ParcelMap from "@/components/ParcelMap";
import ListingForm from "@/components/ListingForm";
import MintSuccess from "@/components/MintSuccess";
import BookmarkList from "@/components/BookmarkList";
import VerificationSection from "@/components/VerificationSection";
import ParcelList from "@/components/ParcelList";
import { useWallet } from "@/components/stellar/wallet-context";
import { signPreparedXdr, submitSignedXdr } from "@/lib/stellar/croptrust";
import { useToast } from "@/components/Toast";

type Parcel = {
  id: number;
  title: string;
  lat: number;
  lng: number;
  temporalExtent: { start: string; end: string };
  region?: string | null;
  ndviBps?: number | null;
  buyable?: boolean;
  noCoords?: boolean;
};

function round(v: number) {
  return Number(v.toFixed(6));
}

function centerOf(coords: { lat: number; lng: number }[]) {
  if (coords.length === 0) return { lat: 0, lng: 0 };
  const lat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
  const lng = coords.reduce((s, c) => s + c.lng, 0) / coords.length;
  return { lat: round(lat), lng: round(lng) };
}

function bboxFromCoords(coords: { lat: number; lng: number }[]) {
  if (coords.length < 3) return { west: 0, south: 0, east: 0, north: 0 };
  const lats = coords.map((c) => c.lat);
  const lngs = coords.map((c) => c.lng);
  return {
    north: round(Math.max(...lats)),
    south: round(Math.min(...lats)),
    east: round(Math.max(...lngs)),
    west: round(Math.min(...lngs)),
  };
}

function simpleHash(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return "bbox-" + Math.abs(hash).toString(16).slice(0, 10);
}

function approximateHectares(coords: { lat: number; lng: number }[]) {
  if (coords.length < 3) return 0;
  const R = 6371 * 1000;
  let area = 0;
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    const x1 = (coords[i].lng * Math.PI / 180) * R * Math.cos(coords[i].lat * Math.PI / 180);
    const y1 = (coords[i].lat * Math.PI / 180) * R;
    const x2 = (coords[j].lng * Math.PI / 180) * R * Math.cos(coords[j].lat * Math.PI / 180);
    const y2 = (coords[j].lat * Math.PI / 180) * R;
    area += x1 * y2 - x2 * y1;
  }
  return Math.round(Math.abs(area) / 2 / 10000 * 100) / 100;
}

type BookmarkEntry = {
  id: string;
  label: string;
  coords: { lat: number; lng: number }[];
  center: { lat: number; lng: number };
  bbox: { west: number; south: number; east: number; north: number };
  createdAt: number;
};

type MintStep = "draw" | "form" | "minting" | "done";

export default function ExploreWorkspace({ parcels: serverParcels }: { parcels: Parcel[] }) {
  const { address, connect } = useWallet();
  const [selected, setSelected] = useState<Parcel | null>(null);
  const [bbox, setBbox] = useState({ west: 0, south: 0, east: 0, north: 0 });
  const [drawMode, setDrawMode] = useState<"rect" | "polygon" | "none">("rect");
  const [polygonCoords, setPolygonCoords] = useState<{ lat: number; lng: number }[]>([]);
  const [polygonCenter, setPolygonCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);
  const [mintedParcels, setMintedParcels] = useState<Parcel[]>([]);

  const parcels = useMemo(() => {
    const all = [...mintedParcels, ...serverParcels];
    const seen = new Set<number>();
    return all.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [mintedParcels, serverParcels]);

  // Listing form state
  const [mintStep, setMintStep] = useState<MintStep>("draw");
  const { toast, dismiss } = useToast();
  const [parcelName, setParcelName] = useState("");
  const [cropType, setCropType] = useState("rice");
  const [cropTypeCustom, setCropTypeCustom] = useState("");
  const [quantityKg, setQuantityKg] = useState("");
  const [priceXlm, setPriceXlm] = useState("");
  const [totalYieldKg, setTotalYieldKg] = useState("");
  const [region, setRegion] = useState("");
  const [harvestDate, setHarvestDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintTxHash, setMintTxHash] = useState<string | null>(null);
  const [mintedNftId, setMintedNftId] = useState<number | null>(null);

  // NDVI state
  const [ndviRun, setNdviRun] = useState(false);
  const [ndviBpsResult, setNdviBpsResult] = useState<number | null>(null);

  const effectiveCropType = cropType === "other" ? cropTypeCustom : cropType;

  const resetListingForm = useCallback(() => {
    setParcelName("");
    setCropType("rice");
    setCropTypeCustom("");
    setQuantityKg("");
    setPriceXlm("");
    setTotalYieldKg("");
    setRegion("");
    setHarvestDate(() => {
      const d = new Date();
      d.setMonth(d.getMonth() + 3);
      return d.toISOString().slice(0, 10);
    });
    setMintError(null);
    setMintTxHash(null);
    setMintedNftId(null);
    setNdviRun(false);
    setNdviBpsResult(null);
  }, []);

  const clearPolygon = useCallback(() => {
    setPolygonCoords([]);
    setPolygonCenter(null);
    setBbox({ west: 0, south: 0, east: 0, north: 0 });
    setDrawMode("rect");
    setDraftLabel("");
    setMintStep("draw");
    resetListingForm();
  }, [resetListingForm]);

  const handleSelect = (id: number) => {
    const match = parcels.find((p) => p.id === id);
    if (!match) return;
    setSelected(match);
    if (match.noCoords) {
      setBbox({ west: 0, south: 0, east: 0, north: 0 });
    } else {
      setBbox({
        west: round(match.lng - 0.05),
        south: round(match.lat - 0.05),
        east: round(match.lng + 0.05),
        north: round(match.lat + 0.05),
      });
    }
    setDrawMode("none");
    setPolygonCoords([]);
    setPolygonCenter(null);
    setDraftLabel("");
    setMintStep("draw");
    resetListingForm();
  };

  const handleClearSelection = () => {
    setSelected(null);
    setDrawMode("rect");
    setPolygonCoords([]);
    setPolygonCenter(null);
    setBbox({ west: 0, south: 0, east: 0, north: 0 });
    setDraftLabel("");
    setMintStep("draw");
    resetListingForm();
  };

  const handleToggleDraw = () => {
    if (drawMode === "polygon") {
      setDrawMode("rect");
      return;
    }
    setDrawMode("polygon");
    setPolygonCoords([]);
    setPolygonCenter(null);
    setSelected(null);
    setMintStep("draw");
    resetListingForm();
  };

  const handlePolygonComplete = (coords: { lat: number; lng: number }[]) => {
    setPolygonCoords(coords);
    if (coords.length < 3) return;
    setDrawMode("none");
    const center = centerOf(coords);
    setPolygonCenter(center);
    setBbox(bboxFromCoords(coords));
    if (coords.length >= 3) {
      setMintStep("form");
    }
  };

  const handleBookmark = () => {
    if (polygonCoords.length < 3 || !polygonCenter) return;
    const label = draftLabel.trim() || `Area #${bookmarks.length + 1}`;
    setBookmarks((prev) => [
      {
        id: String(Date.now()),
        label,
        coords: polygonCoords,
        center: polygonCenter,
        bbox,
        createdAt: Date.now(),
      },
      ...prev,
    ]);
    clearPolygon();
    setDraftLabel("");
  };

  const handleDeleteBookmark = (id: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  };

  const handleRestoreBookmark = (entry: BookmarkEntry) => {
    setSelected(null);
    setPolygonCoords(entry.coords);
    setPolygonCenter(entry.center);
    setBbox(entry.bbox);
    setDrawMode("none");
    setMintStep("form");
    resetListingForm();
  };

  const handleStartListing = () => {
    resetListingForm();
    setMintStep("form");
  };

  const handleMintSubmit = async () => {
    setMintError(null);
    setMintStep("minting");
    let loadingToastId: number | null = toast("Preparing mint transaction...", "loading");

    try {
      const farmer = address ?? (await connect());
      if (!farmer) throw new Error("Connect your wallet to list a crop.");

      const qty = parseInt(quantityKg, 10);
      if (!qty || qty <= 0) throw new Error("Enter a valid quantity.");

      const yieldKg = parseInt(totalYieldKg, 10);
      if (!yieldKg || yieldKg <= 0) throw new Error("Enter a valid total yield.");

      const price = parseFloat(priceXlm);
      if (!price || price <= 0) throw new Error("Enter a valid price.");

      const name = parcelName.trim() || draftLabel.trim() || `Parcel at ${polygonCenter?.lat.toFixed(4)}N`;
      const reg = region.trim() || "Unknown";
      const hectares = approximateHectares(polygonCoords);
      const bboxHash = simpleHash(`${bbox.west}${bbox.south}${bbox.east}${bbox.north}`);
      const minNdvi = 3500;

      const prepareRes = await fetch("/api/stellar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "prepare_mint_crop_nft",
          farmer,
          cropType: effectiveCropType,
          quantityKg: qty,
          priceXlm: price.toFixed(2),
          harvestDate,
          parcelName: name,
          parcelBboxHash: bboxHash,
          parcelAreaHectares: hectares,
          region: reg,
          minNdviBps: minNdvi,
          observationWindowDays: 30,
        }),
      });

      if (!prepareRes.ok) {
        const err = await prepareRes.json().catch(() => ({}));
        throw new Error((err as Record<string, unknown>).error as string || "Failed to prepare mint transaction");
      }

      const prepared = await prepareRes.json() as { xdr: string; hash: string; contractId: string };
      const { signedTxXdr, hash } = await signPreparedXdr(farmer, prepared.xdr);
      if (loadingToastId !== null) { dismiss(loadingToastId); loadingToastId = null; }
      loadingToastId = toast("Signing transaction...", "loading");
      const submission = await submitSignedXdr(signedTxXdr);
      const txHash = submission.hash ?? hash;
      if (loadingToastId !== null) dismiss(loadingToastId);
      toast("Crop listed on-chain!", "success");
      setMintTxHash(txHash);

      try {
        const { getLiveListings } = await import("@/lib/stellar/live-data");
        const all = await getLiveListings();
        const mine = all.filter((l) => l.farmer === farmer);
        const maxId = mine.length > 0 ? Math.max(...mine.map((l) => l.nftId)) : 0;
        const newNftId = maxId + 1;
        setMintedNftId(newNftId);

        setMintedParcels((prev) => [...prev, {
          id: newNftId,
          title: name,
          lat: polygonCenter?.lat ?? bbox.north,
          lng: polygonCenter?.lng ?? bbox.east,
          temporalExtent: { start: "2026-04-19T00:00:00Z", end: "2026-05-19T23:59:59Z" },
          region: reg,
          ndviBps: ndviBpsResult,
          buyable: false,
        }]);

        await fetch("/api/listings", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            nftId: newNftId,
            cropType: effectiveCropType,
            quantityKg: qty,
            priceXlm: parseFloat(priceXlm),
            farmerId: farmer,
            parcelName: name,
            region: reg,
            buyable: false,
            ndviBps: ndviBpsResult ?? null,
            minNdviBps: minNdvi,
            areaHa: hectares,
            totalYieldKg: yieldKg,
            status: "listed",
          }),
        });
      } catch (dbErr) {
        console.warn("Failed to save listing to backend:", dbErr);
      }

      clearPolygon();
      setMintStep("done");
    } catch (e) {
      if (loadingToastId !== null) dismiss(loadingToastId);
      setMintError(e instanceof Error ? e.message : "Listing failed");
      setMintStep("form");
    }
  };

  const hasPolygon = polygonCoords.length >= 3;
  const hasActiveSelection = selected !== null || hasPolygon;
  const displayBbox = hasPolygon
    ? bbox
    : selected && !selected.noCoords
      ? bbox
      : { west: 0, south: 0, east: 0, north: 0 };

  const activeNftId = selected?.id ?? (hasPolygon ? 0 : null);

  const formValid = parcelName.trim().length > 0
    && quantityKg.trim().length > 0
    && parseInt(quantityKg, 10) > 0
    && priceXlm.trim().length > 0
    && parseFloat(priceXlm) > 0
    && totalYieldKg.trim().length > 0
    && parseInt(totalYieldKg, 10) > 0;

  const selectedRegion = selected?.region ?? polygonCenter
    ? "Drawn Area"
    : null;

  return (
    <div className="grid gap-4 lg:h-[calc(100vh-8rem)] lg:grid-cols-[1fr_380px]">
      {/* Left: Map + draw toggle */}
      <div className="relative min-h-[55vh] overflow-hidden rounded-2xl border border-farm-200/60 bg-stone-100 lg:min-h-0">
        <ParcelMap
          markers={parcels.filter((p) => !p.noCoords)}
          activeMarkerId={selected?.id}
          onSelectMarker={handleSelect}
          onBoundsChange={(b) =>
            setBbox({ west: round(b.west), south: round(b.south), east: round(b.east), north: round(b.north) })
          }
          drawMode={drawMode}
          onPolygonComplete={handlePolygonComplete}
          polygonCoords={hasPolygon ? polygonCoords : []}
          polygonCenter={polygonCenter}
        />
        {/* Map overlay controls */}
        <div className="absolute right-3 top-3 z-10 flex flex-col gap-1">
          <button
            onClick={handleToggleDraw}
            disabled={drawMode === "none" && !!selected}
            className={`rounded-xl px-3 py-2 text-xs font-semibold shadow backdrop-blur transition ${
              drawMode === "polygon"
                ? "bg-emerald-800 text-emerald-100"
                : "bg-white/90 text-stone-700 hover:bg-stone-100"
            }`}
            title={drawMode === "polygon" ? "Back to rectangle" : "Draw custom area"}
          >
            {drawMode === "polygon" ? (
              <><Square size={14} className="inline mr-1" /> Exit Draw</>
            ) : (
              <><Edit size={14} className="inline mr-1" /> Draw Area</>
            )}
          </button>
          {hasPolygon && (
            <button
              onClick={clearPolygon}
              className="rounded-xl bg-white/90 px-3 py-2 text-xs font-semibold text-stone-700 shadow backdrop-blur hover:bg-red-50 hover:text-red-600 transition"
            >
              <Trash2 size={14} className="inline mr-1" /> Clear
            </button>
          )}
          {selected && (
            <button
              onClick={handleClearSelection}
              className="rounded-xl bg-white/90 px-3 py-2 text-xs font-semibold text-stone-700 shadow backdrop-blur hover:bg-stone-100 transition"
            >
              <X size={14} className="inline mr-1" /> Deselect
            </button>
          )}
        </div>
        {/* Drawing instruction */}
        {drawMode === "polygon" && (
          <div className="absolute bottom-3 left-3 rounded-lg bg-emerald-900/85 px-3 py-2 text-xs font-medium text-emerald-100 shadow-lg">
            Click to place polygon vertices. Double-click or click first point to close.
          </div>
        )}
      </div>

      {/* Right panel */}
      <div className="flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-8rem)]">
        {/* === PARCELS LIST (always visible) === */}
        <ParcelList
          parcels={parcels}
          selectedId={selected?.id ?? null}
          onSelect={handleSelect}
        />

        {/* === DONE === */}
        {mintStep === "done" && (
          <MintSuccess
            mintTxHash={mintTxHash}
            mintedNftId={mintedNftId}
            onListAnother={() => { resetListingForm(); setMintStep("draw"); }}
          />
        )}

        {/* === CREATING LISTING FORM === */}
        {hasPolygon && mintStep === "form" && (
          <ListingForm
            polygonCoords={polygonCoords}
            polygonCenter={polygonCenter}
            displayBbox={displayBbox}
            parcelName={parcelName}
            cropType={cropType}
            cropTypeCustom={cropTypeCustom}
            quantityKg={quantityKg}
            priceXlm={priceXlm}
            totalYieldKg={totalYieldKg}
            region={region}
            harvestDate={harvestDate}
            mintError={mintError}
            ndviBpsResult={ndviBpsResult}
            ndviRun={ndviRun}
            mintStep={mintStep}
            formValid={formValid}
            approximateHectares={approximateHectares(polygonCoords)}
            onParcelNameChange={setParcelName}
            onCropTypeChange={setCropType}
            onCropTypeCustomChange={setCropTypeCustom}
            onQuantityChange={setQuantityKg}
            onPriceChange={setPriceXlm}
            onTotalYieldChange={setTotalYieldKg}
            onRegionChange={setRegion}
            onHarvestDateChange={setHarvestDate}
            onSubmit={handleMintSubmit}
            onClear={clearPolygon}
            onNdviResult={(bps) => { setNdviBpsResult(bps); setNdviRun(true); }}
          />
        )}

{/* === NO SELECTION === */}
        {!hasActiveSelection && mintStep === "draw" && (
          <div className="card-farm flex flex-col items-center justify-center p-5 text-center">
            <Target size={24} className="mb-2 text-stone-300" />
            <p className="text-xs font-medium text-stone-400">Select a parcel or draw a polygon</p>
            <p className="mt-0.5 text-[11px] text-stone-300">
              Draw an area on the map to create a new listing with satellite verification
            </p>
          </div>
        )}

        {/* === SATELLITE VERIFICATION PANEL (existing parcels) === */}
        {activeNftId !== null && !hasPolygon && !selected?.noCoords && (
          <VerificationSection
            nftId={selected?.id ?? 0}
            bbox={displayBbox}
            temporalExtent={selected?.temporalExtent}
          />
        )}

        {/* === BOOKMARKS === */}
        {bookmarks.length > 0 && (
          <BookmarkList
            bookmarks={bookmarks}
            onRestore={handleRestoreBookmark}
            onDelete={handleDeleteBookmark}
          />
        )}

      </div>
    </div>
  );
}
