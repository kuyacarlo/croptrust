"use client";

import { useState, useEffect } from "react";
import { MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { truncate } from "@/lib/utils/truncate";
import StarRating from "./StarRating";

type Review = {
  id: string;
  orderId: string;
  reviewer: string;
  farmerId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  order?: {
    listing?: { parcelName: string | null; cropType: string | null };
  };
};

type Props = {
  farmerId: string;
  compact?: boolean;
  initialCount?: number;
};

export default function ReviewList({ farmerId, compact = false, initialCount }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/reviews?farmerId=${encodeURIComponent(farmerId)}`);
        const data = await res.json();
        if (!cancelled && data.ok) setReviews(data.reviews);
      } catch {} finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [farmerId]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="skeleton h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    if (compact) return null;
    return (
      <div className="flex flex-col items-center py-8 text-stone-400">
        <MessageSquare size={28} className="mb-2" />
        <p className="text-sm font-medium">No reviews yet</p>
      </div>
    );
  }

  const display = compact && !expanded ? reviews.slice(0, initialCount ?? 3) : reviews;

  return (
    <div className="space-y-3">
      {display.map((r) => (
        <div key={r.id} className="rounded-xl border border-stone-100 bg-stone-50/50 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <StarRating rating={r.rating} size={14} />
                <span className="text-xs text-stone-400">
                  {new Date(r.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-1 text-xs text-stone-500">
                by <span className="font-mono text-[10px]">{truncate(r.reviewer, 10)}</span>
                {r.order?.listing?.parcelName && (
                  <> for <span className="font-medium text-stone-600">{r.order.listing.parcelName}</span></>
                )}
              </p>
            </div>
          </div>
          {r.comment && (
            <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{r.comment}</p>
          )}
        </div>
      ))}

      {compact && reviews.length > (initialCount ?? 3) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-center gap-1 rounded-xl border border-stone-200 py-2 text-xs font-medium text-stone-500 transition hover:bg-stone-100"
        >
          {expanded ? (
            <>Show less <ChevronUp size={12} /></>
          ) : (
            <>See all {reviews.length} reviews <ChevronDown size={12} /></>
          )}
        </button>
      )}
    </div>
  );
}
