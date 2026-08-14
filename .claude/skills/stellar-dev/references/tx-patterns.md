# Transaction Patterns — Stellar/Soroban TypeScript

## Core Files

| File | Role |
|---|---|
| `lib/stellar/config.ts` | Network passphrase, RPC/Horizon URLs, contract IDs |
| `lib/stellar/backend.ts` | **Server-side** prepare + submit (preferred for new code) |
| `lib/stellar/croptrust.ts` | **Client-side** prepare + sign + submit (legacy, used by components) |
| `app/api/stellar/route.ts` | API route: switch on `action`, calls backend.ts functions |
| `app/api/stellar/route.ts` POST | 15 actions: 9 `prepare_*`, `submit_signed_xdr`, 5 read queries |

## Pattern: Building a Contract Call (Server-Side)

```typescript
import { BASE_FEE, Contract, rpc, TimeoutInfinite, TransactionBuilder, nativeToScVal, xdr } from "@stellar/stellar-sdk";

async function buildPreparedContractTransaction(
  address: string,      // Stellar address of the signer
  contractId: string,   // From CONTRACT_IDS
  method: string,       // Contract method name
  args: xdr.ScVal[],    // nativeToScVal(...) args
) {
  const server = new rpc.Server(STELLAR_RPC_URL);
  const account = await server.getAccount(address);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(TimeoutInfinite)
    .build();

  return server.prepareTransaction(tx);
}
```

## Pattern: scVal Conversion

```typescript
// Address        → nativeToScVal(addr, { type: "address" })
// String         → nativeToScVal(str, { type: "string" })
// u64 / number   → nativeToScVal(n, { type: "u64" })
// u32            → nativeToScVal(n, { type: "u32" })
// i128 / bigint  → nativeToScVal(n, { type: "i128" })
// bool           → nativeToScVal(b, { type: "bool" })
```

## Pattern: USDC Amount Conversion

```typescript
// 7-decimal USDC (stroops)
const stroops = Soroban.parseTokenAmount("100.50", 7); // → 1005000000n

// Back to human-readable
const usdc = Number(stroops) / 10_000_000; // → 100.5
```

## Pattern: scValToNative (Decoding Responses)

```typescript
import { scValToNative } from "@stellar/stellar-sdk";

const sim = await server.simulateTransaction(tx);
if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
const result = scValToNative(sim.result.retval);

// Types returned:
// - address → string (Stellar address)
// - string  → string
// - u64/u32 → number
// - i128    → bigint
// - bool    → boolean
// - vec     → array
// - map     → object (Record<string, unknown>)
```

## Pattern: StellarWalletsKit Signing

```typescript
import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";

const { signedTxXdr } = await StellarWalletsKit.signTransaction(preparedXdr, {
  address: userAddress,
  networkPassphrase: "Test SDF Network ; September 2015",
});

const tx = TransactionBuilder.fromXDR(signedTxXdr, networkPassphrase);
const hash = tx.hash().toString("hex");
```

## Pattern: Submit to Soroban RPC

```typescript
const tx = TransactionBuilder.fromXDR(signedXdr, STELLAR_NETWORK_PASSPHRASE);
const result = await server.sendTransaction(tx);

// Returns: { hash, status, errorResultXdr? }
// Status: "PENDING" → "SUCCESS" or "ERROR"
```

## Pattern: Read-Only Contract Query (simulateTransaction)

```typescript
// Requires a funded "probe" account set via ORACLE_ADDRESS or TREASURY_ADDRESS
function getProbeAddress(): string {
  return process.env.ORACLE_ADDRESS ?? process.env.NEXT_PUBLIC_ORACLE_ADDRESS
      ?? process.env.TREASURY_ADDRESS ?? process.env.NEXT_PUBLIC_TREASURY_ADDRESS ?? "";
}

async function readContract(method: string, args: xdr.ScVal[]) {
  const probe = getProbeAddress();
  if (!probe) throw new Error("Missing probe address");

  const server = new rpc.Server(STELLAR_RPC_URL);
  const account = await server.getAccount(probe);
  const contract = new Contract(CONTRACT_ID);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(TimeoutInfinite)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  return scValToNative(sim.result.retval);
}
```

## Error Handling

```typescript
// RPC errors
if (rpc.Api.isSimulationError(sim)) {
  // sim.error contains the error string from the contract
}

// Contract errors (AgriConError enum)
// Unauthorized (2), NotFound (3), InvalidStatus (4), ProfileMissing (5),
// ProofMissing (6), AttestationMissing (7), PositionExists (8), PositionMissing (9), InvalidAmount (10)

// Network errors
try {
  const account = await server.getAccount(address);
} catch (err) {
  // May be a 404 if unfunded, or network timeout
}
```

## NFT ID Range Logic

```typescript
function parseNftIds() {
  const raw = process.env.ACTIVE_NFT_IDS ?? process.env.NEXT_PUBLIC_ACTIVE_NFT_IDS ?? null;
  if (raw) {
    return raw.split(",").map(v => Number(v.trim())).filter(v => Number.isInteger(v) && v > 0);
  }
  const max = parseInt(process.env.NFT_MAX_ID ?? process.env.NEXT_PUBLIC_NFT_MAX_ID ?? "20", 10);
  return Array.from({ length: max }, (_, i) => i + 1); // 1..max
}
```