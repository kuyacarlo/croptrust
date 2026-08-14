# agri-con Workflow

## Roles

| Role | Description |
|------|-------------|
| **Farmer** | Mints crop NFTs, submits delivery proof |
| **Buyer** | Purchases crop NFTs (USDC) |
| **Admin** | Deploys contract, records satellite attestations, sets buyable flags, verifies farmer profiles |
| **Validator** | Verifies crop delivery (Delivered / Disaster / Fraud) |

## Smart Contract

Single monolithic contract at `NEXT_PUBLIC_AGRI_CON_CONTRACT_ID`.
All functions (crop NFT, escrow, verification, profiles) live in `contracts/agri_con/src/lib.rs`.

---

## Flow: Farmer registers & lists a crop

```
Farmer connects wallet → fills listing form
  ↓
prepareMintCropNft() builds unsigned XDR (mint_crop_nft_with_listing)
  ↓
Wallet signs via StellarWalletsKit
  ↓
submitSignedXdr() → RPC → on-chain
  ↓
NFT created. Farmer profile can be upserted via admin.
```

## Flow: Satellite NDVI attestation

```
Admin or oracle clicks "Run NDVI check"
  ↓
POST /api/verification/run  { nftId, bbox, minNdviBps }
  ↓
[x402 payment gate] — buyer pays 0.1 XLM (unless preview nftId=0)
  ↓
[openEO auth] — OAuth2 client_credentials → token
  ↓
[Sentinel Hub] — load_collection(B04,B08) → ndvi → save_result(GTIFF)
  ↓
[sharp] — decode GeoTIFF float raster → mean NDVI → basis points
  ↓
[contract call] — record_satellite_attestation (admin-signed)
  ↓
buyable = ndvi_bps >= min_ndvi_bps → stored on-chain
```

## Flow: Buyer purchases crop

```
Buyer finds listing → clicks Buy
  ↓
prepareBuyCropNft() builds unsigned XDR (buy_crop_nft)
  ↓
Wallet signs → submit
  ↓
EscrowPosition created (Reserved). USDC locked.
  ↓
Farmer delivers → submits delivery proof (submit_proof)
  ↓
Validator inspects → calls verify_delivery
  ├─ Delivered → escrow released to farmer
  ├─ Disaster → partial refund to buyer
  └─ Fraud → full refund to buyer
```

## CI/CD: Contract deployment

Triggered on push to `main` touching `contracts/**`, `deploy.sh`, or `.github/workflows/**`.

```
.github/workflows/deploy-contract.yml
  │
  ├─ Install Rust + wasm32v1-none target
  ├─ Install Stellar CLI (cargo install)
  ├─ Install jq, bc
  ├─ Import admin identity from STELLAR_ADMIN_SECRET secret
  └─ IDENTITY=ci-identity bash deploy.sh
       │
       ├─ [0] cargo build --target wasm32v1-none --release
       ├─ [1] Simulate upload cost
       ├─ [2] stellar contract upload
       ├─ [3] Simulate deploy+constructor cost
       ├─ [4] stellar contract deploy
       │       constructor args: --admin, --usdc_token, --treasury
       └─ [5] Verify: get_admin, get_usdc_token, mint test NFT
```

## Contract Functions by category

### Read (any source account)
- `get_admin`, `get_usdc_token`, `get_treasury`, `get_treasury_pool_balance`
- `get_next_nft_id`, `get_crop(nft_id)`, `get_farmer(nft_id)`, `get_price(nft_id)`
- `get_listing_metadata(nft_id)`, `get_farmer_profile(address)`
- `get_satellite_attestation(nft_id)`, `is_listing_buyable(nft_id)`
- `get_escrow_position(nft_id)`, `get_proof(nft_id)`, `get_decision(nft_id)`

### Write (wallet-signed)
- `mint_crop_nft_with_listing(...)` — Farmer
- `buy_crop_nft(buyer, nft_id)` — Buyer
- `submit_proof(farmer, nft_id, proof_hash)` — Farmer

### Write (admin-signed)
- `record_satellite_attestation(...)` — Admin/oracle
- `set_listing_buyable(nft_id, bool)` — Admin
- `upsert_farmer_profile(...)` — Admin
- `set_farmer_profile_verified(farmer, bool)` — Admin
- `add_validator(validator)` — Admin

### Write (validator-signed)
- `verify_delivery(validator, nft_id, status, notes_hash, refund, treasury_comp)` — Validator

## Environment Variables

### Required (local + Vercel)
| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE` | Testnet passphrase |
| `NEXT_PUBLIC_STELLAR_RPC_URL` | Soroban RPC endpoint |
| `NEXT_PUBLIC_STELLAR_HORIZON_URL` | Horizon endpoint |
| `NEXT_PUBLIC_AGRI_CON_CONTRACT_ID` | Deployed contract address |
| `NEXT_PUBLIC_TREASURY_ADDRESS` | Treasury wallet (also probe for reads) |
| `ADMIN_SECRET_KEY` | Admin Stellar secret key (server-side signing) |
| `OPENEO_CLIENT_ID` | Copernicus Data Space OAuth2 client ID |
| `OPENEO_CLIENT_SECRET` | Copernicus Data Space OAuth2 client secret |

### Optional
| Variable | Purpose |
|----------|---------|
| `NVIDIA_API_KEY` | AI summaries (NDVI analysis) |
| `OPENEO_SH_BASE_URL` | Sentinel Hub openEO endpoint |
| `X402_PRICE` | Payment gate fee in XLM (default 0.1) |
| `GOOGLE_MAPS_API_KEY` | Parcel map |

## Testing locally

```bash
npm run dev          # Start dev server
bash explorer.sh     # Read-only chain explorer
```

Open `http://localhost:3000` — connect wallet, browse marketplace, run NDVI verification.
