# CropTrust Environment Variables — Complete Reference

## Stellar Blockchain (9 vars)

| Variable | Required | Default | Where Used |
|---|---|---|---|
| `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE` | No | `Test SDF Network ; September 2015` | `config.ts`, all tx building |
| `NEXT_PUBLIC_STELLAR_RPC_URL` | No | `https://soroban-testnet.stellar.org` | `config.ts`, all RPC calls |
| `NEXT_PUBLIC_STELLAR_HORIZON_URL` | No | `https://horizon-testnet.stellar.org` | `config.ts`, Horizon queries |
| `NEXT_PUBLIC_AGRI_CON_CONTRACT_ID` | **YES** | — | All contract operations |
| `NEXT_PUBLIC_CROP_NFT_CONTRACT_ID` | No | Falls back to AGRI_CON | Legacy NFT contract |
| `NEXT_PUBLIC_ESCROW_CONTRACT_ID` | No | Falls back to AGRI_CON | Legacy escrow contract |
| `NEXT_PUBLIC_VERIFICATION_CONTRACT_ID` | No | Falls back to AGRI_CON | Legacy verification contract |
| `ORACLE_ADDRESS` | **YES** | Falls back to TREASURY | Probe for `simulateTransaction` reads |
| `TREASURY_ADDRESS` | **YES** | — | Admin/treasury for attestation + reads |

**Critical:** Without `ORACLE_ADDRESS` or `TREASURY_ADDRESS`, all read-only contract queries fail because `simulateTransaction` needs a funded source account. The marketplace, farmer profiles, and attestation data will all return empty/null.

## NFT Data (4 vars)

| Variable | Purpose |
|---|---|
| `ACTIVE_NFT_IDS` / `NEXT_PUBLIC_ACTIVE_NFT_IDS` | Comma-separated NFT IDs to poll (e.g. `1,2,3,5,7`) |
| `NFT_MAX_ID` / `NEXT_PUBLIC_NFT_MAX_ID` | If ACTIVE_NFT_IDS not set, polls NFTs 1..MAX (default 20) |
| `FARMER_ADDRESSES` / `NEXT_PUBLIC_FARMER_ADDRESSES` | Comma-separated Stellar addresses for farmer profile reads |

## AI (3 vars)

| Variable | Required | Default | Note |
|---|---|---|---|
| `NVIDIA_API_KEY` | No | — | For NDVI summaries + AgriAI chat. Falls back to static text if missing |
| `AI_MODEL` | No | `meta/llama-3.3-70b-instruct` | Any NVIDIA NIM model |
| `GEMINI_API_KEY` | No | — | **Backend only.** Fallback when NVIDIA returns 429 |

## Google Maps (2 vars)

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | **YES** | Parcel explorer map rendering |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | No | Custom map style ID |

## Google Cloud Storage (2 vars)

| Variable | Required | Purpose |
|---|---|---|
| `GCP_FARMER_ID_BUCKET` | **YES** | GCS bucket for farmer ID document uploads |
| `GCP_SERVICE_ACCOUNT_JSON` | No | Full service account JSON (if not using default credentials) |

## openEO / Sentinel Hub (3 vars)

| Variable | Required | Default | Note |
|---|---|---|---|
| `OPENEO_BASE_URL` | No | `https://openeo.dataspace.copernicus.eu` | openEO API discovery |
| `OPENEO_SH_BASE_URL` | No | `https://openeosh.dataspace.copernicus.eu` | Sentinel Hub openEO endpoint |
| `OPENEO_CLIENT_ID` | No | — | OIDC client for authenticated access |
| `OPENEO_CLIENT_SECRET` | No | — | OIDC secret. Without this pair, anonymous access has lower rate limits |

## Backend (3 vars)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | No | `http://localhost:8080` | Express API URL for DB-backed operations |
| `PORT` | No | `8080` | Backend server port |
| `DATABASE_URL` | **YES** | — | PostgreSQL connection for Prisma (e.g. `postgresql://user:pass@host:5432/croptrust`) |

## Testnet Contract Deployments

| Contract | Address |
|---|---|
| AgriCon (unified) | `CCIEMYEGIMMPFNV6LCQIG2S7OGEW3H7355PBCRVNUQ2VL43AHDZWUVUG` |
| Crop NFT (legacy) | `CCA2E4OOZOR2NLAL2XEWE3KDHTTPDEBWOUX3BMR5QLOITWHOKWKULULR` |
| Escrow (legacy) | `CDMKYC3VBHZJZMTEN6FQPFKG6LRYXIYOIP5KHEOPGSWCCYRSYXJSZFOQ` |
| Verification (legacy) | `CA3NIAKLHQN3SKNBUGSWLOZRWY4BNNSKWCPI2BJIHZGYZM4J3QLW4GSA` |

USDC Testnet Token: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`