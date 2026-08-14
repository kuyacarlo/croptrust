"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-stone-50 px-4 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
        <AlertTriangle size={32} />
      </div>
      <h2 className="mt-4 font-display text-xl font-bold text-stone-800 sm:text-2xl">
        Something went wrong
      </h2>
      <p className="mt-2 max-w-sm text-sm text-stone-500">
        An unexpected error occurred. You can retry, or head back to the homepage.
      </p>
      {error?.digest && (
        <p className="mt-2 font-mono text-[11px] text-stone-400">ref: {error.digest}</p>
      )}
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
