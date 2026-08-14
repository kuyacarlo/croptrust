"use client";

import { Sprout } from "lucide-react";

export default function MarketplaceError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-farm-100 text-farm-600">
        <Sprout size={32} />
      </div>
      <h2 className="mt-4 font-display text-xl font-bold text-stone-800">
        Something went wrong
      </h2>
      <p className="mt-2 text-sm text-stone-500 text-center max-w-sm">
        We couldn&apos;t load the marketplace. This might be a temporary issue with the Stellar network.
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