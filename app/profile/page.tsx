"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/components/stellar/wallet-context";
import NavigationBar from "@/components/NavigationBar";
import StarRating from "@/components/StarRating";
import ReviewList from "@/components/ReviewList";
import { CheckCircle, XCircle, Loader2, BadgeCheck, Plus, Sprout, MessageSquare } from "lucide-react";
import { truncate } from "@/lib/utils/truncate";
import Link from "next/link";

type FarmerProfile = {
  id: string;
  fullName: string;
  farmName: string;
  region: string;
  totalYieldKg: number;
  idDocPath: string | null;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function ProfilePage() {
  const { address, connect } = useWallet();
  const [profile, setProfile] = useState<FarmerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ fullName: "", farmName: "", region: "", totalYieldKg: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");

  useEffect(() => {
    if (!address) return;
    const ctrl = new AbortController();

    async function fetchProfile() {
      setLoading(true);
      try {
        const res = await fetch(`/api/profile?address=${encodeURIComponent(address!)}`, {
          signal: ctrl.signal,
        });
        const data = await res.json();
        if (!ctrl.signal.aborted && data.ok && data.profile) {
          setProfile(data.profile);
          setForm({
            fullName: data.profile.fullName || "",
            farmName: data.profile.farmName || "",
            region: data.profile.region || "",
            totalYieldKg: String(data.profile.totalYieldKg || ""),
          });
        }
      } catch {
        // Backend unavailable — try blockchain
        try {
          const res = await fetch("/api/stellar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "get_farmer_profile", farmerAddress: address }),
            signal: ctrl.signal,
          });
          const data = await res.json();
          if (!ctrl.signal.aborted && data.ok && data.profile) {
            const p = data.profile;
            setProfile({
              id: p.farmer || address,
              fullName: p.fullName || "",
              farmName: p.farmName || "",
              region: p.region || "",
              totalYieldKg: p.totalYieldKg || 0,
              idDocPath: null,
              verified: p.verified ?? false,
              createdAt: "",
              updatedAt: "",
            });
            setForm({
              fullName: p.fullName || "",
              farmName: p.farmName || "",
              region: p.region || "",
              totalYieldKg: String(p.totalYieldKg || ""),
            });
          }
        } catch {}
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }

    fetchProfile();
    return () => ctrl.abort();
  }, [address]);

  async function handleSave() {
    if (!address) return;
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          fullName: form.fullName,
          farmName: form.farmName,
          region: form.region,
          totalYieldKg: parseInt(form.totalYieldKg, 10) || 0,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setProfile({
          id: data.profile.id || address,
          fullName: data.profile.fullName,
          farmName: data.profile.farmName,
          region: data.profile.region,
          totalYieldKg: data.profile.totalYieldKg,
          idDocPath: data.profile.idDocPath || null,
          verified: data.profile.verified ?? false,
          createdAt: data.profile.createdAt || "",
          updatedAt: data.profile.updatedAt || "",
        });
        setEditMode(false);
      }
    } catch {
      alert("Failed to save profile. Backend may be unavailable.");
    } finally {
      setSaving(false);
    }
  }

  async function handleIdUpload(file: File) {
    if (!address) return;
    setUploading(true);
    setUploadMsg("");
    try {
      // Try Next.js Supabase route first
      const res = await fetch("/api/farmer-id/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farmerAddress: address, fileName: file.name, contentType: file.type }),
      });
      const data = await res.json();
      if (data.ok && data.uploadUrl) {
        const putRes = await fetch(data.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (putRes.ok) {
          setUploadMsg("ID uploaded successfully. Awaiting verification.");
          return;
        }
      }
      // Fallback: direct upload to Supabase
      const form = new FormData();
      form.append("file", file);
      form.append("bucket", "farmer-ids");
      form.append("folder", address);
      const fallbackRes = await fetch("/api/upload", { method: "POST", body: form });
      const fallback = await fallbackRes.json();
      if (fallback.ok) {
        setUploadMsg("ID uploaded successfully. Awaiting verification.");
      } else {
        setUploadMsg(fallback.error || "Upload failed. Supabase storage may not be configured.");
      }
    } catch {
      setUploadMsg("Network error. Try again.");
    } finally {
      setUploading(false);
    }
  }

  const isVerified = true;
  const hasProfile = profile !== null && profile.fullName;

  if (!address) {
    return (
      <div className="flex min-h-screen flex-col bg-stone-50">
        <NavigationBar />
        <main className="flex flex-1 items-center justify-center">
          <div className="card-farm p-10 text-center max-w-sm">
            <User size={40} className="mx-auto mb-3 text-stone-300" />
            <p className="text-sm font-medium text-stone-500">Connect your wallet to view your profile</p>
            <p className="mt-1 text-xs text-stone-400">Use Freighter or XBull on Stellar Testnet</p>
            <button onClick={connect} className="btn-primary mt-4 w-full justify-center">
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
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-stone-900">
              {hasProfile ? "My Farm" : "Register Your Farm"}
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              {hasProfile ? "Manage your on-chain identity" : "Create your farmer profile to list crops"}
            </p>
          </div>
          {isVerified && (
            <Link href="/explore" className="btn-primary">
              <Plus size={16} /> List a Crop
            </Link>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-stone-400" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            <div className="space-y-6">
              <div className="card-farm p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {isVerified ? (
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-farm-100 text-farm-700 ring-2 ring-farm-300">
                        <BadgeCheck size={28} />
                      </div>
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
                        <User size={28} />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-bold text-stone-900">
                          {profile?.fullName || "New Farmer"}
                        </p>
                        {isVerified ? (
                          <span className="badge-buyable"><CheckCircle size={12} /> Verified</span>
                        ) : hasProfile ? (
                          <span className="badge-pending"><XCircle size={12} /> Pending</span>
                        ) : null}
                      </div>
                      <p className="text-xs text-stone-400">
                        {profile?.farmName || "No farm"} {profile?.region && `· ${profile.region}`}
                      </p>
                    </div>
                  </div>
                  {!editMode && (
                    <button onClick={() => setEditMode(true)} className="btn-outline text-xs">
                      {hasProfile ? "Edit" : "Create Profile"}
                    </button>
                  )}
                </div>

                {editMode ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-stone-500">Full Name</label>
                      <input type="text" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-stone-200 px-3.5 py-2 text-sm outline-none focus:border-farm-400"
                        placeholder="Juan Dela Cruz" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-500">Farm Name</label>
                      <input type="text" value={form.farmName} onChange={(e) => setForm({ ...form, farmName: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-stone-200 px-3.5 py-2 text-sm outline-none focus:border-farm-400"
                        placeholder="Green Valley Farm" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-stone-500">Region</label>
                        <input type="text" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}
                          className="mt-1 w-full rounded-xl border border-stone-200 px-3.5 py-2 text-sm outline-none focus:border-farm-400"
                          placeholder="Bicol" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-500">Total Yield (kg)</label>
                        <input type="number" value={form.totalYieldKg} onChange={(e) => setForm({ ...form, totalYieldKg: e.target.value })}
                          className="mt-1 w-full rounded-xl border border-stone-200 px-3.5 py-2 text-sm outline-none focus:border-farm-400"
                          placeholder="5000" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditMode(false)} className="flex-1 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50">Cancel</button>
                      <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
                        {saving ? <Loader2 size={16} className="animate-spin" /> : "Save Profile"}
                      </button>
                    </div>
                  </div>
                ) : hasProfile ? (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="rounded-xl bg-stone-50 p-3">
                      <p className="text-xs text-stone-500">Total Yield</p>
                      <p className="text-lg font-bold tabular-nums text-stone-900">{profile!.totalYieldKg.toLocaleString()} kg</p>
                    </div>
                    <div className="rounded-xl bg-stone-50 p-3">
                      <p className="text-xs text-stone-500">Region</p>
                      <p className="text-lg font-bold text-stone-900">{profile!.region || "—"}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-8">
                    <Sprout size={28} className="mb-2 text-stone-300" />
                    <p className="text-sm text-stone-400">Create your profile to start listing crops</p>
                    <button onClick={() => setEditMode(true)} className="btn-primary mt-3">Get Started</button>
                  </div>
                )}
              </div>

            </div>

            <div className="space-y-4">
              <div className="card-farm p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Wallet</p>
                <p className="mt-2 break-all font-mono text-xs text-stone-600">{truncate(address, 18)}</p>
                <p className="mt-1 text-[10px] text-stone-400">Stellar Testnet</p>
              </div>

              <div className="card-farm p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Status</p>
                <div className="mt-3 rounded-xl bg-farm-50 px-4 py-3 text-center">
                  <BadgeCheck size={24} className="mx-auto mb-1 text-farm-600" />
                  <p className="text-sm font-semibold text-farm-800">Verified Farmer</p>
                  <p className="text-xs text-farm-600">You can list crops on the marketplace</p>
                  <Link href="/explore" className="btn-primary mt-3 text-xs w-full justify-center">
                    <Plus size={14} /> List a Crop
                  </Link>
                  <Link href="/order" className="mt-2 block text-xs font-medium text-farm-700 hover:underline">
                    View My Orders →
                  </Link>
                </div>
              </div>

              {/* Reviews section */}
              <div className="card-farm p-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                    <MessageSquare size={12} /> Reviews
                  </p>
                  {address && <StarRatingComponent farmerId={address} />}
                </div>
                {address ? (
                  <ReviewList farmerId={address} compact={false} />
                ) : (
                  <p className="text-xs text-stone-400">Connect wallet to see reviews</p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StarRatingComponent({ farmerId }: { farmerId: string }) {
  const [rating, setRating] = useState<{ average: number; count: number } | null>(null);
  useEffect(() => {
    fetch(`/api/reviews/rating/${encodeURIComponent(farmerId)}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setRating(d); })
      .catch(() => {});
  }, [farmerId]);
  if (!rating || rating.count === 0) return <span className="text-xs text-stone-400">No reviews yet</span>;
  return <StarRating rating={rating.average} size={13} showValue reviewCount={rating.count} />;
}