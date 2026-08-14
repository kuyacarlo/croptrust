#![no_std]
#![allow(clippy::too_many_arguments)]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, token,
    Address, Env, MuxedAddress, String,
};

// ── Shared enums ──────────────────────────────────────────────────────────

#[derive(Clone, PartialEq, Debug)]
#[contracttype]
pub enum CropStatus {
    Available,
    Reserved,
    Growing,
    Verified,
    Completed,
    Failed,
}

#[derive(Clone, PartialEq, Debug)]
#[contracttype]
pub enum EscrowStatus {
    Reserved,
    Released,
    Refunded,
}

#[derive(Clone, PartialEq, Debug)]
#[contracttype]
pub enum VerificationStatus {
    Pending,
    Delivered,
    Disaster,
    Fraud,
}

// ── Structs ───────────────────────────────────────────────────────────────

#[derive(Clone)]
#[contracttype]
pub struct CropLot {
    pub id: u64,
    pub crop_type: String,
    pub quantity: i128,
    pub price: i128,
    pub farmer: Address,
    pub harvest_date: u64,
    pub status: CropStatus,
}

#[derive(Clone)]
#[contracttype]
pub struct FarmerProfile {
    pub farmer: Address,
    pub full_name: String,
    pub farm_name: String,
    pub region: String,
    pub verified: bool,
    pub total_yield_kg: i128,
    pub updated_at: u64,
}

#[derive(Clone)]
#[contracttype]
pub struct ListingMetadata {
    pub nft_id: u64,
    pub parcel_name: String,
    pub parcel_bbox_hash: String,
    pub parcel_area_hectares_bps: u64,
    pub region: String,
    pub min_ndvi_bps: u64,
    pub observation_window_days: u32,
    pub listed_at: u64,
    pub updated_at: u64,
}

#[derive(Clone)]
#[contracttype]
pub struct SatelliteAttestation {
    pub nft_id: u64,
    pub observed_at: u64,
    pub ndvi_bps: u64,
    pub min_ndvi_bps: u64,
    pub buyable: bool,
    pub bbox_hash: String,
    pub report_hash: String,
    pub source: String,
}

#[derive(Clone)]
#[contracttype]
pub struct ProofRecord {
    pub nft_id: u64,
    pub farmer: Address,
    pub proof_hash: String,
}

#[derive(Clone)]
#[contracttype]
pub struct VerificationDecision {
    pub nft_id: u64,
    pub validator: Address,
    pub status: VerificationStatus,
    pub notes_hash: String,
}

#[derive(Clone)]
#[contracttype]
pub struct PaymentSplit {
    pub escrow_amount: i128,
    pub farmer_upfront: i128,
    pub treasury_amount: i128,
}

#[derive(Clone)]
#[contracttype]
pub struct EscrowPosition {
    pub nft_id: u64,
    pub buyer: Address,
    pub farmer: Address,
    pub total_price: i128,
    pub split: PaymentSplit,
    pub status: EscrowStatus,
}

// ── Storage keys ──────────────────────────────────────────────────────────

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    UsdcToken,
    Treasury,
    TreasuryPoolBalance,
    NextId,
    Crop(u64),
    Owner(u64),
    Profile(Address),
    Listing(u64),
    Validator(Address),
    Oracle(Address),
    Proof(u64),
    Decision(u64),
    Buyable(u64),
    Attestation(u64),
    EscrowPosition(u64),
}

// ── Errors ────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Clone, Copy, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum AgriConError {
    AlreadyInitialized = 1,
    Unauthorized = 2,
    NotFound = 3,
    InvalidStatus = 4,
    ProfileMissing = 5,
    ProofMissing = 6,
    AttestationMissing = 7,
    PositionExists = 8,
    PositionMissing = 9,
    InvalidAmount = 10,
}

// ── Events ────────────────────────────────────────────────────────────────

#[contractevent(topics = ["agri_con", "minted"])]
#[derive(Clone)]
pub struct CropMintedEvent {
    #[topic]
    pub nft_id: u64,
}

#[contractevent(topics = ["agri_con", "transferred"])]
#[derive(Clone)]
pub struct CropTransferredEvent {
    #[topic]
    pub nft_id: u64,
    #[topic]
    pub to: Address,
}

#[contractevent(topics = ["agri_con", "status"])]
#[derive(Clone)]
pub struct CropStatusEvent {
    #[topic]
    pub nft_id: u64,
    pub status: CropStatus,
}

#[contractevent(topics = ["agri_con", "disaster_nft_minted"])]
#[derive(Clone)]
pub struct DisasterNftMintedEvent {
    #[topic]
    pub source_nft_id: u64,
    #[topic]
    pub disaster_nft_id: u64,
    #[topic]
    pub owner: Address,
}

#[contractevent(topics = ["agri_con", "validator_added"])]
#[derive(Clone)]
pub struct ValidatorAddedEvent {
    #[topic]
    pub validator: Address,
}

#[contractevent(topics = ["agri_con", "oracle_added"])]
#[derive(Clone)]
pub struct OracleAddedEvent {
    #[topic]
    pub oracle: Address,
}

#[contractevent(topics = ["agri_con", "oracle_removed"])]
#[derive(Clone)]
pub struct OracleRemovedEvent {
    #[topic]
    pub oracle: Address,
}

#[contractevent(topics = ["agri_con", "attested"])]
#[derive(Clone)]
pub struct AttestationRecordedEvent {
    #[topic]
    pub nft_id: u64,
    #[topic]
    pub attestor: Address,
    pub ndvi_bps: u64,
    pub buyable: bool,
}

#[contractevent(topics = ["agri_con", "proof_submitted"])]
#[derive(Clone)]
pub struct ProofSubmittedEvent {
    #[topic]
    pub nft_id: u64,
    #[topic]
    pub farmer: Address,
}

#[contractevent(topics = ["agri_con", "decision"])]
#[derive(Clone)]
pub struct DecisionEvent {
    #[topic]
    pub nft_id: u64,
    #[topic]
    pub validator: Address,
    pub status: VerificationStatus,
}

#[contractevent(topics = ["agri_con", "escrow_reserved"])]
#[derive(Clone)]
pub struct EscrowReservedEvent {
    #[topic]
    pub nft_id: u64,
    #[topic]
    pub buyer: Address,
    pub total_price: i128,
}

#[contractevent(topics = ["agri_con", "escrow_released"])]
#[derive(Clone)]
pub struct EscrowReleasedEvent {
    #[topic]
    pub nft_id: u64,
    pub released_amount: i128,
}

#[contractevent(topics = ["agri_con", "escrow_refunded"])]
#[derive(Clone)]
pub struct EscrowRefundedEvent {
    #[topic]
    pub nft_id: u64,
    pub refund_amount: i128,
    pub treasury_compensation: i128,
}

// ── Contract ──────────────────────────────────────────────────────────────

#[contract]
pub struct AgriConContract;

fn usdc_token(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::UsdcToken)
        .unwrap_or_else(|| panic_with_error!(env, AgriConError::Unauthorized))
}

fn treasury(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::Treasury)
        .unwrap_or_else(|| panic_with_error!(env, AgriConError::Unauthorized))
}

fn require_admin(env: &Env) {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .unwrap_or_else(|| panic_with_error!(env, AgriConError::Unauthorized));
    admin.require_auth();
}

/// Authorize an attestation: caller must be an allowlisted oracle/AI-agent
/// wallet AND must sign the call. This lets an autonomous agent attest from
/// its own funded wallet without holding the deployer-admin key.
fn require_oracle(env: &Env, oracle: &Address) {
    let registered: bool = env
        .storage()
        .persistent()
        .get(&DataKey::Oracle(oracle.clone()))
        .unwrap_or(false);
    if !registered {
        panic_with_error!(env, AgriConError::Unauthorized);
    }
    oracle.require_auth();
}

/// Shared attestation write used by both the admin and oracle entrypoints.
fn write_attestation(
    env: &Env,
    nft_id: u64,
    observed_at: u64,
    ndvi_bps: u64,
    min_ndvi_bps: u64,
    bbox_hash: String,
    report_hash: String,
    source: String,
) -> bool {
    let buyable = ndvi_bps >= min_ndvi_bps;
    let attestation = SatelliteAttestation {
        nft_id,
        observed_at,
        ndvi_bps,
        min_ndvi_bps,
        buyable,
        bbox_hash,
        report_hash,
        source,
    };

    env.storage()
        .persistent()
        .set(&DataKey::Attestation(nft_id), &attestation);
    env.storage()
        .persistent()
        .set(&DataKey::Buyable(nft_id), &buyable);

    buyable
}

fn parse_status(env: &Env, status: &String) -> VerificationStatus {
    if *status == String::from_str(env, "Delivered") {
        VerificationStatus::Delivered
    } else if *status == String::from_str(env, "Disaster") {
        VerificationStatus::Disaster
    } else if *status == String::from_str(env, "Fraud") {
        VerificationStatus::Fraud
    } else if *status == String::from_str(env, "Pending") {
        VerificationStatus::Pending
    } else {
        panic_with_error!(env, AgriConError::InvalidStatus);
    }
}

#[contractimpl]
impl AgriConContract {
    // ── Constructor ──────────────────────────────────────────────────

    pub fn __constructor(env: Env, admin: Address, usdc_token: Address, treasury: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, AgriConError::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::UsdcToken, &usdc_token);
        env.storage().instance().set(&DataKey::Treasury, &treasury);
        env.storage()
            .instance()
            .set(&DataKey::TreasuryPoolBalance, &0i128);
        env.storage().instance().set(&DataKey::NextId, &1u64);
    }

    // ── Accessors ────────────────────────────────────────────────────

    pub fn get_admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, AgriConError::Unauthorized))
    }

    pub fn get_usdc_token(env: Env) -> Address {
        usdc_token(&env)
    }

    pub fn get_treasury(env: Env) -> Address {
        treasury(&env)
    }

    pub fn get_treasury_pool_balance(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TreasuryPoolBalance)
            .unwrap_or(0i128)
    }

    pub fn get_next_nft_id(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::NextId)
            .unwrap_or(1u64)
    }

    // ══════════════════════════════════════════════════════════════════
    // CROP NFT FUNCTIONS
    // ══════════════════════════════════════════════════════════════════

    pub fn mint_crop_nft(
        env: Env,
        farmer: Address,
        crop_type: String,
        quantity: i128,
        price: i128,
        harvest_date: u64,
    ) -> u64 {
        farmer.require_auth();

        let next_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextId)
            .unwrap_or(1u64);

        let crop = CropLot {
            id: next_id,
            crop_type,
            quantity,
            price,
            farmer: farmer.clone(),
            harvest_date,
            status: CropStatus::Available,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Crop(next_id), &crop);
        env.storage()
            .persistent()
            .set(&DataKey::Owner(next_id), &farmer);
        env.storage()
            .instance()
            .set(&DataKey::NextId, &(next_id + 1));

        CropMintedEvent { nft_id: next_id }.publish(&env);
        next_id
    }

    #[allow(clippy::too_many_arguments)]
    pub fn mint_crop_nft_with_listing(
        env: Env,
        farmer: Address,
        crop_type: String,
        quantity: i128,
        price: i128,
        harvest_date: u64,
        parcel_name: String,
        parcel_bbox_hash: String,
        parcel_area_hectares_bps: u64,
        region: String,
        min_ndvi_bps: u64,
        observation_window_days: u32,
    ) -> u64 {
        let next_id = Self::mint_crop_nft(
            env.clone(),
            farmer.clone(),
            crop_type,
            quantity,
            price,
            harvest_date,
        );

        Self::write_listing_metadata(
            &env,
            next_id,
            parcel_name,
            parcel_bbox_hash,
            parcel_area_hectares_bps,
            region,
            min_ndvi_bps,
            observation_window_days,
            None,
        );

        next_id
    }

    pub fn get_crop(env: Env, nft_id: u64) -> CropLot {
        env.storage()
            .persistent()
            .get(&DataKey::Crop(nft_id))
            .unwrap_or_else(|| panic_with_error!(&env, AgriConError::NotFound))
    }

    pub fn get_farmer(env: Env, nft_id: u64) -> Address {
        let crop = Self::get_crop(env, nft_id);
        crop.farmer
    }

    pub fn get_price(env: Env, nft_id: u64) -> i128 {
        let crop = Self::get_crop(env, nft_id);
        crop.price
    }

    pub fn owner_of(env: Env, nft_id: u64) -> Address {
        env.storage()
            .persistent()
            .get(&DataKey::Owner(nft_id))
            .unwrap_or_else(|| panic_with_error!(&env, AgriConError::NotFound))
    }

    // ══════════════════════════════════════════════════════════════════
    // FARMER PROFILE
    // ══════════════════════════════════════════════════════════════════

    #[allow(clippy::too_many_arguments)]
    pub fn upsert_farmer_profile(
        env: Env,
        farmer: Address,
        full_name: String,
        farm_name: String,
        region: String,
        total_yield_kg: i128,
    ) {
        farmer.require_auth();
        if total_yield_kg < 0 {
            panic_with_error!(&env, AgriConError::InvalidStatus);
        }

        let existing = env
            .storage()
            .persistent()
            .get::<_, FarmerProfile>(&DataKey::Profile(farmer.clone()));
        let verified = existing.map(|profile| profile.verified).unwrap_or(false);

        let profile = FarmerProfile {
            farmer: farmer.clone(),
            full_name,
            farm_name,
            region,
            verified,
            total_yield_kg,
            updated_at: env.ledger().timestamp(),
        };

        env.storage()
            .persistent()
            .set(&DataKey::Profile(farmer), &profile);
    }

    pub fn set_farmer_profile_verified(env: Env, farmer: Address, verified: bool) {
        require_admin(&env);

        let mut profile: FarmerProfile = env
            .storage()
            .persistent()
            .get(&DataKey::Profile(farmer.clone()))
            .unwrap_or_else(|| panic_with_error!(&env, AgriConError::ProfileMissing));
        profile.verified = verified;
        profile.updated_at = env.ledger().timestamp();

        env.storage()
            .persistent()
            .set(&DataKey::Profile(farmer), &profile);
    }

    pub fn get_farmer_profile(env: Env, farmer: Address) -> FarmerProfile {
        env.storage()
            .persistent()
            .get(&DataKey::Profile(farmer))
            .unwrap_or_else(|| panic_with_error!(&env, AgriConError::ProfileMissing))
    }

    // ══════════════════════════════════════════════════════════════════
    // LISTING METADATA
    // ══════════════════════════════════════════════════════════════════

    #[allow(clippy::too_many_arguments)]
    pub fn set_listing_metadata(
        env: Env,
        farmer: Address,
        nft_id: u64,
        parcel_name: String,
        parcel_bbox_hash: String,
        parcel_area_hectares_bps: u64,
        region: String,
        min_ndvi_bps: u64,
        observation_window_days: u32,
    ) {
        farmer.require_auth();

        let crop = Self::get_crop(env.clone(), nft_id);
        if crop.farmer != farmer {
            panic_with_error!(&env, AgriConError::Unauthorized);
        }

        let existing = env
            .storage()
            .persistent()
            .get::<_, ListingMetadata>(&DataKey::Listing(nft_id));

        Self::write_listing_metadata(
            &env,
            nft_id,
            parcel_name,
            parcel_bbox_hash,
            parcel_area_hectares_bps,
            region,
            min_ndvi_bps,
            observation_window_days,
            existing.map(|item| item.listed_at),
        );
    }

    pub fn get_listing_metadata(env: Env, nft_id: u64) -> ListingMetadata {
        env.storage()
            .persistent()
            .get(&DataKey::Listing(nft_id))
            .unwrap_or_else(|| panic_with_error!(&env, AgriConError::NotFound))
    }

    // ══════════════════════════════════════════════════════════════════
    // VERIFICATION: validators, oracles, attestations
    // ══════════════════════════════════════════════════════════════════

    pub fn add_validator(env: Env, validator: Address) {
        require_admin(&env);
        env.storage()
            .persistent()
            .set(&DataKey::Validator(validator.clone()), &true);
        ValidatorAddedEvent { validator }.publish(&env);
    }

    /// Register an oracle / AI-agent wallet that is allowed to record
    /// attestations via `record_sat_attest_oracle`. Admin-only.
    pub fn add_oracle(env: Env, oracle: Address) {
        require_admin(&env);
        env.storage()
            .persistent()
            .set(&DataKey::Oracle(oracle.clone()), &true);
        OracleAddedEvent { oracle }.publish(&env);
    }

    /// Revoke an oracle / AI-agent wallet. Admin-only.
    pub fn remove_oracle(env: Env, oracle: Address) {
        require_admin(&env);
        env.storage()
            .persistent()
            .set(&DataKey::Oracle(oracle.clone()), &false);
        OracleRemovedEvent { oracle }.publish(&env);
    }

    pub fn is_oracle(env: Env, oracle: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Oracle(oracle))
            .unwrap_or(false)
    }

    pub fn set_listing_buyable(env: Env, nft_id: u64, buyable: bool) {
        require_admin(&env);
        env.storage()
            .persistent()
            .set(&DataKey::Buyable(nft_id), &buyable);
    }

    /// Record an NDVI attestation, authorized by the contract admin.
    pub fn record_satellite_attestation(
        env: Env,
        nft_id: u64,
        observed_at: u64,
        ndvi_bps: u64,
        min_ndvi_bps: u64,
        bbox_hash: String,
        report_hash: String,
        source: String,
    ) {
        require_admin(&env);

        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, AgriConError::Unauthorized));

        let buyable = write_attestation(
            &env,
            nft_id,
            observed_at,
            ndvi_bps,
            min_ndvi_bps,
            bbox_hash,
            report_hash,
            source,
        );

        AttestationRecordedEvent {
            nft_id,
            attestor: admin,
            ndvi_bps,
            buyable,
        }
        .publish(&env);
    }

    /// Record an NDVI attestation, authorized by an allowlisted oracle /
    /// AI-agent wallet. This is the agentic-payments path: the AI agent pays
    /// the off-chain x402 micro-payment and signs this call from its own
    /// funded wallet, without needing the deployer-admin key.
    pub fn record_sat_attest_oracle(
        env: Env,
        oracle: Address,
        nft_id: u64,
        observed_at: u64,
        ndvi_bps: u64,
        min_ndvi_bps: u64,
        bbox_hash: String,
        report_hash: String,
        source: String,
    ) {
        require_oracle(&env, &oracle);

        let buyable = write_attestation(
            &env,
            nft_id,
            observed_at,
            ndvi_bps,
            min_ndvi_bps,
            bbox_hash,
            report_hash,
            source,
        );

        AttestationRecordedEvent {
            nft_id,
            attestor: oracle,
            ndvi_bps,
            buyable,
        }
        .publish(&env);
    }

    pub fn is_listing_buyable(env: Env, nft_id: u64) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Buyable(nft_id))
            .unwrap_or(false)
    }

    pub fn get_satellite_attestation(env: Env, nft_id: u64) -> SatelliteAttestation {
        env.storage()
            .persistent()
            .get(&DataKey::Attestation(nft_id))
            .unwrap_or_else(|| panic_with_error!(&env, AgriConError::AttestationMissing))
    }

    // ══════════════════════════════════════════════════════════════════
    // VERIFICATION: proof + delivery verification
    // ══════════════════════════════════════════════════════════════════

    pub fn submit_proof(env: Env, farmer: Address, nft_id: u64, proof_hash: String) {
        farmer.require_auth();

        let proof = ProofRecord {
            nft_id,
            farmer: farmer.clone(),
            proof_hash,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Proof(nft_id), &proof);
        ProofSubmittedEvent { nft_id, farmer }.publish(&env);
    }

    pub fn get_proof(env: Env, nft_id: u64) -> ProofRecord {
        env.storage()
            .persistent()
            .get(&DataKey::Proof(nft_id))
            .unwrap_or_else(|| panic_with_error!(&env, AgriConError::ProofMissing))
    }

    pub fn get_decision(env: Env, nft_id: u64) -> VerificationDecision {
        env.storage()
            .persistent()
            .get(&DataKey::Decision(nft_id))
            .unwrap_or_else(|| panic_with_error!(&env, AgriConError::ProofMissing))
    }

    pub fn verify_delivery(
        env: Env,
        validator: Address,
        nft_id: u64,
        status: String,
        notes_hash: String,
        refund_amount: i128,
        treasury_compensation: i128,
    ) -> VerificationDecision {
        validator.require_auth();

        let is_allowed: bool = env
            .storage()
            .persistent()
            .get(&DataKey::Validator(validator.clone()))
            .unwrap_or(false);
        if !is_allowed {
            panic_with_error!(&env, AgriConError::Unauthorized);
        }

        if !env.storage().persistent().has(&DataKey::Proof(nft_id)) {
            panic_with_error!(&env, AgriConError::ProofMissing);
        }

        let parsed_status = parse_status(&env, &status);

        match parsed_status {
            VerificationStatus::Delivered => {
                env.storage()
                    .persistent()
                    .set(&DataKey::Buyable(nft_id), &false);

                Self::release_escrow_internal(&env, nft_id);

                {
                    let crop_key = DataKey::Crop(nft_id);
                    let mut crop: CropLot = env
                        .storage()
                        .persistent()
                        .get(&crop_key)
                        .unwrap_or_else(|| panic_with_error!(&env, AgriConError::NotFound));
                    crop.status = CropStatus::Completed;
                    env.storage().persistent().set(&crop_key, &crop);
                    CropStatusEvent {
                        nft_id,
                        status: CropStatus::Completed,
                    }
                    .publish(&env);
                }
            }
            VerificationStatus::Disaster | VerificationStatus::Fraud => {
                env.storage()
                    .persistent()
                    .set(&DataKey::Buyable(nft_id), &false);

                Self::refund_after_disaster_internal(
                    &env,
                    nft_id,
                    refund_amount,
                    treasury_compensation,
                );

                {
                    let crop_key = DataKey::Crop(nft_id);
                    let mut crop: CropLot = env
                        .storage()
                        .persistent()
                        .get(&crop_key)
                        .unwrap_or_else(|| panic_with_error!(&env, AgriConError::NotFound));
                    crop.status = CropStatus::Failed;
                    env.storage().persistent().set(&crop_key, &crop);
                    CropStatusEvent {
                        nft_id,
                        status: CropStatus::Failed,
                    }
                    .publish(&env);
                }

                Self::mint_disaster_nft_internal(&env, nft_id, validator.clone());
            }
            VerificationStatus::Pending => {}
        }

        let decision = VerificationDecision {
            nft_id,
            validator: validator.clone(),
            status: parsed_status.clone(),
            notes_hash,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Decision(nft_id), &decision);
        DecisionEvent {
            nft_id,
            validator,
            status: parsed_status,
        }
        .publish(&env);

        decision
    }

    // ══════════════════════════════════════════════════════════════════
    // ESCROW
    // ══════════════════════════════════════════════════════════════════

    pub fn buy_crop_nft(env: Env, buyer: Address, nft_id: u64) -> EscrowPosition {
        buyer.require_auth();

        let crop = Self::get_crop(env.clone(), nft_id);
        let farmer = crop.farmer;
        let total_price = crop.price;

        let buyable = Self::is_listing_buyable(env.clone(), nft_id);
        if !buyable {
            panic_with_error!(&env, AgriConError::Unauthorized);
        }

        if total_price <= 0 {
            panic_with_error!(&env, AgriConError::InvalidAmount);
        }

        let escrow_key = DataKey::EscrowPosition(nft_id);
        if env.storage().persistent().has(&escrow_key) {
            panic_with_error!(&env, AgriConError::PositionExists);
        }

        let split = Self::split_payment(total_price);
        let token_client = token::TokenClient::new(&env, &usdc_token(&env));
        let current_contract = env.current_contract_address();
        let contract_destination = MuxedAddress::from(current_contract.clone());

        token_client.transfer(&buyer, &contract_destination, &total_price);

        // 20% upfront to farmer
        let farmer_destination = MuxedAddress::from(farmer.clone());
        token_client.transfer(
            &current_contract,
            &farmer_destination,
            &split.farmer_upfront,
        );

        // 10% to treasury pool
        let pool_before: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TreasuryPoolBalance)
            .unwrap_or(0i128);
        env.storage().instance().set(
            &DataKey::TreasuryPoolBalance,
            &(pool_before + split.treasury_amount),
        );

        // Transfer NFT ownership
        {
            let owner_key = DataKey::Owner(nft_id);
            let current_owner: Address = env
                .storage()
                .persistent()
                .get(&owner_key)
                .unwrap_or_else(|| panic_with_error!(&env, AgriConError::NotFound));

            if current_owner != farmer {
                panic_with_error!(&env, AgriConError::InvalidStatus);
            }

            let crop_key = DataKey::Crop(nft_id);
            let mut crop: CropLot = env
                .storage()
                .persistent()
                .get(&crop_key)
                .unwrap_or_else(|| panic_with_error!(&env, AgriConError::NotFound));

            if !matches!(crop.status, CropStatus::Available) {
                panic_with_error!(&env, AgriConError::InvalidStatus);
            }

            crop.status = CropStatus::Reserved;
            env.storage().persistent().set(&crop_key, &crop);
            env.storage().persistent().set(&owner_key, &buyer.clone());

            CropTransferredEvent {
                nft_id,
                to: buyer.clone(),
            }
            .publish(&env);
            CropStatusEvent {
                nft_id,
                status: CropStatus::Reserved,
            }
            .publish(&env);
        }

        let position = EscrowPosition {
            nft_id,
            buyer: buyer.clone(),
            farmer,
            total_price,
            split,
            status: EscrowStatus::Reserved,
        };

        env.storage().persistent().set(&escrow_key, &position);
        EscrowReservedEvent {
            nft_id,
            buyer,
            total_price,
        }
        .publish(&env);

        position
    }

    pub fn split_payment(total_price: i128) -> PaymentSplit {
        PaymentSplit {
            escrow_amount: total_price * 70 / 100,
            farmer_upfront: total_price * 20 / 100,
            treasury_amount: total_price * 10 / 100,
        }
    }

    pub fn get_escrow_position(env: Env, nft_id: u64) -> EscrowPosition {
        env.storage()
            .persistent()
            .get(&DataKey::EscrowPosition(nft_id))
            .unwrap_or_else(|| panic_with_error!(&env, AgriConError::PositionMissing))
    }

    // ── Internal escrow helpers (no auth — called by verify_delivery) ─

    fn release_escrow_internal(env: &Env, nft_id: u64) {
        let escrow_key = DataKey::EscrowPosition(nft_id);
        let mut position: EscrowPosition = env
            .storage()
            .persistent()
            .get(&escrow_key)
            .unwrap_or_else(|| panic_with_error!(env, AgriConError::PositionMissing));

        let current_contract = env.current_contract_address();
        let token_client = token::TokenClient::new(env, &usdc_token(env));
        let farmer_destination = MuxedAddress::from(position.farmer.clone());
        token_client.transfer(
            &current_contract,
            &farmer_destination,
            &position.split.escrow_amount,
        );

        position.status = EscrowStatus::Released;
        env.storage().persistent().set(&escrow_key, &position);
        EscrowReleasedEvent {
            nft_id,
            released_amount: position.split.escrow_amount,
        }
        .publish(env);
    }

    fn refund_after_disaster_internal(
        env: &Env,
        nft_id: u64,
        refund_amount: i128,
        treasury_compensation: i128,
    ) {
        let escrow_key = DataKey::EscrowPosition(nft_id);
        let position: EscrowPosition = env
            .storage()
            .persistent()
            .get(&escrow_key)
            .unwrap_or_else(|| panic_with_error!(env, AgriConError::PositionMissing));

        if refund_amount < 0 || treasury_compensation < 0 {
            panic_with_error!(env, AgriConError::InvalidAmount);
        }

        let current_contract = env.current_contract_address();
        let token_client = token::TokenClient::new(env, &usdc_token(env));

        if refund_amount > 0 {
            let buyer_destination = MuxedAddress::from(position.buyer.clone());
            token_client.transfer(&current_contract, &buyer_destination, &refund_amount);
        }

        if treasury_compensation > 0 {
            let pool: i128 = env
                .storage()
                .instance()
                .get(&DataKey::TreasuryPoolBalance)
                .unwrap_or(0i128);
            if treasury_compensation > pool {
                panic_with_error!(env, AgriConError::InvalidAmount);
            }

            let buyer_destination = MuxedAddress::from(position.buyer.clone());
            token_client.transfer(
                &current_contract,
                &buyer_destination,
                &treasury_compensation,
            );

            env.storage().instance().set(
                &DataKey::TreasuryPoolBalance,
                &(pool - treasury_compensation),
            );
        }

        let updated = EscrowPosition {
            status: EscrowStatus::Refunded,
            ..position
        };

        env.storage().persistent().set(&escrow_key, &updated);
        EscrowRefundedEvent {
            nft_id,
            refund_amount,
            treasury_compensation,
        }
        .publish(env);
    }

    fn mint_disaster_nft_internal(env: &Env, source_nft_id: u64, owner: Address) -> u64 {
        let next_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextId)
            .unwrap_or(1u64);

        let source: CropLot = env
            .storage()
            .persistent()
            .get(&DataKey::Crop(source_nft_id))
            .unwrap_or_else(|| panic_with_error!(env, AgriConError::NotFound));

        let claim = CropLot {
            id: next_id,
            crop_type: String::from_str(env, "disaster-claim"),
            quantity: 0,
            price: 0,
            farmer: source.farmer,
            harvest_date: source.harvest_date,
            status: CropStatus::Failed,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Crop(next_id), &claim);
        env.storage()
            .persistent()
            .set(&DataKey::Owner(next_id), &owner.clone());
        env.storage()
            .instance()
            .set(&DataKey::NextId, &(next_id + 1));

        DisasterNftMintedEvent {
            source_nft_id,
            disaster_nft_id: next_id,
            owner: owner.clone(),
        }
        .publish(env);
        CropMintedEvent { nft_id: next_id }.publish(env);
        next_id
    }

    // ── Private helpers ──────────────────────────────────────────────

    #[allow(clippy::too_many_arguments)]
    fn write_listing_metadata(
        env: &Env,
        nft_id: u64,
        parcel_name: String,
        parcel_bbox_hash: String,
        parcel_area_hectares_bps: u64,
        region: String,
        min_ndvi_bps: u64,
        observation_window_days: u32,
        listed_at_override: Option<u64>,
    ) {
        let now = env.ledger().timestamp();
        let listing = ListingMetadata {
            nft_id,
            parcel_name,
            parcel_bbox_hash,
            parcel_area_hectares_bps,
            region,
            min_ndvi_bps,
            observation_window_days,
            listed_at: listed_at_override.unwrap_or(now),
            updated_at: now,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Listing(nft_id), &listing);
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address};

    fn setup(env: &Env) -> Address {
        let admin = Address::generate(env);
        let usdc = Address::generate(env);
        let treasury = Address::generate(env);

        env.register(
            AgriConContract,
            (admin.clone(), usdc.clone(), treasury.clone()),
        )
    }

    #[test]
    fn mint_stores_owner_and_price() {
        let env = Env::default();
        env.mock_all_auths();
        let farmer = Address::generate(&env);
        let contract_id = setup(&env);

        env.as_contract(&contract_id, || {
            let nft_id = AgriConContract::mint_crop_nft(
                env.clone(),
                farmer.clone(),
                String::from_str(&env, "rice"),
                1_000i128,
                50_000_000i128,
                1_800_000_000u64,
            );

            let owner = AgriConContract::owner_of(env.clone(), nft_id);
            let price = AgriConContract::get_price(env.clone(), nft_id);
            assert_eq!(owner, farmer);
            assert_eq!(price, 50_000_000i128);
        });
    }

    #[test]
    fn mint_with_listing_stores_metadata() {
        let env = Env::default();
        env.mock_all_auths();
        let farmer = Address::generate(&env);
        let contract_id = setup(&env);

        env.as_contract(&contract_id, || {
            let nft_id = AgriConContract::mint_crop_nft_with_listing(
                env.clone(),
                farmer.clone(),
                String::from_str(&env, "rice"),
                1_000i128,
                50_000_000i128,
                1_800_000_000u64,
                String::from_str(&env, "Central Valley Parcel A"),
                String::from_str(&env, "bbox-hash-001"),
                12_500u64,
                String::from_str(&env, "Nueva Ecija"),
                3_500u64,
                30u32,
            );

            let listing = AgriConContract::get_listing_metadata(env.clone(), nft_id);
            assert_eq!(listing.nft_id, nft_id);
            assert_eq!(
                listing.parcel_name,
                String::from_str(&env, "Central Valley Parcel A")
            );
            assert_eq!(
                listing.parcel_bbox_hash,
                String::from_str(&env, "bbox-hash-001")
            );
            assert_eq!(listing.parcel_area_hectares_bps, 12_500u64);
            assert_eq!(listing.region, String::from_str(&env, "Nueva Ecija"));
            assert_eq!(listing.min_ndvi_bps, 3_500u64);
            assert_eq!(listing.observation_window_days, 30u32);
        });
    }

    #[test]
    fn listing_is_not_buyable_by_default_then_buyable_after_admin_set() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let usdc = Address::generate(&env);
        let treasury = Address::generate(&env);

        let contract_id = env.register(
            AgriConContract,
            (admin.clone(), usdc.clone(), treasury.clone()),
        );

        env.as_contract(&contract_id, || {
            assert!(!AgriConContract::is_listing_buyable(env.clone(), 1));
            AgriConContract::set_listing_buyable(env.clone(), 1, true);
            assert!(AgriConContract::is_listing_buyable(env.clone(), 1));
        });
    }

    #[test]
    fn satellite_attestation_updates_buyability() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let usdc = Address::generate(&env);
        let treasury = Address::generate(&env);

        let contract_id = env.register(
            AgriConContract,
            (admin.clone(), usdc.clone(), treasury.clone()),
        );

        env.as_contract(&contract_id, || {
            AgriConContract::record_satellite_attestation(
                env.clone(),
                9,
                1_716_123_456,
                4821,
                3500,
                String::from_str(&env, "bbox:demo"),
                String::from_str(&env, "report:demo"),
                String::from_str(&env, "openEO-SentinelHub"),
            );

            let attestation = AgriConContract::get_satellite_attestation(env.clone(), 9);
            assert_eq!(attestation.nft_id, 9);
            assert_eq!(attestation.ndvi_bps, 4821);
            assert_eq!(attestation.min_ndvi_bps, 3500);
            assert!(attestation.buyable);
            assert!(AgriConContract::is_listing_buyable(env.clone(), 9));
        });
    }

    #[test]
    fn oracle_registration_toggles_is_oracle() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = setup(&env);
        let oracle = Address::generate(&env);

        env.as_contract(&contract_id, || {
            assert!(!AgriConContract::is_oracle(env.clone(), oracle.clone()));
            AgriConContract::add_oracle(env.clone(), oracle.clone());
            assert!(AgriConContract::is_oracle(env.clone(), oracle.clone()));
            AgriConContract::remove_oracle(env.clone(), oracle.clone());
            assert!(!AgriConContract::is_oracle(env.clone(), oracle.clone()));
        });
    }

    #[test]
    fn registered_oracle_can_record_attestation() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = setup(&env);
        let oracle = Address::generate(&env);

        env.as_contract(&contract_id, || {
            AgriConContract::add_oracle(env.clone(), oracle.clone());

            AgriConContract::record_sat_attest_oracle(
                env.clone(),
                oracle.clone(),
                11,
                1_716_123_456,
                4821,
                3500,
                String::from_str(&env, "bbox:agent"),
                String::from_str(&env, "report:agent"),
                String::from_str(&env, "openEO-SentinelHub"),
            );

            let attestation = AgriConContract::get_satellite_attestation(env.clone(), 11);
            assert_eq!(attestation.ndvi_bps, 4821);
            assert!(attestation.buyable);
            assert!(AgriConContract::is_listing_buyable(env.clone(), 11));
        });
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #2)")]
    fn unregistered_oracle_cannot_record_attestation() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = setup(&env);
        let rogue = Address::generate(&env);

        env.as_contract(&contract_id, || {
            // No add_oracle call → must be rejected as Unauthorized (#2).
            AgriConContract::record_sat_attest_oracle(
                env.clone(),
                rogue.clone(),
                12,
                1_716_123_456,
                4821,
                3500,
                String::from_str(&env, "bbox:rogue"),
                String::from_str(&env, "report:rogue"),
                String::from_str(&env, "openEO-SentinelHub"),
            );
        });
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #2)")]
    fn revoked_oracle_cannot_record_attestation() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = setup(&env);
        let oracle = Address::generate(&env);

        env.as_contract(&contract_id, || {
            AgriConContract::add_oracle(env.clone(), oracle.clone());
            AgriConContract::remove_oracle(env.clone(), oracle.clone());
            AgriConContract::record_sat_attest_oracle(
                env.clone(),
                oracle.clone(),
                13,
                1_716_123_456,
                4821,
                3500,
                String::from_str(&env, "bbox:revoked"),
                String::from_str(&env, "report:revoked"),
                String::from_str(&env, "openEO-SentinelHub"),
            );
        });
    }

    #[test]
    fn attestation_rejects_when_ndvi_below_threshold() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let usdc = Address::generate(&env);
        let treasury = Address::generate(&env);

        let contract_id = env.register(
            AgriConContract,
            (admin.clone(), usdc.clone(), treasury.clone()),
        );

        env.as_contract(&contract_id, || {
            AgriConContract::record_satellite_attestation(
                env.clone(),
                5,
                1_716_123_456,
                3000,
                3500,
                String::from_str(&env, "bbox:low-ndvi"),
                String::from_str(&env, "report:low"),
                String::from_str(&env, "openEO-SentinelHub"),
            );

            let attestation = AgriConContract::get_satellite_attestation(env.clone(), 5);
            assert_eq!(attestation.ndvi_bps, 3000);
            assert_eq!(attestation.min_ndvi_bps, 3500);
            assert!(!attestation.buyable);
            assert!(!AgriConContract::is_listing_buyable(env.clone(), 5));
        });
    }

    #[test]
    fn admin_attestation_works_without_oracle_role() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let usdc = Address::generate(&env);
        let treasury = Address::generate(&env);

        let contract_id = env.register(
            AgriConContract,
            (admin.clone(), usdc.clone(), treasury.clone()),
        );

        env.as_contract(&contract_id, || {
            AgriConContract::record_satellite_attestation(
                env.clone(),
                42,
                1_716_223_456,
                3999,
                3500,
                String::from_str(&env, "bbox:phase4"),
                String::from_str(&env, "report:phase4"),
                String::from_str(&env, "openEO-SentinelHub"),
            );

            assert!(AgriConContract::is_listing_buyable(env.clone(), 42));
        });
    }

    #[test]
    fn split_payment_is_70_20_10() {
        let split = AgriConContract::split_payment(10_000_000i128);
        assert_eq!(split.escrow_amount, 7_000_000i128);
        assert_eq!(split.farmer_upfront, 2_000_000i128);
        assert_eq!(split.treasury_amount, 1_000_000i128);
    }

    #[test]
    fn set_listing_metadata_preserves_initial_listed_at() {
        let env = Env::default();
        env.mock_all_auths();
        let farmer = Address::generate(&env);
        let contract_id = setup(&env);

        let nft_id = env.as_contract(&contract_id, || {
            AgriConContract::mint_crop_nft(
                env.clone(),
                farmer.clone(),
                String::from_str(&env, "corn"),
                650i128,
                72_000_000i128,
                1_801_000_000u64,
            )
        });

        env.as_contract(&contract_id, || {
            AgriConContract::set_listing_metadata(
                env.clone(),
                farmer.clone(),
                nft_id,
                String::from_str(&env, "Bukidnon Parcel North"),
                String::from_str(&env, "bbox-hash-002"),
                8_750u64,
                String::from_str(&env, "Bukidnon"),
                3_800u64,
                21u32,
            );
        });

        let original = env.as_contract(&contract_id, || {
            AgriConContract::get_listing_metadata(env.clone(), nft_id)
        });

        env.as_contract(&contract_id, || {
            AgriConContract::set_listing_metadata(
                env.clone(),
                farmer.clone(),
                nft_id,
                String::from_str(&env, "Bukidnon Parcel North Revised"),
                String::from_str(&env, "bbox-hash-003"),
                8_900u64,
                String::from_str(&env, "Bukidnon"),
                4_000u64,
                14u32,
            );
        });

        let updated = env.as_contract(&contract_id, || {
            AgriConContract::get_listing_metadata(env.clone(), nft_id)
        });
        assert_eq!(updated.listed_at, original.listed_at);
        assert_eq!(
            updated.parcel_name,
            String::from_str(&env, "Bukidnon Parcel North Revised")
        );
        assert_eq!(updated.min_ndvi_bps, 4_000u64);
        assert_eq!(updated.observation_window_days, 14u32);
    }

    // ── Escrow / settlement coverage ────────────────────────────────

    /// Registers a real Stellar Asset Contract as USDC and an AgriCon
    /// instance wired to it. Returns (contract_id, usdc_token_address).
    fn setup_token_env(env: &Env) -> (Address, Address) {
        let admin = Address::generate(env);
        let sac = env.register_stellar_asset_contract_v2(admin.clone());
        let usdc = sac.address();
        let treasury = Address::generate(env);
        let contract_id = env.register(AgriConContract, (admin, usdc.clone(), treasury));
        (contract_id, usdc)
    }

    fn mint_buyable(
        client: &AgriConContractClient,
        env: &Env,
        farmer: &Address,
        price: i128,
    ) -> u64 {
        let nft_id = client.mint_crop_nft(
            farmer,
            &String::from_str(env, "rice"),
            &1_000i128,
            &price,
            &1_800_000_000u64,
        );
        client.set_listing_buyable(&nft_id, &true);
        nft_id
    }

    #[test]
    fn buy_crop_nft_splits_payment_and_transfers_ownership() {
        let env = Env::default();
        env.mock_all_auths();
        let (contract_id, usdc) = setup_token_env(&env);
        let client = AgriConContractClient::new(&env, &contract_id);

        let farmer = Address::generate(&env);
        let buyer = Address::generate(&env);
        let price = 10_000_000i128;
        token::StellarAssetClient::new(&env, &usdc).mint(&buyer, &price);

        let nft_id = mint_buyable(&client, &env, &farmer, price);
        let position = client.buy_crop_nft(&buyer, &nft_id);

        assert_eq!(position.split.escrow_amount, 7_000_000i128);
        assert_eq!(position.split.farmer_upfront, 2_000_000i128);
        assert_eq!(position.split.treasury_amount, 1_000_000i128);
        assert_eq!(position.status, EscrowStatus::Reserved);

        let token = token::TokenClient::new(&env, &usdc);
        // 20% paid upfront; contract holds 70% escrow + 10% treasury.
        assert_eq!(token.balance(&farmer), 2_000_000i128);
        assert_eq!(token.balance(&contract_id), 8_000_000i128);
        assert_eq!(token.balance(&buyer), 0i128);
        assert_eq!(client.get_treasury_pool_balance(), 1_000_000i128);
        assert_eq!(client.owner_of(&nft_id), buyer);
        assert_eq!(client.get_crop(&nft_id).status, CropStatus::Reserved);
    }

    #[test]
    #[should_panic]
    fn buy_unbuyable_listing_panics() {
        let env = Env::default();
        env.mock_all_auths();
        let (contract_id, usdc) = setup_token_env(&env);
        let client = AgriConContractClient::new(&env, &contract_id);

        let farmer = Address::generate(&env);
        let buyer = Address::generate(&env);
        let price = 10_000_000i128;
        token::StellarAssetClient::new(&env, &usdc).mint(&buyer, &price);

        let nft_id = client.mint_crop_nft(
            &farmer,
            &String::from_str(&env, "rice"),
            &1_000i128,
            &price,
            &1_800_000_000u64,
        );
        // Listing was never marked buyable — purchase must fail.
        client.buy_crop_nft(&buyer, &nft_id);
    }

    #[test]
    fn verify_delivery_delivered_releases_escrow() {
        let env = Env::default();
        env.mock_all_auths();
        let (contract_id, usdc) = setup_token_env(&env);
        let client = AgriConContractClient::new(&env, &contract_id);

        let farmer = Address::generate(&env);
        let buyer = Address::generate(&env);
        let validator = Address::generate(&env);
        let price = 10_000_000i128;
        token::StellarAssetClient::new(&env, &usdc).mint(&buyer, &price);

        let nft_id = mint_buyable(&client, &env, &farmer, price);
        client.buy_crop_nft(&buyer, &nft_id);

        client.add_validator(&validator);
        client.submit_proof(&farmer, &nft_id, &String::from_str(&env, "proof:harvest"));
        client.verify_delivery(
            &validator,
            &nft_id,
            &String::from_str(&env, "Delivered"),
            &String::from_str(&env, "notes:ok"),
            &0i128,
            &0i128,
        );

        let token = token::TokenClient::new(&env, &usdc);
        // 20% upfront + 70% escrow released = 90% to farmer; 10% treasury remains.
        assert_eq!(token.balance(&farmer), 9_000_000i128);
        assert_eq!(token.balance(&contract_id), 1_000_000i128);
        assert_eq!(
            client.get_escrow_position(&nft_id).status,
            EscrowStatus::Released
        );
        assert_eq!(client.get_crop(&nft_id).status, CropStatus::Completed);
    }

    #[test]
    fn verify_delivery_disaster_refunds_buyer() {
        let env = Env::default();
        env.mock_all_auths();
        let (contract_id, usdc) = setup_token_env(&env);
        let client = AgriConContractClient::new(&env, &contract_id);

        let farmer = Address::generate(&env);
        let buyer = Address::generate(&env);
        let validator = Address::generate(&env);
        let price = 10_000_000i128;
        token::StellarAssetClient::new(&env, &usdc).mint(&buyer, &price);

        let nft_id = mint_buyable(&client, &env, &farmer, price);
        client.buy_crop_nft(&buyer, &nft_id);

        client.add_validator(&validator);
        client.submit_proof(&farmer, &nft_id, &String::from_str(&env, "proof:loss"));
        client.verify_delivery(
            &validator,
            &nft_id,
            &String::from_str(&env, "Disaster"),
            &String::from_str(&env, "notes:flood"),
            &7_000_000i128,
            &0i128,
        );

        let token = token::TokenClient::new(&env, &usdc);
        // Buyer is refunded the 70% escrow.
        assert_eq!(token.balance(&buyer), 7_000_000i128);
        assert_eq!(
            client.get_escrow_position(&nft_id).status,
            EscrowStatus::Refunded
        );
        assert_eq!(client.get_crop(&nft_id).status, CropStatus::Failed);
    }

    #[test]
    fn submit_proof_is_retrievable() {
        let env = Env::default();
        env.mock_all_auths();
        let (contract_id, _usdc) = setup_token_env(&env);
        let client = AgriConContractClient::new(&env, &contract_id);

        let farmer = Address::generate(&env);
        client.submit_proof(&farmer, &7u64, &String::from_str(&env, "proof:abc"));

        let proof = client.get_proof(&7u64);
        assert_eq!(proof.nft_id, 7u64);
        assert_eq!(proof.farmer, farmer);
        assert_eq!(proof.proof_hash, String::from_str(&env, "proof:abc"));
    }

    #[test]
    fn farmer_profile_upsert_then_admin_verify() {
        let env = Env::default();
        env.mock_all_auths();
        let (contract_id, _usdc) = setup_token_env(&env);
        let client = AgriConContractClient::new(&env, &contract_id);

        let farmer = Address::generate(&env);
        client.upsert_farmer_profile(
            &farmer,
            &String::from_str(&env, "Juan Dela Cruz"),
            &String::from_str(&env, "Green Valley Farm"),
            &String::from_str(&env, "Cavite"),
            &5_000i128,
        );

        let profile = client.get_farmer_profile(&farmer);
        assert_eq!(profile.full_name, String::from_str(&env, "Juan Dela Cruz"));
        assert!(!profile.verified);

        client.set_farmer_profile_verified(&farmer, &true);
        assert!(client.get_farmer_profile(&farmer).verified);
    }
}
