---
name: stellar-dev
description: Develop, debug, and extend Soroban smart contracts and Stellar TypeScript integrations for CropTrust. Use this whenever the user mentions Stellar, Soroban, smart contracts, escrow, crop NFTs, satellite attestations, wallet connection, transaction building, USDC payments — even 'contract' or 'blockchain' without specifying Stellar.
---

# Stellar/Soroban Development for CropTrust

This skill covers the full-stack Stellar blockchain integration in CropTrust: Soroban smart contracts (Rust), TypeScript SDK integration, wallet connection, transaction pipeline, satellite attestation, and environment setup.

Read the relevant reference file when you need deeper context on a specific area.

## Architecture Overview

```
Browser Wallet (Freighter/Albedo/Lobstr)
  │  wallet-context.tsx: StellarWalletsKit
  ▼
Next.js API Routes (app/api/stellar/route.ts)
  │  ┌────────────────────────────────────────────┐
  │  │ lib/stellar/backend.ts   — prepare + submit │
  │  │ lib/stellar/croptrust.ts — sign + submit   │
  │  │ lib/stellar/config.ts    — contract IDs     │
  │  │ lib/stellar/live-data.ts — read-only reads  │
  │  └────────────────────────────────────────────┘
  ▼
Soroban RPC ──► AgriConContract (unified, on-chain)
```

## Contract Architecture

One unified contract (`contracts/agri_con/src/lib.rs`) handles all operations. The three separate contracts (`crop_nft`, `escrow`, `verification`) are legacy; TypeScript code uses the unified contract via `NEXT_PUBLIC_AGRI_CON_CONTRACT_ID`.

### Key Contract Methods

| Method | Auth | Purpose |
|---|---|---|
| `mint_crop_nft_with_listing` | farmer | Mint NFT + listing metadata (one call) |
| `buy_crop_nft` | buyer | USDC transfer in, 70/20/10 split, NFT transfer |
| `verify_delivery` | validator | Settle escrow: release/refund + disaster NFT |
| `submit_proof` | farmer | Submit harvest proof hash |
| `record_satellite_attestation` | admin | Record NDVI + set buyability |
| `record_sat_attest_oracle` | oracle | Same, but oracle-authenticated |
| `add_validator` / `add_oracle` | admin | Register addresses |
| `set_listing_buyable` | admin | Toggle buyability |
| `upsert_farmer_profile` | farmer | Create/update profile |
| `set_farmer_profile_verified` | admin | Mark identity verified |

**Payment Split (70/20/10):**
```
escrow_amount = total * 70 / 100     // held until delivery verified
farmer_upfront = total * 20 / 100    // immediate payment  
treasury_amount = total * 10 / 100   // farmer aid pool
```

All amounts in stroops (7 decimals for USDC). Use `Soroban.parseTokenAmount(amount, 7)`.

### Storage Layout

**Instance storage** (global config): `Admin`, `UsdcToken`, `Treasury`, `TreasuryPoolBalance`, `NextId`

**Persistent storage** (per-NFT): `Crop(id)`, `Owner(id)`, `Profile(addr)`, `Listing(id)`, `Validator(addr)`, `Oracle(addr)`, `Proof(id)`, `Decision(id)`, `Buyable(id)`, `Attestation(id)`, `EscrowPosition(id)`

### Enums

```rust
CropStatus: Available | Reserved | Growing | Verified | Completed | Failed
EscrowStatus: Reserved | Released | Refunded
VerificationStatus: Pending | Delivered | Disaster | Fraud
```

## Transaction Pipeline

The critical flow for any contract write:

1. **Build** — `buildPreparedContractTransaction(addr, contractId, method, args)`
   - Loads account from Soroban RPC → creates `TransactionBuilder` with `BASE_FEE` → adds contract call → `server.prepareTransaction()`
2. **Sign** — `StellarWalletsKit.signTransaction(preparedXdr, { address, networkPassphrase })`
3. **Submit** — `server.sendTransaction(signedTx)` → hash + status

### Two Paths

- **Server-side** (`backend.ts`): API prepares unsigned XDR → returns to FE → FE signs + submits. **This is the preferred pattern.**
- **Client-side** (`croptrust.ts`): Signs in the same function, returns signed XDR for later submission.

## Read-Only Contract Queries

Use `simulateTransaction` with a "probe" address (funded account) set via `ORACLE_ADDRESS` or `TREASURY_ADDRESS`:

```typescript
const probe = getProbeAddress(); // reads ORACLE_ADDRESS || TREASURY_ADDRESS
const account = await server.getAccount(probe);
const sim = await server.simulateTransaction(tx);
return scValToNative(sim.result.retval);
```

This is how marketplace loads live data: `is_listing_buyable`, `get_crop`, `get_satellite_attestation`, `get_listing_metadata`, `get_farmer_profile`.

## Wallet Connection

`components/stellar/wallet-context.tsx` uses `@creit.tech/stellar-wallets-kit`:
- Init with `Networks.TESTNET`
- `connect()` → `kit.authModal()` shows wallet selector
- Sign via `kit.signTransaction(preparedXdr, { address, networkPassphrase })`
- Events: `STATE_UPDATED`, `WALLET_SELECTED`, `DISCONNECT`

## Satellite Attestation Flow

`app/api/verification/run/route.ts`:
1. Resolve openEO API from well-known discovery
2. OIDC token via `OPENEO_CLIENT_ID`/`OPENEO_CLIENT_SECRET`
3. NDVI process graph: `load_collection` → `ndvi` → `save_result` (GeoTIFF)
4. POST `/result` with Bearer token → decode GeoTIFF via `sharp` → compute mean NDVI
5. Clamp negative: `ndviBps = Math.max(0, rawNdviBps)`
6. SHA-256 hash of bbox + report data
7. Prepare `record_sat_attest_oracle` contract call (unless preview mode/nftId===0)

## Common Development Tasks

### Adding a new contract method
1. Add method to `contracts/agri_con/src/lib.rs`
2. Add `nativeToScVal(...)` args in `lib/stellar/backend.ts`
3. Add case in `app/api/stellar/route.ts` switch
4. Test: `cargo test -p agri-con`

### Adding a read-only query
1. Add public method (no `require_auth`) to contract
2. Add `readContract()` call in `lib/stellar/live-data.ts`
3. Wire up in `app/api/stellar/route.ts` under `get_*` actions

### Deploying contracts
```bash
cd contracts
soroban contract build
soroban contract deploy --source-account <admin> --network testnet \
  --wasm target/wasm32-unknown-unknown/release/agri_con.wasm
soroban contract invoke --id <id> --source <admin> --network testnet -- \
  __constructor --admin <addr> --usdc_token <addr> --treasury <addr>
```

### Running tests
```bash
cargo test                    # all contracts
cargo test -p agri-con        # unified contract
cargo test -p crop-nft        # legacy NFT
```

Tests use `Env::default()`, `env.mock_all_auths()`, and `Address::generate(&env)`.

## Reference Files

Read these for detailed context:
- `references/env-setup.md` — All 28 env vars with defaults and purpose
- `references/contract-api.md` — Full method signatures, types, errors, events
- `references/tx-patterns.md` — Transaction building, signing, scVal conversion, error handling