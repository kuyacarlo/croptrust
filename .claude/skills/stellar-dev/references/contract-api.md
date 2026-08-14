# AgriConContract — Full API Reference

File: `contracts/agri_con/src/lib.rs`
Contract type: `AgriConContract` (unified — handles NFT, escrow, and verification)

## Constructor

```rust
pub fn __constructor(env: Env, admin: Address, usdc_token: Address, treasury: Address)
```
Initializes instance storage. Idempotent — panics with `AlreadyInitialized` if called twice.

## Read Methods (no auth required)

```rust
pub fn get_admin(env: Env) -> Address
pub fn get_usdc_token(env: Env) -> Address
pub fn get_treasury(env: Env) -> Address
pub fn get_treasury_pool_balance(env: Env) -> i128
pub fn get_crop(env: Env, nft_id: u64) -> CropLot
pub fn get_farmer(env: Env, nft_id: u64) -> Address
pub fn get_price(env: Env, nft_id: u64) -> i128
pub fn owner_of(env: Env, nft_id: u64) -> Address
pub fn get_farmer_profile(env: Env, farmer: Address) -> FarmerProfile
pub fn get_listing_metadata(env: Env, nft_id: u64) -> ListingMetadata
pub fn is_listing_buyable(env: Env, nft_id: u64) -> bool
pub fn get_satellite_attestation(env: Env, nft_id: u64) -> SatelliteAttestation
pub fn get_proof(env: Env, nft_id: u64) -> ProofRecord
pub fn get_decision(env: Env, nft_id: u64) -> VerificationDecision
pub fn get_escrow_position(env: Env, nft_id: u64) -> EscrowPosition
pub fn split_payment(total_price: i128) -> PaymentSplit
pub fn is_oracle(env: Env, oracle: Address) -> bool
```

## Write Methods (auth required)

### Crop NFT
```rust
// Farmer auth
pub fn mint_crop_nft(env, farmer: Address, crop_type: String, quantity: i128, price: i128, harvest_date: u64) -> u64

// Farmer auth, 11 args
pub fn mint_crop_nft_with_listing(env, farmer, crop_type, quantity, price, harvest_date, parcel_name, parcel_bbox_hash, parcel_area_hectares_bps, region, min_ndvi_bps, observation_window_days) -> u64
```

### Farmer Profile
```rust
// Farmer auth
pub fn upsert_farmer_profile(env, farmer: Address, full_name: String, farm_name: String, region: String, government_id_object: String, total_yield_kg: i128)

// Admin auth
pub fn set_farmer_profile_verified(env, farmer: Address, verified: bool)
```

### Listing Metadata
```rust
// Farmer auth, preserves original listed_at on update
pub fn set_listing_metadata(env, farmer, nft_id, parcel_name, parcel_bbox_hash, parcel_area_hectares_bps, region, min_ndvi_bps, observation_window_days)
```

### Purchase
```rust
// Buyer auth. Transfers USDC: 70% escrow, 20% farmer, 10% treasury. Transfers NFT ownership. Panics if not buyable.
pub fn buy_crop_nft(env, buyer: Address, nft_id: u64) -> EscrowPosition
```

### Verification
```rust
// Admin auth
pub fn add_validator(env, validator: Address)
pub fn add_oracle(env, oracle: Address)
pub fn set_listing_buyable(env, nft_id: u64, buyable: bool)
pub fn record_satellite_attestation(env, nft_id, observed_at, ndvi_bps, min_ndvi_bps, buyable, bbox_hash, report_hash, source)

// Oracle auth (must be registered via add_oracle)
pub fn record_sat_attest_oracle(env, oracle, nft_id, observed_at, ndvi_bps, min_ndvi_bps, buyable, bbox_hash, report_hash, source)

// Farmer auth
pub fn submit_proof(env, farmer, nft_id, proof_hash)

// Validator auth. Side effects: releases/refunds escrow, updates crop status, mints disaster NFTs
pub fn verify_delivery(env, validator, nft_id, status: String, notes_hash, refund_amount: i128, treasury_compensation: i128) -> VerificationDecision
```

## Data Types

```rust
struct CropLot { id: u64, crop_type: String, quantity: i128, price: i128, farmer: Address, harvest_date: u64, status: CropStatus }
struct FarmerProfile { farmer: Address, full_name: String, farm_name: String, region: String, government_id_object: String, verified: bool, total_yield_kg: i128, updated_at: u64 }
struct ListingMetadata { nft_id: u64, parcel_name: String, parcel_bbox_hash: String, parcel_area_hectares_bps: u64, region: String, min_ndvi_bps: u64, observation_window_days: u32, listed_at: u64, updated_at: u64 }
struct SatelliteAttestation { nft_id: u64, observed_at: u64, ndvi_bps: u64, min_ndvi_bps: u64, buyable: bool, bbox_hash: String, report_hash: String, source: String }
struct ProofRecord { nft_id: u64, farmer: Address, proof_hash: String }
struct VerificationDecision { nft_id: u64, validator: Address, status: VerificationStatus, notes_hash: String }
struct PaymentSplit { escrow_amount: i128, farmer_upfront: i128, treasury_amount: i128 }
struct EscrowPosition { nft_id: u64, buyer: Address, farmer: Address, total_price: i128, split: PaymentSplit, status: EscrowStatus }
```

## Errors

| Code | Error | Trigger |
|---|---|---|
| 1 | `AlreadyInitialized` | Constructor called twice |
| 2 | `Unauthorized` | Wrong auth, not admin/oracle/validator, not owner |
| 3 | `NotFound` | NFT ID doesn't exist |
| 4 | `InvalidStatus` | Wrong crop status for operation |
| 5 | `ProfileMissing` | Farmer profile not found |
| 6 | `ProofMissing` | No proof submitted before verification |
| 7 | `AttestationMissing` | No satellite attestation recorded |
| 8 | `PositionExists` | Escrow already set for this NFT |
| 9 | `PositionMissing` | Escrow not found for this NFT |
| 10 | `InvalidAmount` | Price ≤ 0, negative refund/compensation, or treasury pool insufficient |

## Events (topic-filtered)

```
agri_con:minted → CropMintedEvent { nft_id }
agri_con:transferred → CropTransferredEvent { nft_id, to }
agri_con:status → CropStatusEvent { nft_id, status }
agri_con:disaster_nft_minted → DisasterNftMintedEvent { source_nft_id, disaster_nft_id, owner }
agri_con:validator_added → ValidatorAddedEvent { validator }
agri_con:oracle_added → OracleAddedEvent { oracle }
agri_con:proof_submitted → ProofSubmittedEvent { nft_id, farmer }
agri_con:decision → DecisionEvent { nft_id, validator, status }
agri_con:escrow_reserved → EscrowReservedEvent { nft_id, buyer, total_price }
agri_con:escrow_released → EscrowReleasedEvent { nft_id, released_amount }
agri_con:escrow_refunded → EscrowRefundedEvent { nft_id, refund_amount, treasury_compensation }
```