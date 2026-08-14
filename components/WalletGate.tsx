"use client";

import { useWallet } from "@/components/stellar/wallet-context";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { Wallet, Loader2 } from "lucide-react";

const PUBLIC_PATHS = ["/"];

export default function WalletGate({ children }: { children: ReactNode }) {
  const { address, connect, isBusy, error } = useWallet();
  const pathname = usePathname();

  if (address || PUBLIC_PATHS.includes(pathname)) return <>{children}</>;

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-farm-900 text-white shadow-sm mb-6">
        <Wallet size={28} />
      </div>
      <h1 className="font-display text-2xl font-bold text-stone-900">Connect Your Wallet</h1>
      <p className="mt-2 text-sm text-stone-500 max-w-sm">
        Connect your Stellar wallet to access CropTrust features.
      </p>
      <button
        onClick={connect}
        disabled={isBusy}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-farm-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-farm-800 disabled:opacity-50"
      >
        {isBusy && <Loader2 size={15} className="animate-spin" />}
        {isBusy ? "Connecting..." : "Connect Wallet"}
      </button>
      {error && <p className="mt-3 max-w-xs text-xs text-red-600">{error}</p>}
    </div>
  );
}
