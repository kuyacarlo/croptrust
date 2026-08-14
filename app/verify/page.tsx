"use client";

import { useEffect, useState } from "react";
import NavigationBar from "@/components/NavigationBar";
import { useWallet } from "@/components/stellar/wallet-context";
import SatelliteVerificationPanel from "@/components/SatelliteVerificationPanel";
import { ShieldCheck, Loader2, Satellite, CheckCircle, XCircle } from "lucide-react";

type Listing = {
  nftId: number;
  parcelName: string | null;
  cropType: string | null;
  region: string | null;
  buyable: boolean;
  farmer: string | null;
};

export default function VerifyPage() {
  const { address } = useWallet();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Listing | null>(null);

  useEffect(() => {
    fetch("/api/stellar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_all_listings" }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setListings(d.listings);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const pending = listings.filter((l) => !l.buyable);

  if (!address) return null;

  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <NavigationBar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-farm-900 text-white">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-stone-900">
              Oracle Verification
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              Verify crop parcels and record NDVI attestations on-chain
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          {/* Listing list */}
          <div className="card-farm p-4">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-500">
              <Satellite size={13} className="inline mr-1.5" />
              Pending Verification ({pending.length})
            </h2>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin text-stone-300" />
              </div>
            ) : pending.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-stone-400">
                <CheckCircle size={28} className="mb-2 text-stone-200" />
                <p className="text-sm font-medium">All caught up</p>
                <p className="text-xs mt-1">No crops pending verification</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pending.map((l) => (
                  <button
                    key={l.nftId}
                    onClick={() => setSelected(l)}
                    className={`w-full text-left rounded-xl border px-4 py-3 transition ${
                      selected?.nftId === l.nftId
                        ? "border-farm-400 bg-farm-50"
                        : "border-stone-200 bg-white hover:border-stone-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-stone-800">
                        {l.parcelName ?? `NFT #${l.nftId}`}
                      </p>
                      <span className="badge-pending text-[10px]">Pending</span>
                    </div>
                    <p className="mt-0.5 text-xs text-stone-500">
                      #{l.nftId} · {l.cropType ?? "?"} · {l.region ?? "?"}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Verification panel */}
          <div>
            {selected ? (
              <SatelliteVerificationPanel
                nftId={selected.nftId}
                bbox={{ west: 0, south: 0, east: 0, north: 0 }}
                key={selected.nftId}
              />
            ) : (
              <div className="card-farm flex flex-col items-center justify-center p-8 text-stone-400">
                <Satellite size={32} className="mb-3 text-stone-200" />
                <p className="text-sm font-medium">Select a crop to verify</p>
                <p className="text-xs mt-1 text-center">
                  Choose a pending listing from the list to run NDVI check and record attestation
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
