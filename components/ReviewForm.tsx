"use client";

import { useState } from "react";
import { X, Send } from "lucide-react";
import StarRating from "./StarRating";

type Props = {
  orderId: string;
  farmerId: string;
  reviewer: string;
  parcelName?: string;
  onClose: () => void;
  onSubmitted: () => void;
};

export default function ReviewForm({ orderId, farmerId, reviewer, parcelName, onClose, onSubmitted }: Props) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, reviewer, farmerId, rating, comment: comment.trim() || undefined }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="animate-fade-in w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-lg"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-stone-800">Write a Review</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
            <X size={18} />
          </button>
        </div>

        {parcelName && (
          <p className="mb-4 text-sm text-stone-500">
            for <span className="font-medium text-stone-700">{parcelName}</span>
          </p>
        )}

        <div className="mb-5 flex flex-col items-center gap-2">
          <p className="text-sm font-medium text-stone-600">Your Rating</p>
          <StarRating rating={rating} size={32} interactive onChange={setRating} />
          {rating > 0 && (
            <span className="text-xs text-stone-400">
              {rating === 1 ? "Poor" : rating === 2 ? "Fair" : rating === 3 ? "Good" : rating === 4 ? "Very Good" : "Excellent"}
            </span>
          )}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your experience (optional)"
          rows={4}
          maxLength={500}
          className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700 placeholder:text-stone-400 focus:border-farm-400 focus:outline-none focus:ring-2 focus:ring-farm-200"
        />
        <p className="mt-1 text-right text-xs text-stone-400">{comment.length}/500</p>

        {error && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
        )}

        <div className="mt-4 flex gap-3">
          <button type="button" onClick={onClose} className="btn-outline flex-1 justify-center">
            Cancel
          </button>
          <button
            type="submit"
            disabled={rating < 1 || submitting}
            className="btn-primary flex-1 justify-center disabled:opacity-50"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Submitting…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send size={14} /> Submit Review
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
