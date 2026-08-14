#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, Address,
    Env, String,
};

#[derive(Clone)]
#[contracttype]
pub enum CropStatus {
    Available,
    Reserved,
    Growing,
    Verified,
    Completed,
    Failed,
}

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
    pub government_id_object: String,
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
pub enum DataKey {
    Admin,
    EscrowContract,
    VerificationContract,
    NextId,
    Crop(u64),
    Owner(u64),
    Profile(Address),
    Listing(u64),
}

#[contracterror]
#[derive(Clone, Copy, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum CropNftError {
    AlreadyInitialized = 1,
    Unauthorized = 2,
    NotFound = 3,
    InvalidStatus = 4,
    ProfileMissing = 5,
}

#[contractevent(topics = ["crop_nft", "minted"])]
#[derive(Clone)]
pub struct CropMintedEvent {
    #[topic]
    pub nft_id: u64,
}

#[contractevent(topics = ["crop_nft", "transferred"])]
#[derive(Clone)]
pub struct CropTransferredEvent {
    #[topic]
    pub nft_id: u64,
    #[topic]
    pub to: Address,
}

#[contractevent(topics = ["crop_nft", "status"])]
#[derive(Clone)]
pub struct CropStatusEvent {
    #[topic]
    pub nft_id: u64,
    pub status: CropStatus,
}

#[contractevent(topics = ["crop_nft", "disaster_nft_minted"])]
#[derive(Clone)]
pub struct DisasterNftMintedEvent {
    #[topic]
    pub source_nft_id: u64,
    #[topic]
    pub disaster_nft_id: u64,
    #[topic]
    pub owner: Address,
}

#[contract]
pub struct CropNftContract;

#[contractimpl]
impl CropNftContract {
    pub fn __constructor(
        env: Env,
        admin: Address,
        escrow_contract: Address,
        verification_contract: Address,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, CropNftError::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::EscrowContract, &escrow_contract);
        env.storage()
            .instance()
            .set(&DataKey::VerificationContract, &verification_contract);
        env.storage().instance().set(&DataKey::NextId, &1u64);
    }

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

    pub fn transfer_nft(env: Env, nft_id: u64, from: Address, to: Address) {
        from.require_auth();

        let owner_key = DataKey::Owner(nft_id);
        let owner: Address = env
            .storage()
            .persistent()
            .get(&owner_key)
            .unwrap_or_else(|| panic_with_error!(&env, CropNftError::NotFound));

        if owner != from {
            panic_with_error!(&env, CropNftError::Unauthorized);
        }

        env.storage().persistent().set(&owner_key, &to.clone());
        CropTransferredEvent { nft_id, to }.publish(&env);
    }

    pub fn transfer_nft_by_escrow(env: Env, nft_id: u64, to: Address) {
        Self::require_escrow(&env);

        let crop_key = DataKey::Crop(nft_id);
        let mut crop: CropLot = env
            .storage()
            .persistent()
            .get(&crop_key)
            .unwrap_or_else(|| panic_with_error!(&env, CropNftError::NotFound));

        if !matches!(crop.status, CropStatus::Available) {
            panic_with_error!(&env, CropNftError::InvalidStatus);
        }

        crop.status = CropStatus::Reserved;
        env.storage().persistent().set(&crop_key, &crop);
        env.storage()
            .persistent()
            .set(&DataKey::Owner(nft_id), &to.clone());

        CropTransferredEvent {
            nft_id,
            to: to.clone(),
        }
        .publish(&env);
        CropStatusEvent {
            nft_id,
            status: CropStatus::Reserved,
        }
        .publish(&env);
    }

    pub fn set_status_by_verification(env: Env, nft_id: u64, status: CropStatus) {
        Self::require_verification(&env);

        let crop_key = DataKey::Crop(nft_id);
        let mut crop: CropLot = env
            .storage()
            .persistent()
            .get(&crop_key)
            .unwrap_or_else(|| panic_with_error!(&env, CropNftError::NotFound));

        crop.status = status.clone();
        env.storage().persistent().set(&crop_key, &crop);
        CropStatusEvent { nft_id, status }.publish(&env);
    }

    pub fn mint_disaster_nft(env: Env, source_nft_id: u64, owner: Address) -> u64 {
        Self::require_verification(&env);

        // Ensure source crop exists.
        let source: CropLot = env
            .storage()
            .persistent()
            .get(&DataKey::Crop(source_nft_id))
            .unwrap_or_else(|| panic_with_error!(&env, CropNftError::NotFound));

        let next_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextId)
            .unwrap_or(1u64);
        let claim = CropLot {
            id: next_id,
            crop_type: String::from_str(&env, "disaster-claim"),
            quantity: 0,
            price: 0,
            farmer: source.farmer,
            harvest_date: source.harvest_date,
            status: CropStatus::Failed,
        };

        env.storage().persistent().set(&DataKey::Crop(next_id), &claim);
        env.storage().persistent().set(&DataKey::Owner(next_id), &owner.clone());
        env.storage().instance().set(&DataKey::NextId, &(next_id + 1));

        DisasterNftMintedEvent {
            source_nft_id,
            disaster_nft_id: next_id,
            owner: owner.clone(),
        }
        .publish(&env);
        CropMintedEvent { nft_id: next_id }.publish(&env);
        next_id
    }

    pub fn get_crop(env: Env, nft_id: u64) -> CropLot {
        env.storage()
            .persistent()
            .get(&DataKey::Crop(nft_id))
            .unwrap_or_else(|| panic_with_error!(&env, CropNftError::NotFound))
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
            .unwrap_or_else(|| panic_with_error!(&env, CropNftError::NotFound))
    }

    #[allow(clippy::too_many_arguments)]
    pub fn upsert_farmer_profile(
        env: Env,
        farmer: Address,
        full_name: String,
        farm_name: String,
        region: String,
        government_id_object: String,
        total_yield_kg: i128,
    ) {
        farmer.require_auth();
        if total_yield_kg < 0 {
            panic_with_error!(&env, CropNftError::InvalidStatus);
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
            government_id_object,
            verified,
            total_yield_kg,
            updated_at: env.ledger().timestamp(),
        };

        env.storage()
            .persistent()
            .set(&DataKey::Profile(farmer), &profile);
    }

    pub fn set_farmer_profile_verified(env: Env, farmer: Address, verified: bool) {
        Self::require_admin(&env);

        let mut profile: FarmerProfile = env
            .storage()
            .persistent()
            .get(&DataKey::Profile(farmer.clone()))
            .unwrap_or_else(|| panic_with_error!(&env, CropNftError::ProfileMissing));
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
            .unwrap_or_else(|| panic_with_error!(&env, CropNftError::ProfileMissing))
    }

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
            panic_with_error!(&env, CropNftError::Unauthorized);
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
            .unwrap_or_else(|| panic_with_error!(&env, CropNftError::NotFound))
    }

    fn require_escrow(env: &Env) {
        let escrow_contract: Address = env
            .storage()
            .instance()
            .get(&DataKey::EscrowContract)
            .unwrap_or_else(|| panic_with_error!(env, CropNftError::Unauthorized));
        escrow_contract.require_auth();
    }

fn require_verification(env: &Env) {
        let verification_contract: Address = env
            .storage()
            .instance()
            .get(&DataKey::VerificationContract)
            .unwrap_or_else(|| panic_with_error!(env, CropNftError::Unauthorized));
        verification_contract.require_auth();
    }

    fn require_admin(env: &Env) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(env, CropNftError::Unauthorized));
        admin.require_auth();
    }

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

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address};

    #[test]
    fn mint_stores_owner_and_price() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let escrow = Address::generate(&env);
        let verification = Address::generate(&env);
        let contract_id = env.register(
            CropNftContract,
            (admin.clone(), escrow.clone(), verification.clone()),
        );
        let client = CropNftContractClient::new(&env, &contract_id);

        let farmer = Address::generate(&env);
        let nft_id = client.mint_crop_nft(
            &farmer,
            &String::from_str(&env, "rice"),
            &1_000i128,
            &5_000_0000i128,
            &1_800_000_000u64,
        );

        let owner = client.owner_of(&nft_id);
        let price = client.get_price(&nft_id);
        assert_eq!(owner, farmer);
        assert_eq!(price, 5_000_0000i128);
    }

    #[test]
    fn mint_with_listing_stores_metadata() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let escrow = Address::generate(&env);
        let verification = Address::generate(&env);
        let contract_id = env.register(
            CropNftContract,
            (admin.clone(), escrow.clone(), verification.clone()),
        );
        let client = CropNftContractClient::new(&env, &contract_id);

        let farmer = Address::generate(&env);
        let nft_id = client.mint_crop_nft_with_listing(
            &farmer,
            &String::from_str(&env, "rice"),
            &1_000i128,
            &5_000_0000i128,
            &1_800_000_000u64,
            &String::from_str(&env, "Central Valley Parcel A"),
            &String::from_str(&env, "bbox-hash-001"),
            &12_500u64,
            &String::from_str(&env, "Nueva Ecija"),
            &3_500u64,
            &30u32,
        );

        let listing = client.get_listing_metadata(&nft_id);
        assert_eq!(listing.nft_id, nft_id);
        assert_eq!(listing.parcel_name, String::from_str(&env, "Central Valley Parcel A"));
        assert_eq!(listing.parcel_bbox_hash, String::from_str(&env, "bbox-hash-001"));
        assert_eq!(listing.parcel_area_hectares_bps, 12_500u64);
        assert_eq!(listing.region, String::from_str(&env, "Nueva Ecija"));
        assert_eq!(listing.min_ndvi_bps, 3_500u64);
        assert_eq!(listing.observation_window_days, 30u32);
    }

    #[test]
    fn set_listing_metadata_preserves_initial_listed_at() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let escrow = Address::generate(&env);
        let verification = Address::generate(&env);
        let contract_id = env.register(
            CropNftContract,
            (admin.clone(), escrow.clone(), verification.clone()),
        );
        let client = CropNftContractClient::new(&env, &contract_id);

        let farmer = Address::generate(&env);
        let nft_id = client.mint_crop_nft(
            &farmer,
            &String::from_str(&env, "corn"),
            &650i128,
            &7_200_0000i128,
            &1_801_000_000u64,
        );

        client.set_listing_metadata(
            &farmer,
            &nft_id,
            &String::from_str(&env, "Bukidnon Parcel North"),
            &String::from_str(&env, "bbox-hash-002"),
            &8_750u64,
            &String::from_str(&env, "Bukidnon"),
            &3_800u64,
            &21u32,
        );

        let original = client.get_listing_metadata(&nft_id);

        client.set_listing_metadata(
            &farmer,
            &nft_id,
            &String::from_str(&env, "Bukidnon Parcel North Revised"),
            &String::from_str(&env, "bbox-hash-003"),
            &8_900u64,
            &String::from_str(&env, "Bukidnon"),
            &4_000u64,
            &14u32,
        );

        let updated = client.get_listing_metadata(&nft_id);
        assert_eq!(updated.listed_at, original.listed_at);
        assert_eq!(
            updated.parcel_name,
            String::from_str(&env, "Bukidnon Parcel North Revised")
        );
        assert_eq!(updated.min_ndvi_bps, 4_000u64);
        assert_eq!(updated.observation_window_days, 14u32);
    }
}
