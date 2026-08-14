import Link from "next/link";
import { Leaf, Home, Store } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-stone-50 px-4 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-farm-900 text-white shadow-sm">
        <Leaf size={30} />
      </div>
      <p className="mt-6 font-display text-5xl font-black tracking-tight text-stone-800 sm:text-6xl">
        404
      </p>
      <h1 className="mt-2 font-display text-lg font-bold text-stone-700 sm:text-xl">
        This field is empty
      </h1>
      <p className="mt-2 max-w-sm text-sm text-stone-500">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved.
      </p>
      <div className="mt-6 flex w-full max-w-xs flex-col gap-2 sm:w-auto sm:flex-row">
        <Link
          href="/"
          className="btn-primary inline-flex items-center justify-center gap-2"
        >
          <Home size={16} /> Back Home
        </Link>
        <Link
          href="/marketplace"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
        >
          <Store size={16} /> Browse Marketplace
        </Link>
      </div>
    </div>
  );
}
