"use client";

import { useState, useEffect, useCallback } from "react";
import NavigationBar from "@/components/NavigationBar";
import NFTLifecycleFlow from "@/components/NFTLifecycleFlow";
import StarRating from "@/components/StarRating";
import ReviewForm from "@/components/ReviewForm";
import ReviewList from "@/components/ReviewList";
import { useToast } from "@/components/Toast";
import { MapPin, Leaf, ChevronDown, ChevronUp, Sprout, Clock, Shield, MessageSquare, Star, Truck } from "lucide-react";
import { truncate } from "@/lib/utils/truncate";
import { useWallet } from "@/components/stellar/wallet-context";
import type { LiveListing } from "@/lib/stellar/live-data";

type OrderReview = {
  id: string;
  orderId: string;
  reviewer: string;
  rating: number;
  comment: string | null;
  createdAt: string;
};

const TABS = [
  { key: "all", label: "All Orders" },
  { key: "escrow", label: "In Escrow" },
  { key: "completed", label: "Settled" },
];

export default function OrderPage() {
  const { address } = useWallet();
  const [listings, setListings] = useState<LiveListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [reviewingOrder, setReviewingOrder] = useState<{ orderId: string; nftId: number; farmerId: string; parcelName: string } | null>(null);
  const [reviews, setReviews] = useState<Record<string, OrderReview>>({});
  const [farmerRatings, setFarmerRatings] = useState<Record<string, { average: number; count: number }>>({});
  const [settlingId, setSettlingId] = useState<number | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/stellar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get_all_listings" }),
        });
        const data = await res.json();
        if (!cancelled && data.ok && Array.isArray(data.listings)) {
          setListings(data.listings);
          return;
        }
      } catch {}

      try {
        const { getLiveListings } = await import("@/lib/stellar/live-data");
        const live = await getLiveListings();
        if (!cancelled) setListings(live);
      } catch {} finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const loadReviews = useCallback(async (farmerIds: string[]) => {
    const unique = [...new Set(farmerIds.filter(Boolean))];
    const ratings: Record<string, { average: number; count: number }> = {};
    await Promise.all(
      unique.map(async (fid) => {
        try {
          const r = await fetch(`/api/reviews/rating/${encodeURIComponent(fid)}`);
          const d = await r.json();
          if (d.ok) ratings[fid] = { average: d.average, count: d.count };
        } catch {}
      }),
    );
    setFarmerRatings((prev) => ({ ...prev, ...ratings }));
  }, []);

  useEffect(() => {
    if (listings.length > 0) {
      loadReviews(listings.map((l) => l.farmer ?? ""));
    }
  }, [listings, loadReviews]);

  const handleConfirmDelivery = useCallback(async (nftId: number) => {
    setSettlingId(nftId);
    try {
      const res = await fetch("/api/stellar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify_delivery", nftId }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("Delivery confirmed on-chain! Funds released.", "success");
        setListings((prev) => prev.map((l) => (l.nftId === nftId ? { ...l, buyable: true } : l)));
      } else {
        showToast(data.error || "Failed to verify delivery", "error");
      }
    } catch {
      showToast("Network error confirming delivery", "error");
    } finally {
      setSettlingId(null);
    }
  }, [showToast]);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    async function loadUserOrders() {
      try {
        const res = await fetch(`/api/orders?buyerAddress=${encodeURIComponent(address as string)}`);
        const data = await res.json();
        if (!cancelled && data.ok && Array.isArray(data.orders)) {
          const reviewMap: Record<string, OrderReview> = {};
          for (const o of data.orders) {
            if (o.reviews?.[0]) {
              const nftId = o.listing?.nftId;
              if (nftId) {
                reviewMap[nftId] = { id: o.reviews[0].id, orderId: o.id, reviewer: o.reviews[0].reviewer, rating: o.reviews[0].rating, comment: o.reviews[0].comment, createdAt: o.reviews[0].createdAt };
              }
            }
          }
          setReviews(reviewMap);
        }
      } catch {}
    }
    loadUserOrders();
    return () => { cancelled = true; };
  }, [address]);

  const filtered = listings.filter((l) => {
    if (activeTab === "escrow") return !l.buyable;
    if (activeTab === "completed") return l.buyable;
    return true;
  });

  const escrowCount = listings.filter((l) => !l.buyable).length;
  const settledCount = listings.filter((l) => l.buyable).length;

  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <NavigationBar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-stone-900">My Orders</h1>
            <p className="mt-1 text-sm text-stone-500">Track your crop purchases and settlements</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex gap-1 rounded-xl border border-stone-200 bg-stone-100 p-1 w-fit">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                    activeTab === t.key ? "bg-white text-farm-800 shadow-sm" : "text-stone-500 hover:text-stone-700"
                  }`}
                >
                  {t.label}
                  {t.key === "escrow" && escrowCount > 0 && (
                    <span className="ml-1.5 rounded-full bg-harvest-100 px-1.5 text-[10px] font-bold text-harvest-700">{escrowCount}</span>
                  )}
                  {t.key === "completed" && settledCount > 0 && (
                    <span className="ml-1.5 rounded-full bg-farm-100 px-1.5 text-[10px] font-bold text-farm-700">{settledCount}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Orders list */}
            <div className="mt-4 space-y-3">
              {loading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="card-farm p-5">
                      <div className="flex items-center gap-4">
                        <div className="skeleton h-10 w-10 rounded-xl" />
                        <div className="flex-1 space-y-2">
                          <div className="skeleton h-4 w-48" />
                          <div className="skeleton h-3 w-32" />
                        </div>
                        <div className="skeleton h-6 w-16 rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="card-farm flex flex-col items-center py-16">
                  <Sprout size={40} className="mb-3 text-stone-200" />
                  <p className="text-sm font-semibold text-stone-400">No orders yet</p>
                  <p className="mt-1 text-xs text-stone-300">
                    {activeTab === "all"
                      ? "Visit the marketplace to make your first purchase"
                      : activeTab === "escrow" ? "No active escrow orders" : "No settled orders yet"}
                  </p>
                </div>
              ) : (
                filtered.map((l) => {
                  const label = l.parcelName ?? l.cropType ?? `Parcel #${l.nftId}`;
                  const ndviPct = l.ndviBps !== null ? `${(l.ndviBps / 100).toFixed(0)}%` : null;
                  const isExpanded = expandedId === l.nftId;

                  return (
                    <div key={l.nftId} className={`card-farm card-hover overflow-hidden ${isExpanded ? "border-farm-300 ring-1 ring-farm-200" : ""}`}>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : l.nftId)}
                        className="flex w-full items-center gap-4 px-5 py-4 text-left"
                      >
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${l.buyable ? "bg-farm-100 text-farm-700" : "bg-harvest-100 text-harvest-700"}`}>
                          {l.buyable ? <Shield size={18} /> : <Clock size={18} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-stone-800">{label}</p>
                          <p className="flex items-center gap-1 text-xs text-stone-400">
                            <MapPin size={10} /> {l.region ?? "Unknown"}
                            {ndviPct && <> &middot; NDVI {ndviPct}</>}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 text-right text-sm">
                          {l.priceXlm && (
                            <span className="font-semibold tabular-nums text-stone-800">{l.priceXlm} XLM</span>
                          )}
                          <span className={l.buyable ? "badge-buyable" : "badge-pending"}>
                            {l.buyable ? "Settled" : "Escrow"}
                          </span>
                          {isExpanded ? <ChevronUp size={16} className="text-stone-400" /> : <ChevronDown size={16} className="text-stone-400" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-stone-100 bg-stone-50/50 px-5 py-4">
                          <NFTLifecycleFlow current={l.buyable ? "settled" : "purchased"} compact />
                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-stone-400">Crop</span>
                                <span className="font-medium capitalize">{l.cropType ?? "—"}</span>
                              </div>
                              {l.quantityKg !== null && (
                                <div className="flex justify-between">
                                  <span className="text-stone-400">Quantity</span>
                                  <span className="font-medium">{l.quantityKg.toLocaleString()} kg</span>
                                </div>
                              )}
                              {l.parcelAreaHectares !== null && (
                                <div className="flex justify-between">
                                  <span className="text-stone-400">Area</span>
                                  <span className="font-medium">{l.parcelAreaHectares.toFixed(2)} ha</span>
                                </div>
                              )}
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-stone-400">Payment Split</span>
                                <span className="font-medium text-stone-700">70% / 20% / 10%</span>
                              </div>
                              {l.farmer && (
                                <div className="flex justify-between">
                                  <span className="text-stone-400">Seller</span>
                                  <span className="font-mono text-[11px] text-stone-600">{truncate(l.farmer, 14)}</span>
                                </div>
                              )}
                              {l.observedAt && (
                                <div className="flex justify-between">
                                  <span className="text-stone-400">Verified</span>
                                  <span className="flex items-center gap-1 text-xs text-farm-700">
                                    <Clock size={11} /> {new Date(l.observedAt * 1000).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          {/* Settlement button */}
                          {!l.buyable && (
                            <button
                              onClick={() => handleConfirmDelivery(l.nftId)}
                              disabled={settlingId === l.nftId}
                              className="btn-primary mt-4 w-full justify-center gap-2 text-sm"
                            >
                              <Truck size={14} />
                              {settlingId === l.nftId ? "Confirming delivery..." : "Confirm Delivery & Release Escrow"}
                            </button>
                          )}
                          {/* Review section */}
                          <div className="mt-4 border-t border-stone-200 pt-4">
                            <div className="flex items-center justify-between">
                              <h4 className="flex items-center gap-1.5 text-sm font-semibold text-stone-700">
                                <MessageSquare size={14} /> Review
                              </h4>
                              {farmerRatings[l.farmer ?? ""]?.count > 0 && (
                                <StarRating
                                  rating={farmerRatings[l.farmer ?? ""].average}
                                  size={13}
                                  showValue
                                  reviewCount={farmerRatings[l.farmer ?? ""].count}
                                />
                              )}
                            </div>
                            {l.buyable && l.farmer ? (
                              reviews[l.nftId.toString()] ? (
                                <div className="mt-2 rounded-xl border border-farm-100 bg-farm-50/50 p-3">
                                  <div className="flex items-center gap-2">
                                    <StarRating rating={reviews[l.nftId.toString()].rating} size={14} />
                                    <span className="text-xs text-stone-400">{new Date(reviews[l.nftId.toString()].createdAt).toLocaleDateString()}</span>
                                  </div>
                                  {reviews[l.nftId.toString()].comment && (
                                    <p className="mt-1 text-sm text-stone-600">{reviews[l.nftId.toString()].comment}</p>
                                  )}
                                </div>
                              ) : (
                                <button
                                  onClick={() => setReviewingOrder({ orderId: l.nftId.toString(), nftId: l.nftId, farmerId: l.farmer!, parcelName: label })}
                                  className="btn-outline mt-2 w-full justify-center text-xs"
                                >
                                  <Star size={13} /> Leave a Review
                                </button>
                              )
                            ) : (
                              !l.buyable && (
                                <p className="mt-2 text-xs text-stone-400">Review available after settlement</p>
                              )
                            )}
                            {l.farmer && (
                              <div className="mt-3">
                                <ReviewList farmerId={l.farmer} compact initialCount={2} />
                              </div>
                            )}
                          </div>
                          <div className="mt-3 flex gap-4 text-xs">
                            <a href="/explore" className="font-medium text-farm-700 hover:underline">
                              View on Map
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
      </main>

      {reviewingOrder && (
        <ReviewForm
          orderId={reviewingOrder.orderId}
          farmerId={reviewingOrder.farmerId}
          reviewer={address ?? ""}
          parcelName={reviewingOrder.parcelName}
          onClose={() => setReviewingOrder(null)}
          onSubmitted={() => {
            setReviewingOrder(null);
            loadReviews([reviewingOrder.farmerId]);
          }}
        />
      )}
    </div>
  );
}