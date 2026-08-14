"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/components/stellar/wallet-context";
import NavigationBar from "@/components/NavigationBar";
import Link from "next/link";
import {
  MapPin, Plus, Leaf, DollarSign, Scale, CheckCircle, XCircle, Clock, ChevronRight, Sprout, List, TrendingUp,
} from "lucide-react";
import type { LiveListing } from "@/lib/stellar/live-data";

function NvdiBar({ value }: { value: number }) {
  const pct = Math.min(value / 100, 100);
  const color = pct > 70 ? "#16a34a" : pct > 40 ? "#f59e0b" : "#dc2626";
  return (
    <div className="h-1 w-full rounded-full bg-stone-100">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

function ListingCard({ listing }: { listing: LiveListing }) {
  const label = listing.parcelName ?? listing.cropType ?? `Parcel #${listing.nftId}`;
  const ndviBps = listing.ndviBps ?? 0;
  const ndviPct = ndviBps / 100;

  return (
    <div className="relative">
      <Link href={`/order?nftId=${listing.nftId}`} className="group card-farm card-hover flex flex-col p-5">
        <NvdiBar value={ndviPct} />
        <div className="mt-3 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-stone-800 line-clamp-1">{label}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-stone-400">
              <MapPin size={10} /> {listing.region ?? "Unknown"}
              {ndviBps > 0 && <> &middot; NDVI {ndviPct.toFixed(0)}%</>}
            </p>
          </div>
          <span className={listing.buyable ? "badge-buyable shrink-0" : "badge-pending shrink-0"}>
            {listing.buyable ? <><CheckCircle size={10} /> Ready</> : <><XCircle size={10} /> Pending</>}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          {listing.cropType && (
            <div className="flex items-center gap-1.5 rounded-lg bg-stone-50 px-2.5 py-1.5 text-stone-600">
              <Leaf size={12} className="text-farm-600 shrink-0" />
              <span className="capitalize truncate">{listing.cropType}</span>
            </div>
          )}
          {listing.priceXlm && (
            <div className="flex items-center gap-1.5 rounded-lg bg-stone-50 px-2.5 py-1.5 text-stone-600">
              <DollarSign size={12} className="text-farm-600 shrink-0" />
              <span className="font-semibold tabular-nums">{listing.priceXlm} XLM</span>
            </div>
          )}
          {listing.quantityKg !== null && (
            <div className="flex items-center gap-1.5 rounded-lg bg-stone-50 px-2.5 py-1.5 text-stone-600">
              <Scale size={12} className="text-farm-600 shrink-0" />
              <span className="tabular-nums">{listing.quantityKg.toLocaleString()} kg</span>
            </div>
          )}
          {listing.totalYieldKg !== null && listing.totalYieldKg > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg bg-stone-50 px-2.5 py-1.5 text-stone-600">
              <TrendingUp size={12} className="text-farm-600 shrink-0" />
              <span className="tabular-nums">{listing.totalYieldKg.toLocaleString()} kg yield</span>
            </div>
          )}
        </div>
        <div className="mt-2 flex items-center justify-end text-[11px] font-medium text-farm-700 opacity-0 transition group-hover:opacity-100">
          View Details <ChevronRight size={12} className="ml-0.5" />
        </div>
      </Link>
      <a
        href={`https://stellar.expert/explorer/testnet/contract/${process.env.NEXT_PUBLIC_AGRI_CON_CONTRACT_ID}`}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute right-3 top-3 z-10 text-[10px] text-farm-700 hover:underline"
      >
        NFT #{listing.nftId} ↗
      </a>
    </div>
  );
}

export default function MyListingsPage() {
  const { address, connect } = useWallet();
  const [listings, setListings] = useState<LiveListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    const ctrl = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      setListings([]);

      const mapBackendListings = (data: unknown): LiveListing[] => {
        const arr = data as Record<string, unknown>[];
        if (!Array.isArray(arr) || arr.length === 0) return [];
        return arr.map((l: Record<string, unknown>) => ({
          nftId: (l.nftId ?? l.nft_id) as number,
          cropType: (l.cropType ?? l.crop_type ?? null) as string | null,
          quantityKg: (l.quantityKg ?? l.quantity_kg ?? null) as number | null,
          priceXlm: l.priceXlm != null ? String(l.priceXlm) : null,
          farmer: (l.farmerId ?? l.farmer_id ?? address) as string,
          harvestDate: null,
          cropStatus: null,
          buyable: Boolean(l.buyable),
          observedAt: null,
          ndviBps: (l.ndviBps ?? l.ndvi_bps ?? null) as number | null,
          minNdviBps: (l.minNdviBps ?? l.min_ndvi_bps ?? null) as number | null,
          source: null,
          parcelName: (l.parcelName ?? l.parcel_name ?? null) as string | null,
          parcelBboxHash: null,
          parcelAreaHectares: (l.areaHa ?? l.area_ha ?? null) as number | null,
          region: (l.region ?? null) as string | null,
          observationWindowDays: null,
          totalYieldKg: (l.totalYieldKg ?? l.total_yield_kg ?? null) as number | null,
        }));
      };

      const backendListings: LiveListing[] = [];
      try {
        const res = await fetch(
          `/api/listings?farmerId=${encodeURIComponent(address!)}`,
          { signal: ctrl.signal },
        );
        const data = await res.json();
        if (data.ok && Array.isArray(data.listings)) {
          const mapped = mapBackendListings(data.listings);
          backendListings.push(...mapped);
        }
      } catch {}

      const onChainListings: LiveListing[] = [];
      try {
        const { getLiveListings } = await import("@/lib/stellar/live-data");
        const all = await getLiveListings();
        const filtered = all.filter((l) => l.farmer === address);
        // Deduplicate: prefer backend data, add on-chain rows for IDs not already present
        const existingIds = new Set(backendListings.map((l) => l.nftId));
        for (const l of filtered) {
          if (!existingIds.has(l.nftId)) {
            onChainListings.push(l);
          }
        }
      } catch {}

      if (!ctrl.signal.aborted) {
        setListings([...backendListings, ...onChainListings]);
        setLoading(false);
      }
    }

    load();
    return () => ctrl.abort();
  }, [address]);

  const buyableCount = listings.filter((l) => l.buyable).length;
  const pendingCount = listings.filter((l) => !l.buyable).length;

  if (!address) {
    return (
      <div className="flex min-h-screen flex-col bg-stone-50">
        <NavigationBar />
        <main className="flex flex-1 items-center justify-center px-4">
          <div className="card-farm flex flex-col items-center py-16 px-6 text-center max-w-sm">
            <List size={40} className="mb-3 text-stone-200" />
            <p className="text-sm font-semibold text-stone-600">Connect your wallet to view your listings</p>
            <p className="mt-1 text-xs text-stone-400">Use Freighter or XBull on Stellar Testnet</p>
            <button onClick={connect} className="btn-primary mt-5 w-full justify-center">
              Connect Wallet
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <NavigationBar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-stone-900">My Listings</h1>
            <p className="mt-1 text-sm text-stone-500">Manage your crop NFTs and track their status</p>
          </div>
          <Link href="/explore" className="btn-primary"><Plus size={18} /> List New Crop</Link>
        </div>

        {/* Summary pills */}
        {listings.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-1.5 text-xs font-medium text-stone-600">
              <Leaf size={12} className="text-farm-600" /> {listings.length} Total
            </div>
            <div className="flex items-center gap-2 rounded-full border border-farm-200 bg-farm-50 px-4 py-1.5 text-xs font-medium text-farm-700">
              <CheckCircle size={12} /> {buyableCount} Buyable
            </div>
            <div className="flex items-center gap-2 rounded-full border border-harvest-200 bg-harvest-50 px-4 py-1.5 text-xs font-medium text-harvest-700">
              <Clock size={12} /> {pendingCount} Pending
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card-farm p-5 space-y-3">
                <div className="skeleton h-1 w-full" />
                <div className="flex gap-3">
                  <div className="skeleton h-8 w-8 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 w-32" />
                    <div className="skeleton h-3 w-20" />
                  </div>
                  <div className="skeleton h-5 w-14 rounded-full" />
                </div>
                <div className="flex gap-2">
                  <div className="skeleton h-6 w-20 rounded-lg" />
                  <div className="skeleton h-6 w-16 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="card-farm flex flex-col items-center py-16">
            <XCircle size={32} className="mb-3 text-red-300" />
            <p className="text-sm font-medium text-red-500">Failed to load listings</p>
            <p className="mt-1 text-xs text-stone-400">{error}</p>
          </div>
        ) : listings.length === 0 ? (
          <div className="card-farm flex flex-col items-center py-20">
            <Sprout size={40} className="mb-3 text-stone-200" />
            <p className="text-sm font-semibold text-stone-400">No listings yet</p>
            <p className="mt-1 text-xs text-stone-300">List your first crop parcel to start selling</p>
            <Link href="/explore" className="btn-primary mt-5"><Plus size={16} /> List Your First Crop</Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <ListingCard key={listing.nftId} listing={listing} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
