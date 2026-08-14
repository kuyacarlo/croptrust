---
name: agri-con-e2e
description: >
 End-to-end test flow for CropTrust: local dev setup, contract redeployment
 on testnet, attestation debugging, marketplace buy flow, and CI/CD. Run
 this skill whenever a full integration test is needed or after contract
 changes.
license: MIT
---

# CropTrust E2E Test Runner

## 1. Local Environment Setup

```bash
# Copy example env and fill in secrets
cp .env.example .env.local

# Install dependencies
npm install

# Start dev server
npm run dev
```

Key env vars you need to fill in `.env.local`:
| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_AGRI_CON_CONTRACT_ID` | From `deploy.sh` output or Vercel dashboard |
| `NVIDIA_API_KEY` | From user's NVIDIA account |
| `OPENEO_CLIENT_ID` / `OPENEO_CLIENT_SECRET` | From Copernicus Data Space Ecosystem |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Cloud Console → APIs → Maps JavaScript |
| `ORACLE_SECRET_KEY` | The Stellar secret key for the oracle account |

## 2. Contract Redeployment (Testnet Only)

```bash
# Prerequisites
# - soroban-cli installed (cargo install soroban-cli --version 25.0.1)
# - Stellar Testnet account funded (use friendbot)

# Deploy all contracts
./deploy.sh
```

`deploy.sh` does:
1. Builds WASM: `cd contracts/agri_con && cargo build --target wasm32-unknown-unknown --release`
2. Installs + deploys to Testnet via `soroban contract deploy`
3. Initializes contract: admin address, USDC contract ID, treasury address
4. Registers oracle: `soroban contract invoke ... -- add_oracle --oracle <ORACLE_ADDRESS>`
5. Outputs contract IDs → copy these to `.env.local`

### Oracle Registration (Critical)

The oracle address in Vercel is `GAQTXZLBZ2MTU2GWFEDHXBMJ7BMUZFXTW37ZNZF2IQYWQFPWPHTJWNA3`.
During `deploy.sh`, after contract init, you MUST run:

```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  --source-account <ADMIN_SECRET> \
  --network testnet \
  -- \
  add_oracle \
  --oracle GAQTXZLBZ2MTU2GWFEDHXBMJ7BMUZFXTW37ZNZF2IQYWQFPWPHTJWNA3
```

Without this, `record_sat_attest_oracle` will fail with `Error(Contract, #1)` (Unauthorized).

## 3. Attestation Debug Flow

When `/api/verification/run` returns errors, use this checklist:

### 3a. "bad union" Error
- **Cause**: Transaction source account ≠ signing wallet. The `prepare_record_satellite_attestation` path builds with the oracle as source but the user's wallet tries to sign.
- **Fix**: Set `ORACLE_SECRET_KEY` env var → the server-side `submitRecordSatelliteAttestationByOracle()` path activates, signing with the oracle key directly.

### 3b. Error(Contract, #2) — "AlreadyInitialized"
- **Cause 1**: Oracle not registered. Run `add_oracle` during deploy.
- **Cause 2**: NFT/crop doesn't exist. Mint first via `/explore` or `mint_crop_nft_with_listing`.
- **Fix**: Verify oracle is registered by checking contract storage:
  ```bash
  soroban contract invoke --id <ID> --network testnet -- is_oracle --oracle <ADDRESS>
  ```

### 3c. Error(Contract, #4) — "NotFound"
- **Cause**: NFT ID doesn't have a crop record. Must mint before attesting.
- **Fix**: Create a listing via the Explore page first.

## 4. E2E Test Scenarios

### Scenario A: Mint + Verify + List
```
1. Connect wallet (Freighter/XBull on Testnet)
2. Go to /explore
3. Draw polygon on map
4. Fill listing form (crop type, quantity, price)
5. Click "Run NDVI Verification"
6. If NDVI ≥ 0.35 → listing becomes buyable
7. Submit → NFT minted on-chain
8. Verify listing appears on /marketplace
```

### Scenario B: Buy Flow
```
1. On /marketplace, find a buyable listing
2. Click "Buy Now"
3. Review NDVI AI summary
4. Confirm purchase → wallet signs transaction
5. 20% USDC to farmer, 70% to escrow, 10% to treasury
6. Verify order appears on /order
```

### Scenario C: Attestation Oracle Flow
```
1. Verify ORACLE_SECRET_KEY is set in Vercel
2. POST to /api/verification/run with nftId > 0 and valid bbox
3. Expected: server signs + submits attestation, returns tx hash
4. Check: /api/stellar action=get_crop nftId=<ID> → ndvi_bps updated
```

## 5. Testing API Endpoints (curl)

```bash
# Health
curl https://agri-con-one.vercel.app/api/openeo

# Price
curl https://agri-con-one.vercel.app/api/price

# Stellar read
curl -X POST https://agri-con-one.vercel.app/api/stellar \
  -H 'content-type: application/json' \
  -d '{"action":"get_treasury_pool"}'

# NDVI verification (preview)
curl -X POST https://agri-con-one.vercel.app/api/verification/run \
  -H 'content-type: application/json' \
  -d '{"nftId":0,"bbox":{"west":121.0,"south":15.0,"east":121.1,"north":15.1}}'

# AI NDVI summary
curl -X POST https://agri-con-one.vercel.app/api/ai/ndvi-summary \
  -H 'content-type: application/json' \
  -d '{"ndviBps":4821,"cropType":"rice","region":"Nueva Ecija"}'
```

## 6. CI/CD Pipeline

```bash
# Push triggers CI (typecheck + lint + test)
git push origin main

# Deploy workflow runs automatically
# - Supabase migrations (if SUPABASE_* secrets set)
# - Vercel deploy (if VERCEL_TOKEN/ORG_ID/PROJECT_ID set)
```

### Required GitHub Secrets for auto-deploy:
| Secret | Source |
|---|---|
| `VERCEL_TOKEN` | https://vercel.com/account/tokens |
| `VERCEL_ORG_ID` | `team_eIVMwD3Mb1GLj54SAcSzpagR` |
| `VERCEL_PROJECT_ID` | `prj_aIYnaOiojEg7LoaXXBFn9P95MQSi` |
| `NVIDIA_API_KEY` | Already set |
| `NEXT_PUBLIC_*` | Contract IDs from deploy |

## 7. Monitoring

| Tool | URL |
|---|---|
| Vercel Dashboard | https://vercel.com/rylsherdamzs-projects/agri-con |
| GitHub Actions | https://github.com/rylsherdamz-rgb/agri-con/actions |
| Stellar Testnet Explorer | https://stellar.expert/explorer/testnet |
| Backend Health | https://agri-con-backend.onrender.com/health |

## 8. Common Issues

| Symptom | Likely Cause | Fix |
|---|---|---|
| Build fails "NEXT_PUBLIC_* missing" | Env vars not in CI | Add to GitHub secrets + CI yml |
| 404 on /api routes | Route not deployed | Check Vercel deploy logs |
| "bad union" error | Wallet mismatch for tx source | Use server-side oracle signing |
| Oracle attestation fails #2 | Oracle not registered in contract | Re-run `add_oracle` |
| Wallet won't connect | Wrong network | Switch Freighter to Testnet |
| Map blank | No Maps API key | Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
