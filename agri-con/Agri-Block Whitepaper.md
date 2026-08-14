# CropTrust Whitepaper

**A Satellite-Verified Forward-Contract Marketplace for Agricultural Commodities on Stellar**

Version 1.0 · 2026

---

## Abstract

Agricultural forward contracting is constrained by information asymmetry: buyers commit
capital for crops they cannot independently verify, and farmers wait weeks for payment with
little recourse against default. CropTrust replaces the trust-dependent apparatus of crop
trading with verifiable infrastructure. It combines free Copernicus Sentinel-2 satellite
imagery (processed via openEO to compute NDVI), Stellar/Soroban smart contracts for minting
crop-backed NFTs and programmatic USDC escrow, and an AI layer that translates raw vegetation
indices into plain-language guidance. The result is a permissionless marketplace where crop
health is provable, payment is partially upfront and otherwise escrowed, and delivery outcomes
are settled automatically based on third-party attestations.

---

## 1. Problem

- **Unverifiable crop claims.** Manual NDVI reports cost hundreds of dollars per parcel, take
  days to produce, and can be forged. Buyers have no cheap, trustworthy way to confirm a crop
  exists or is healthy before committing funds.
- **Payment risk asymmetry.** Farmers deliver first and are paid later, often weeks after
  delivery, with no enforcement when buyers default.
- **No audit trail.** Paper contracts leave no immutable record of terms, provenance, or
  outcomes.
- **Exclusion of smallholders.** Smallholder farmers produce the majority of the world's food
  yet are largely shut out of formal commodity markets due to these frictions.

## 2. Approach

Two public technologies make a different design possible:

1. **Copernicus Sentinel-2** images the entire planet every ~5 days at 10 m resolution, free of
   charge. NDVI (Normalized Difference Vegetation Index) derived from the red (B04) and
   near-infrared (B08) bands is a well-established proxy for vegetation health.
2. **Stellar / Soroban** settles transactions in seconds for fractions of a cent and supports
   native USDC, enabling programmatic escrow and fractional payment splits at negligible cost.

CropTrust fuses these into a single workflow: a listing cannot become buyable until a
satellite NDVI check passes, and purchase funds are split and escrowed by contract code rather
than by intermediaries.

---

## 3. System Architecture

```
                       ┌─────────────────────────────────────────────┐
                       │                Frontend (Next.js 16)          │
                       │  marketplace · explore · dashboard · order    │
                       │  profile · aid · mylistings                   │
                       └───────────────┬───────────────┬──────────────┘
                                       │               │
                 Route handlers (app/api/*)            │ Wallet (Stellar Wallets Kit)
                                       │               │
        ┌──────────────┬──────────────┼───────────────┴───────────────┐
        │              │              │                                │
        ▼              ▼              ▼                                ▼
   /api/openeo    /api/verification/run   /api/ai/*              /api/stellar
   (status)       (NDVI → attestation)    (NVIDIA Llama 3.3)     (tx prepare/submit,
        │              │                        │                 live reads)
        ▼              ▼                        ▼                       │
   openEO /         Sentinel-2 via         NVIDIA / Gemini             │
   Sentinel Hub     openEO (B04,B08)       inference                  ▼
                                                            Soroban RPC (testnet/mainnet)
                                                                       │
                                                                       ▼
                                                       ┌───────────────────────────────┐
                                                       │   agri_con Soroban contract    │
                                                       │   crop_nft + escrow + verify   │
                                                       └───────────────────────────────┘

        ┌───────────────────────────────────────────────────────────────────────┐
        │  Backend (Express + Prisma + PostgreSQL 16) — off-chain index/cache     │
        │  farmers · listings · orders · attestations                             │
        └───────────────────────────────────────────────────────────────────────┘
```

### 3.1 Components

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | Next.js 16, React 19, Tailwind v4, GSAP | UI, wallet connection, transaction signing |
| API routes | Next.js route handlers (Node runtime) | Tx preparation, satellite orchestration, AI, GCS upload URLs |
| Smart contracts | Soroban SDK 25.0.1 (Rust) | Crop NFT minting, escrow split, attestations, settlement |
| Backend | Express 4, Prisma 6, PostgreSQL 16 | Off-chain index of farmers, listings, orders, attestations |
| Satellite | Copernicus Sentinel-2 via openEO | NDVI computation over parcel bounding boxes |
| AI | NVIDIA Llama 3.3 70B (Gemini fallback) | NDVI summaries and harvest recommendations |
| Storage | Google Cloud Storage | Farmer ID document uploads (v4 signed URLs) |

---

## 4. On-Chain Design

The protocol is implemented as a single merged Soroban contract (`agri_con`) that unifies three
concerns previously prototyped as separate contracts:

- **crop_nft** — mints and tracks crop-backed NFT listings, holding crop metadata (type,
  quantity, price, harvest date, parcel, region) and listing buyability.
- **escrow** — records USDC reservation state and executes the payment split, pulling crop price
  and farmer data from the NFT records.
- **verification** — stores satellite proof anchors and validator decisions, and drives escrow
  settlement on success or failure.

### 4.1 Payment split (70 / 20 / 10)

When a buyer purchases a listing with USDC, funds are split programmatically:

| Share | Recipient | Released |
|---|---|---|
| 20% | Farmer (upfront) | Immediately on purchase |
| 70% | Escrow | On verified delivery |
| 10% | Farmer aid pool (treasury) | Held by treasury for disaster compensation |

Settlement is driven by validator attestations of the delivery outcome — `Delivered`,
`Disaster`, or `Fraud` — with escrow releasing or refunding accordingly. Treasury compensation
for disaster claims is currently recorded in settlement state; automated payout is a planned
addition (see §8).

### 4.2 Satellite gating

A listing is not buyable until an NDVI attestation is recorded on-chain with
`ndvi_bps >= min_ndvi_bps`. NDVI is expressed in basis points (0–10000, where 10000 = NDVI 1.0).
The attestation anchors a `bboxHash` and a `reportHash` (SHA-256 over the verification inputs and
results), making each check timestamped and tamper-evident.

---

## 5. Satellite Verification Pipeline

The `/api/verification/run` route implements the on-demand NDVI workflow:

1. **Discover the openEO API base** from the Sentinel Hub backend's `/.well-known/openeo`.
2. **Authenticate** via OIDC client-credentials to obtain an access token.
3. **Submit a process graph** that loads Sentinel-2 L2A bands B04 and B08 over the parcel
   bounding box for a temporal window (default: last 30 days), computes NDVI, and saves a GeoTIFF.
4. **Decode the GeoTIFF** (via `sharp`, raw float) and compute the mean NDVI across valid pixels
   in [-1, 1].
5. **Convert to basis points**, compare against `minNdviBps`, and compute `buyable`.
6. **Anchor proof** by hashing the bbox and the full report, then prepare an on-chain
   `record_satellite_attestation_by_oracle` transaction (skipped in preview mode, `nftId === 0`).

This produces a verifiable, low-cost crop-health proof without manual inspection.

---

## 6. Off-Chain Data Model

The backend indexes on-chain and operational state in PostgreSQL via Prisma:

- **Farmer** — `id` (Stellar address), name, farm, region, total yield, ID doc path, verified flag.
- **Listing** — `nftId` (unique), crop type, quantity, price, parcel, region, `buyable`,
  `ndviBps`, `minNdviBps`, area, status; belongs to a Farmer.
- **Order** — listing reference, buyer address, amount, tx hash, status (`escrow` by default).
- **Attestation** — `nftId` + `observedAt` (unique pair), NDVI values, buyability, `bboxHash`,
  `reportHash`, source.

The chain is the source of truth; the database is a query/index layer for fast marketplace reads.

---

## 7. API Surface

### Frontend route handlers (`app/api`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/price` | GET | XLM/USD price (CoinGecko, 5-min cache, fallback) |
| `/api/openeo` | GET | openEO connectivity/auth status |
| `/api/verification/run` | POST | Run NDVI check, anchor attestation |
| `/api/ai/ndvi-summary` | POST | AI NDVI summary + recommendation |
| `/api/ai/chat` | POST | AgriAI assistant chat |
| `/api/farmer-id/upload-url` | POST | GCS v4 signed upload URL |
| `/api/stellar` | POST | Action-routed tx prepare/submit + live reads |

The `/api/stellar` endpoint is action-routed; `action` selects among `prepare_mint_crop_nft`,
`prepare_buy_crop_nft`, `prepare_upsert_farmer_profile`, `prepare_verify_delivery`,
`submit_signed_xdr`, `get_all_listings`, `get_farmer_profile`, `get_treasury_pool`, and others.

### Backend (Express)

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | Liveness probe |
| `/api/profile` | GET/POST | Read/upsert farmer profiles |
| `/api/listings` | GET/POST | Read/upsert listings (filterable) |
| `/api/orders` | GET/POST | Read/create orders |
| `/api/attestations` | POST | Record an attestation |
| `/ai/ndvi-summary` | POST | NDVI summary (server-side variant) |
| `/farmer-id/upload-url` | POST | GCS signed upload URL |

A full executable specification of these endpoints is published as a Postman collection in
`/postman` (see §9).

---

## 8. Security & Trust Model

- **Provable crop health.** NDVI is derived from public Sentinel-2 data and anchored on-chain
  via report hashes, so health claims are independently auditable.
- **Code-enforced escrow.** Payment splits and settlement are executed by contract logic, not by
  a custodial intermediary.
- **Oracle attestations.** Satellite attestations are submitted by a designated oracle/treasury
  address; productionizing this toward a decentralized oracle set is future work.
- **Least-privilege configuration.** Read-only contract simulation uses a funded probe address;
  write paths require signed transactions from the relevant party.
- **Secret hygiene.** API keys (NVIDIA, GCP, openEO) are environment-injected and must never be
  committed. `.env.example` carries placeholders only.

> Note: the protocol is deployed on Stellar testnet and mainnet for demonstration. Contracts
> currently lack a full unit/integration test suite, and disaster-compensation payout is recorded
> but not yet auto-disbursed. These are tracked below.

---

## 9. Testing & Verification

- **Contracts:** `cargo fmt`, `cargo clippy -D warnings`, `cargo test`, and a release wasm build
  run in CI (see `.github/workflows/ci.yml` and `.harness/agri_con_ci.yaml`).
- **Backend:** Prisma schema validation, client generation, and a server syntax check in CI.
- **Frontend:** lint, type-check, and production build in CI.
- **End-to-end API:** a Postman collection (`/postman/agri-con.postman_collection.json`) plus an
  environment file exercises the frontend and backend endpoints, with test scripts asserting
  status codes and response shapes.

---

## 10. Roadmap

**Near-term (6–12 months):** mobile-first PWA for low-bandwidth devices; i18n (Swahili, Hindi,
Spanish, French, Bahasa Indonesia); additional satellite indices (EVI, NDWI, soil moisture);
batch verification; commodity price oracles.

**Medium-term (1–2 years):** crop-backed lending against verified standing crops; carbon-credit
tokenization; post-farm-gate supply-chain custody tracking; parametric crop insurance triggered
by satellite thresholds; DAO governance of protocol parameters.

**Protocol hardening:** automated treasury payout for disaster claims; a dedicated disaster/claims
contract; comprehensive unit and integration tests for split rules, authorization chains, and
disaster settlement; decentralized oracle attestation.

**Long-term research (2+ years):** multi-chain expansion; IoT sensor fusion; AI yield prediction;
self-sovereign farmer identity (W3C DID/VC); an open regional climate-resilience index.

---

## 11. References

- Copernicus Sentinel-2 mission and open data policy — European Space Agency / Copernicus.
- openEO API specification — openeo.org.
- Stellar / Soroban smart contract platform — stellar.org.
- NDVI (Normalized Difference Vegetation Index) — Rouse et al., established remote-sensing index.

---

*This document describes the CropTrust protocol as implemented in this repository. It is a
technical overview, not investment advice or a securities offering.*
