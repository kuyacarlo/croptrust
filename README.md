# CropTrust

Agricultural forward contracts on Stellar with crop NFTs, escrow settlement, satellite-gated buyability, and disaster aid.

## Project Description

CropTrust is a decentralized marketplace for agricultural forward contracts built on Stellar. Farmers mint crop NFTs representing real parcels, satellite NDVI verification gates buyability, and XLM escrow protects both parties through delivery. Built with Soroban smart contracts, openEO satellite data, and an AI assistant for crop guidance.

## Project Vision

Democratize access to formal agricultural commodity markets for smallholder farmers worldwide by replacing trust-dependent paper contracts with verifiable, on-chain infrastructure — where crop health is provable via satellite, payments are escrowed programmatically, and every transaction leaves an immutable audit trail.

## Key Features

- **Crop NFTs** — Farmers mint NFTs representing crop parcels with metadata (crop type, quantity, price, region)
- **Satellite Verification** — NDVI analysis via Copernicus Sentinel-2 (openEO) gated by **X402 micro-payment** (0.1 XLM). All farmers auto-verified on signup.
- **XLM Escrow** — Buyers pay XLM; 20% upfront to farmer, 70% held in escrow until delivery, 10% to disaster treasury
- **Disaster Aid** — Farmers file claims for crop loss; on-chain proof of damage
- **AI Assistant** — NVIDIA NIM-powered chat for agricultural guidance

## How It Works

```
Farmer draws parcel on map → Mints crop NFT → NDVI check via satellite → Listing becomes buyable
       ↓                                                                           ↓
  Buyer purchases with XLM (20% upfront, 70% escrow, 10% treasury)          Delivery verified
       ↓                                                                           ↓
  Escrow released to farmer OR refunded to buyer (disaster/fraud)
```

1. **Farm** — Farmer signs up (auto-verified), draws their parcel on the interactive map
2. **Mint** — Fills crop details (type, quantity, price, harvest date) and mints a crop NFT on Stellar
3. **Verify** — Runs NDVI analysis via Copernicus Sentinel-2 (openEO) — gated by an X402 micro-payment (0.1 XLM) to cover API costs. Admin records attestation on-chain; if NDVI passes threshold, listing becomes buyable
4. **Market** — Listing appears in the marketplace for buyers to browse
5. **Buy** — Buyer purchases with XLM. 20% goes to farmer upfront, 70% held in escrow, 10% to disaster treasury pool
6. **Deliver** — Farmer ships the harvest; buyer confirms delivery
7. **Settle** — Escrow released to farmer on successful delivery; refunded to buyer if disaster or fraud

## Contract Details

Deployed on Stellar Testnet.

| Contract | ID |
|---|---|
| agri_con | `CC7CCIMTME2KBV7RRUTXAW6XTPE2FBRYLV3CLKF2YQNU5NHX5NYH37TC` |

**Source:** [contracts/agri_con/src/](contracts/agri_con/src/)

**Explorer:** https://stellar.expert/explorer/testnet/contract/CC7CCIMTME2KBV7RRUTXAW6XTPE2FBRYLV3CLKF2YQNU5NHX5NYH37TC

![Contract on Stellar Expert](public/contract-screenshot.png)
*Contract page on Stellar Expert explorer*

![Admin Account on Stellar Expert](public/account-screenshot.png)
*Admin account on Stellar Expert explorer*

### Contract Methods

| Method | Description |
|---|---|
| `mint_crop_nft_with_listing` | Mint a new crop NFT with listing metadata |
| `buy_crop_nft` | Purchase a listed crop NFT (XLM escrow) |
| `record_satellite_attestation` | Record NDVI attestation, sets buyability |
| `set_farmer_profile_verified` | Admin-signed on-chain verification |
| `submit_proof` | File a disaster proof for a crop |
| `verify_delivery` | Validator confirms delivery |
| `get_crop` | Read crop metadata |
| `get_listing_metadata` | Read listing metadata |
| `get_satellite_attestation` | Read NDVI attestation |
| `is_listing_buyable` | Check if a listing is buyable |
| `get_admin` | Get contract admin address |
| `get_treasury_pool_balance` | Get treasury pool balance |
| `get_next_nft_id` | Get the next NFT ID to be minted (used for full discovery) |

## Future Scope

- **Multi-chain expansion** — Port contracts to Stellar mainnet and explore other Soroban-enabled networks
- **Automated attestation** — Fully automated NDVI pipeline that triggers on mint without admin intervention
- **Mobile app** — React Native client for farmers to mint and manage listings from the field
- **Insurance pools** — On-chain crop insurance funded by treasury pool deposits
- **Carbon credits** — Integrate with carbon credit marketplaces using verified sustainable farming data
- **DAO governance** — Community-driven parameter updates (fee splits, NDVI thresholds, oracle set)

## Tech Stack

- **Frontend:** Next.js 16 (App Router, Turbopack)
- **Smart Contract:** Soroban (Rust) on Stellar Testnet
- **Database:** Neon (Serverless PostgreSQL) — farmers, listings, orders, reviews, attestations
- **Satellite Data:** openEO API (Copernicus Sentinel-2)
- **AI:** NVIDIA NIM (meta/llama-3.3-70b-instruct)
- **Wallet:** @creit.tech/stellar-wallets-kit (Freighter, XBull)
- **Payments:** x402-stellar-sdk (XLM micro-payments for NDVI verification)
- **CI/CD:** GitHub Actions + Vercel

## Prerequisites

- Node.js 20+
- npm
- Stellar CLI (`cargo install stellar-cli`) — for contract deployment
- A funded Stellar testnet identity

## Getting Started

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Fill in the required values (see below)

# Run dev server
npm run dev
```

### Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `NEXT_PUBLIC_STELLAR_RPC_URL` | Soroban RPC endpoint |
| `NEXT_PUBLIC_AGRI_CON_CONTRACT_ID` | Deployed contract ID |
| `NEXT_PUBLIC_TREASURY_ADDRESS` | Treasury/admin Stellar address |
| `ADMIN_SECRET_KEY` | Server-side secret key for admin-signed transactions (attestations, farmer verification) |
| `NVIDIA_API_KEY` or `NIM_TOKEN` | NVIDIA NIM API key |
| `OPENEO_CLIENT_ID` | Copernicus openEO client ID |
| `OPENEO_CLIENT_SECRET` | Copernicus openEO client secret |
| `X402_PRICE` | X402 micro-payment amount in XLM (default `0.1`) |

### Database

Tables are created on Neon PostgreSQL. Run the schema with `neonctl`:

```bash
npx neonctl psql --project-id <PROJECT_ID> --org-id <ORG_ID> -- -f supabase/migrations/20260625010000_core_tables.sql
npx neonctl psql --project-id <PROJECT_ID> --org-id <ORG_ID> -- -f supabase/migrations/20260625020000_reviews.sql
```

### Deploy Contract

```bash
bash deploy.sh
```

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/profile` | GET/POST | Farmer profile CRUD (auto-verified on create) |
| `/api/listings` | GET/POST | Crop listings CRUD |
| `/api/orders` | GET/POST | Order tracking |
| `/api/reviews` | GET/POST | Farmer reviews |
| `/api/attestations` | POST | Record attestation |
| `/api/stellar` | POST | Contract interaction (prepare/sign/submit) |
| `/api/verification/run` | POST | Run NDVI check (X402-gated, 0.1 XLM) |
| `/api/ai/chat` | POST | AI agricultural assistant |
| `/api/ai/ndvi-summary` | POST | NDVI data explanation |

## Pages

| Route | Description | Wallet Required |
|---|---|---|
| `/` | Landing page | No |
| `/explore` | Draw parcels, mint NFTs, satellite verification | Yes |
| `/marketplace` | Browse and buy listed crops | Yes |
| `/verify` | NDVI checks and attestation | Yes |
| `/aid` | File disaster claims | Yes |
| `/profile` | Farmer profile management | Yes |
| `/mylistings` | View your listed crops | Yes |
| `/order` | Track purchase orders | Yes |
| `/dashboard` | Analytics dashboard | Yes |

## Testing

```bash
# Unit tests (Stellar RPC, contract ID)
npm test

# E2E tests (production)
npx playwright test --config=e2e/playwright.config.ts
```

Tests target `https://agri-con-one.vercel.app` by default. Set `PLAYWRIGHT_BASE_URL` to test locally.

## CI/CD

- **Contract Deployment:** GitHub Action deploys Soroban contract on push to `main` (when contracts/ changes)
- **Frontend:** Auto-deployed to Vercel on push to `main`
- **Tests:** Unit tests run on every PR

## License

MIT
