"use client";

import { Map } from "lucide-react";

export default function ExploreError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-farm-100 text-farm-600">
        <Map size={32} />
      </div>
      <h2 className="mt-4 font-display text-xl font-bold text-stone-800">
        Map failed to load
      </h2>
      <p className="mt-2 text-sm text-stone-500 text-center max-w-sm">
        The parcel explorer couldn&apos;t load. Google Maps or satellite data might be temporarily unavailable.
      </p>
      <button
        onClick={reset}
        className="btn-primary mt-6"
      >
        Try Again
      </button>
    </div>
  );
}