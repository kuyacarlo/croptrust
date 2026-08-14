"use client";

import {
  createContext,
  ReactNode,
  startTransition,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

type WalletKitModule = typeof import("@creit.tech/stellar-wallets-kit");

type WalletState = {
  address: string | null;
  networkPassphrase: string;
  selectedWalletId: string | null;
  isBusy: boolean;
  error: string | null;
  connect: () => Promise<string | null>;
  disconnect: () => Promise<void>;
};

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const kitRef = useRef<WalletKitModule | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [networkPassphrase, setNetworkPassphrase] =
    useState<string>(TESTNET_PASSPHRASE);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let unsubscribeState = () => {};
    let unsubscribeWallet = () => {};
    let unsubscribeDisconnect = () => {};

    void (async () => {
      const [kitModule, moduleUtils] = await Promise.all([
        import("@creit.tech/stellar-wallets-kit"),
        import("@creit.tech/stellar-wallets-kit/modules/utils"),
      ]);

      if (!mounted) {
        return;
      }

      kitRef.current = kitModule;
      kitModule.StellarWalletsKit.init({
        modules: moduleUtils.defaultModules(),
        network: kitModule.Networks.TESTNET,
      });

      unsubscribeState = kitModule.StellarWalletsKit.on(
        kitModule.KitEventType.STATE_UPDATED,
        (event) => {
          startTransition(() => {
            setAddress(event.payload.address ?? null);
            setNetworkPassphrase(event.payload.networkPassphrase);
          });
        },
      );

      unsubscribeWallet = kitModule.StellarWalletsKit.on(
        kitModule.KitEventType.WALLET_SELECTED,
        (event) => {
          startTransition(() => {
            setSelectedWalletId(event.payload.id ?? null);
          });
        },
      );

      unsubscribeDisconnect = kitModule.StellarWalletsKit.on(
        kitModule.KitEventType.DISCONNECT,
        () => {
          startTransition(() => {
            setAddress(null);
            setSelectedWalletId(null);
          });
        },
      );
    })().catch((err) => {
      if (!mounted) {
        return;
      }

      setError(err instanceof Error ? err.message : "Wallet kit failed to load");
    });

    return () => {
      mounted = false;
      unsubscribeState();
      unsubscribeWallet();
      unsubscribeDisconnect();
    };
  }, []);

  async function connect() {
    setIsBusy(true);
    setError(null);

    try {
      const kit = kitRef.current;
      if (!kit) {
        throw new Error("Wallet kit is still loading");
      }

      const result = await kit.StellarWalletsKit.authModal();
      setAddress(result.address);
      return result.address;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet connection failed");
      return null;
    } finally {
      setIsBusy(false);
    }
  }

  async function disconnect() {
    setIsBusy(true);
    setError(null);

    try {
      const kit = kitRef.current;
      if (!kit) {
        return;
      }

      await kit.StellarWalletsKit.disconnect();
      setAddress(null);
      setSelectedWalletId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet disconnect failed");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <WalletContext.Provider
      value={{
        address,
        networkPassphrase,
        selectedWalletId,
        isBusy,
        error,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);

  if (!context) {
    throw new Error("useWallet must be used within WalletProvider");
  }

  return context;
}
