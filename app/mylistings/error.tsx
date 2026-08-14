"use client";

import Link from "next/link";
import { List, RotateCcw, Home } from "lucide-react";

export default function MyListingsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-stone-50 px-4 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-farm-100 text-farm-600">
        <List size={32} />
      </div>
      <h2 className="mt-4 font-display text-xl font-bold text-stone-800 sm:text-2xl">
        Couldn&apos;t load your listings
      </h2>
      <p className="mt-2 max-w-sm text-sm text-stone-500">
        Your crop listings couldn&apos;t be retrieved. The network or your wallet connection may be temporarily unavailable.
      </p>
      <div className="mt-6 flex w-full max-w-xs flex-col gap-2 sm:w-auto sm:flex-row">
        <button onClick={reset} className="btn-primary inline-flex items-center justify-center gap-2">
          <RotateCcw size={16} /> Try Again
        </button>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
        >
          <Home size={16} /> Back Home
        </Link>
      </div>
    </div>
  );
}
