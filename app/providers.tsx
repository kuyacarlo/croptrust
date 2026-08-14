"use client";

import { ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { WalletProvider } from "@/components/stellar/wallet-context";
import WalletGate from "@/components/WalletGate";
import { ToastProvider } from "@/components/Toast";

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <WalletGate>
          <ToastProvider>{children}</ToastProvider>
        </WalletGate>
      </WalletProvider>
    </QueryClientProvider>
  );
}
