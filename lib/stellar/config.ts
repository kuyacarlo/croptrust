export const STELLAR_NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ??
  "Test SDF Network ; September 2015";

export const STELLAR_RPC_URL =
  process.env.NEXT_PUBLIC_STELLAR_RPC_URL ??
  "https://soroban-testnet.stellar.org";

export const STELLAR_HORIZON_URL =
  process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL ??
  "https://horizon-testnet.stellar.org";

/**
 * Resolve the secret key used to sign admin-authorized contract calls
 * (satellite attestations, farmer verification, delivery settlement).
 *
 * In this deployment the unified `agri_con` contract authorizes these calls
 * via `require_admin()` → `admin.require_auth()`, so the signer MUST be the
 * on-chain admin (the AI attestor wallet). It also pays the x402 micro-payment
 * and tx fees, so it must hold XLM.
 *
 * Accepts several historical env var names to bridge the prod/CI mismatch:
 * the deploy workflow syncs `ORACLE_SECRET_KEY` to Vercel and the contract
 * deploy workflow uses `STELLAR_ADMIN_SECRET`, while the app code originally
 * only read `ADMIN_SECRET_KEY`. We accept all three (in priority order).
 */
export function getAdminSecretKey(): string {
  return (
    process.env.ADMIN_SECRET_KEY ||
    process.env.STELLAR_ADMIN_SECRET ||
    process.env.ORACLE_SECRET_KEY ||
    ""
  );
}

export const CONTRACT_IDS = {
  agriCon: process.env.NEXT_PUBLIC_AGRI_CON_CONTRACT_ID ?? "",
  cropNft: process.env.NEXT_PUBLIC_CROP_NFT_CONTRACT_ID ?? process.env.NEXT_PUBLIC_AGRI_CON_CONTRACT_ID ?? "",
  escrow: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID ?? process.env.NEXT_PUBLIC_AGRI_CON_CONTRACT_ID ?? "",
  verification: process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT_ID ?? process.env.NEXT_PUBLIC_AGRI_CON_CONTRACT_ID ?? "",
} as const;