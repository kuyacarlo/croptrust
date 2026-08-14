"use client";

import { useWallet } from "@/components/stellar/wallet-context";

function shorten(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export default function ConnectWallet() {
  const { address, connect, disconnect, error, isBusy, selectedWalletId } =
    useWallet();

  if (address) {
    return (
      <div className="hidden sm:flex items-center gap-2">
        <div className="rounded-full border border-emerald-900/10 bg-emerald-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-900 sm:px-4 sm:tracking-[0.16em]">
          <span className="hidden md:inline">{selectedWalletId ?? "wallet"} · </span>
          {shorten(address)}
        </div>
        <button
          className="inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-emerald-900 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-emerald-800 sm:px-5"
          onClick={() => {
            void disconnect();
          }}
          type="button"
        >
          {isBusy ? "..." : "Disconnect"}
        </button>
      </div>
    );
  }

  return null;
}
