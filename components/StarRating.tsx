"use client";

import { useState } from "react";
import { Star } from "lucide-react";

type Props = {
  rating: number;
  max?: number;
  size?: number;
  interactive?: boolean;
  onChange?: (rating: number) => void;
  showValue?: boolean;
  reviewCount?: number;
};

export default function StarRating({
  rating,
  max = 5,
  size = 16,
  interactive = false,
  onChange,
  showValue = false,
  reviewCount,
}: Props) {
  const [hovered, setHovered] = useState(0);

  const display = interactive ? hovered || rating : rating;

  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => {
        const star = i + 1;
        const filled = star <= display;
        const half = !filled && star - 0.5 <= display;
        return (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onMouseEnter={() => interactive && setHovered(star)}
            onMouseLeave={() => interactive && setHovered(0)}
            onClick={() => interactive && onChange?.(star)}
            className={`${interactive ? "cursor-pointer transition-transform hover:scale-110" : "cursor-default"} ${!interactive && "pointer-events-none"}`}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
          >
            {half ? (
              <span className="relative inline-block" style={{ width: size, height: size }}>
                <Star size={size} className="absolute fill-stone-200 text-stone-200" />
                <span className="absolute overflow-hidden" style={{ width: size / 2 }}>
                  <Star size={size} className="fill-harvest-500 text-harvest-500" />
                </span>
              </span>
            ) : (
              <Star
                size={size}
                className={`transition-colors ${
                  filled ? "fill-harvest-500 text-harvest-500" : "fill-stone-200 text-stone-200"
                }`}
              />
            )}
          </button>
        );
      })}
      {showValue && (
        <span className="ml-1.5 text-sm font-semibold tabular-nums text-stone-700">
          {rating.toFixed(1)}
        </span>
      )}
      {reviewCount !== undefined && (
        <span className="text-xs text-stone-400">
          ({reviewCount})
        </span>
      )}
    </span>
  );
}
