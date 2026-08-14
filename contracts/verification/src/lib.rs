#![no_std]

use soroban_sdk::{
    auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation},
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype,
    panic_with_error, vec, Address, Env, IntoVal, String, Symbol,
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
pub struct ProofRecord {
    pub nft_id: u64,
    pub farmer: Address,
    pub proof_hash: String,
}

#[derive(Clone)]
#[contracttype]
pub enum VerificationStatus {
    Pending,
    Delivered,
    Disaster,
    Fraud,
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

#[contractclient(name = "EscrowClient")]
pub trait EscrowContract {
    fn release_escrow(env: Env, nft_id: u64);
    fn refund_after_disaster(
        env: Env,
        nft_id: u64,
        refund_amount: i128,
        treasury_compensation: i128,
    );
}

#[contractclient(name = "CropNftClient")]
pub trait CropNftContract {
    fn set_status_by_verification(env: Env, nft_id: u64, status: CropStatus);
    fn mint_disaster_nft(env: Env, source_nft_id: u64, owner: Address) -> u64;
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    EscrowContract,
    CropNftContract,
    Validator(Address),
    Oracle(Address),
    Proof(u64),
    Decision(u64),
    Buyable(u64),
    Attestation(u64),
}

#[contracterror]
#[derive(Clone, Copy, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum VerificationError {
    AlreadyInitialized = 1,
    Unauthorized = 2,
    ProofMissing = 3,
    InvalidStatus = 4,
    AttestationMissing = 5,
}

#[contractevent(topics = ["verification", "validator_added"])]
#[derive(Clone)]
pub struct ValidatorAddedEvent {
    #[topic]
    pub validator: Address,
}

#[contractevent(topics = ["verification", "oracle_added"])]
#[derive(Clone)]
pub struct OracleAddedEvent {
    #[topic]
    pub oracle: Address,
}

#[contractevent(topics = ["verification", "proof_submitted"])]
#[derive(Clone)]
pub struct ProofSubmittedEvent {
    #[topic]
    pub nft_id: u64,
    #[topic]
    pub farmer: Address,
}

#[contractevent(topics = ["verification", "decision"])]
#[derive(Clone)]
pub struct DecisionEvent {
    #[topic]
    pub nft_id: u64,
    #[topic]
    pub validator: Address,
    pub status: VerificationStatus,
}

#[contract]
pub struct VerificationContract;

#[contractimpl]
impl VerificationContract {
    pub fn __constructor(
        env: Env,
        admin: Address,
        escrow_contract: Address,
        crop_nft_contract: Address,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, VerificationError::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::EscrowContract, &escrow_contract);
        env.storage()
            .instance()
            .set(&DataKey::CropNftContract, &crop_nft_contract);
    }

    pub fn add_validator(env: Env, validator: Address) {
        Self::require_admin(&env);
        env.storage()
            .persistent()
            .set(&DataKey::Validator(validator.clone()), &true);
        ValidatorAddedEvent { validator }.publish(&env);
    }

    pub fn add_oracle(env: Env, oracle: Address) {
        Self::require_admin(&env);
        env.storage()
            .persistent()
            .set(&DataKey::Oracle(oracle.clone()), &true);
        OracleAddedEvent { oracle }.publish(&env);
    }

    pub fn set_listing_buyable(env: Env, nft_id: u64, buyable: bool) {
        Self::require_admin(&env);
        env.storage().persistent().set(&DataKey::Buyable(nft_id), &buyable);
    }

    #[allow(clippy::too_many_arguments)]
    pub fn record_satellite_attestation(
        env: Env,
        nft_id: u64,
        observed_at: u64,
        ndvi_bps: u64,
        min_ndvi_bps: u64,
        buyable: bool,
        bbox_hash: String,
        report_hash: String,
        source: String,
    ) {
        Self::require_admin(&env);

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
        env.storage().persistent().set(&DataKey::Buyable(nft_id), &buyable);
    }

    pub fn is_listing_buyable(env: Env, nft_id: u64) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Buyable(nft_id))
            .unwrap_or(false)
    }

    pub fn is_oracle(env: Env, oracle: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Oracle(oracle))
            .unwrap_or(false)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn record_sat_attest_oracle(
        env: Env,
        oracle: Address,
        nft_id: u64,
        observed_at: u64,
        ndvi_bps: u64,
        min_ndvi_bps: u64,
        buyable: bool,
        bbox_hash: String,
        report_hash: String,
        source: String,
    ) {
        oracle.require_auth();
        let is_allowed: bool = env
            .storage()
            .persistent()
            .get(&DataKey::Oracle(oracle))
            .unwrap_or(false);
        if !is_allowed {
            panic_with_error!(&env, VerificationError::Unauthorized);
        }

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
        env.storage().persistent().set(&DataKey::Buyable(nft_id), &buyable);
    }

    pub fn get_satellite_attestation(env: Env, nft_id: u64) -> SatelliteAttestation {
        env.storage()
            .persistent()
            .get(&DataKey::Attestation(nft_id))
            .unwrap_or_else(|| panic_with_error!(&env, VerificationError::AttestationMissing))
    }

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
            panic_with_error!(&env, VerificationError::Unauthorized);
        }

        if !env.storage().persistent().has(&DataKey::Proof(nft_id)) {
            panic_with_error!(&env, VerificationError::ProofMissing);
        }

        let escrow_contract = Self::escrow_contract(&env);
        let crop_nft_contract = Self::crop_nft_contract(&env);
        let escrow_client = EscrowClient::new(&env, &escrow_contract);
        let crop_client = CropNftClient::new(&env, &crop_nft_contract);
        let parsed_status = Self::parse_status(&env, status);

        match parsed_status {
            VerificationStatus::Delivered => {
                env.storage().persistent().set(&DataKey::Buyable(nft_id), &false);
                Self::authorize_release_escrow(&env, &escrow_contract, nft_id);
                escrow_client.release_escrow(&nft_id);

                Self::authorize_crop_status(
                    &env,
                    &crop_nft_contract,
                    nft_id,
                    CropStatus::Completed,
                );
                crop_client.set_status_by_verification(&nft_id, &CropStatus::Completed);
            }
            VerificationStatus::Disaster | VerificationStatus::Fraud => {
                env.storage().persistent().set(&DataKey::Buyable(nft_id), &false);
                Self::authorize_refund(
                    &env,
                    &escrow_contract,
                    nft_id,
                    refund_amount,
                    treasury_compensation,
                );
                escrow_client.refund_after_disaster(
                    &nft_id,
                    &refund_amount,
                    &treasury_compensation,
                );

                Self::authorize_crop_status(&env, &crop_nft_contract, nft_id, CropStatus::Failed);
                crop_client.set_status_by_verification(&nft_id, &CropStatus::Failed);
                Self::authorize_mint_disaster_nft(
                    &env,
                    &crop_nft_contract,
                    nft_id,
                    validator.clone(),
                );
                let _ = crop_client.mint_disaster_nft(&nft_id, &validator);
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

    pub fn get_proof(env: Env, nft_id: u64) -> ProofRecord {
        env.storage()
            .persistent()
            .get(&DataKey::Proof(nft_id))
            .unwrap_or_else(|| panic_with_error!(&env, VerificationError::ProofMissing))
    }

    pub fn get_decision(env: Env, nft_id: u64) -> VerificationDecision {
        env.storage()
            .persistent()
            .get(&DataKey::Decision(nft_id))
            .unwrap_or_else(|| panic_with_error!(&env, VerificationError::ProofMissing))
    }

    fn escrow_contract(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::EscrowContract)
            .unwrap_or_else(|| panic_with_error!(env, VerificationError::Unauthorized))
    }

    fn crop_nft_contract(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::CropNftContract)
            .unwrap_or_else(|| panic_with_error!(env, VerificationError::Unauthorized))
    }

    fn require_admin(env: &Env) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(env, VerificationError::Unauthorized));
        admin.require_auth();
    }

    fn authorize_release_escrow(env: &Env, escrow_contract: &Address, nft_id: u64) {
        env.authorize_as_current_contract(vec![
            env,
            InvokerContractAuthEntry::Contract(SubContractInvocation {
                context: ContractContext {
                    contract: escrow_contract.clone(),
                    fn_name: Symbol::new(env, "release_escrow"),
                    args: vec![env, nft_id.into_val(env)],
                },
                sub_invocations: vec![env],
            }),
        ]);
    }

    fn authorize_refund(
        env: &Env,
        escrow_contract: &Address,
        nft_id: u64,
        refund_amount: i128,
        treasury_compensation: i128,
    ) {
        env.authorize_as_current_contract(vec![
            env,
            InvokerContractAuthEntry::Contract(SubContractInvocation {
                context: ContractContext {
                    contract: escrow_contract.clone(),
                    fn_name: Symbol::new(env, "refund_after_disaster"),
                    args: vec![
                        env,
                        nft_id.into_val(env),
                        refund_amount.into_val(env),
                        treasury_compensation.into_val(env),
                    ],
                },
                sub_invocations: vec![env],
            }),
        ]);
    }

    fn authorize_crop_status(
        env: &Env,
        crop_nft_contract: &Address,
        nft_id: u64,
        status: CropStatus,
    ) {
        env.authorize_as_current_contract(vec![
            env,
            InvokerContractAuthEntry::Contract(SubContractInvocation {
                context: ContractContext {
                    contract: crop_nft_contract.clone(),
                    fn_name: Symbol::new(env, "set_status_by_verification"),
                    args: vec![env, nft_id.into_val(env), status.into_val(env)],
                },
                sub_invocations: vec![env],
            }),
        ]);
    }

    fn authorize_mint_disaster_nft(
        env: &Env,
        crop_nft_contract: &Address,
        source_nft_id: u64,
        owner: Address,
    ) {
        env.authorize_as_current_contract(vec![
            env,
            InvokerContractAuthEntry::Contract(SubContractInvocation {
                context: ContractContext {
                    contract: crop_nft_contract.clone(),
                    fn_name: Symbol::new(env, "mint_disaster_nft"),
                    args: vec![env, source_nft_id.into_val(env), owner.into_val(env)],
                },
                sub_invocations: vec![env],
            }),
        ]);
    }

    fn parse_status(env: &Env, status: String) -> VerificationStatus {
        if status == String::from_str(env, "Delivered") {
            VerificationStatus::Delivered
        } else if status == String::from_str(env, "Disaster") {
            VerificationStatus::Disaster
        } else if status == String::from_str(env, "Fraud") {
            VerificationStatus::Fraud
        } else if status == String::from_str(env, "Pending") {
            VerificationStatus::Pending
        } else {
            panic_with_error!(env, VerificationError::InvalidStatus);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address};

    #[test]
    fn listing_is_not_buyable_by_default_then_buyable_after_admin_set() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let escrow = Address::generate(&env);
        let crop = Address::generate(&env);

        let contract_id = env.register(
            VerificationContract,
            (admin.clone(), escrow.clone(), crop.clone()),
        );
        let client = VerificationContractClient::new(&env, &contract_id);

        assert!(!client.is_listing_buyable(&1));
        client.set_listing_buyable(&1, &true);
        assert!(client.is_listing_buyable(&1));
    }

    #[test]
    fn satellite_attestation_updates_buyability_and_is_readable() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let escrow = Address::generate(&env);
        let crop = Address::generate(&env);

        let contract_id = env.register(
            VerificationContract,
            (admin.clone(), escrow.clone(), crop.clone()),
        );
        let client = VerificationContractClient::new(&env, &contract_id);

        client.record_satellite_attestation(
            &9,
            &1_716_123_456,
            &4821,
            &3500,
            &true,
            &String::from_str(&env, "bbox:demo"),
            &String::from_str(&env, "report:demo"),
            &String::from_str(&env, "openEO-SentinelHub"),
        );

        let attestation = client.get_satellite_attestation(&9);
        assert_eq!(attestation.nft_id, 9);
        assert_eq!(attestation.ndvi_bps, 4821);
        assert_eq!(attestation.min_ndvi_bps, 3500);
        assert!(attestation.buyable);
        assert!(client.is_listing_buyable(&9));
    }

    #[test]
    fn oracle_attestation_requires_registration_and_sets_buyability() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let oracle = Address::generate(&env);
        let escrow = Address::generate(&env);
        let crop = Address::generate(&env);

        let contract_id = env.register(
            VerificationContract,
            (admin.clone(), escrow.clone(), crop.clone()),
        );
        let client = VerificationContractClient::new(&env, &contract_id);

        client.add_oracle(&oracle);
        assert!(client.is_oracle(&oracle));

        client.record_sat_attest_oracle(
            &oracle,
            &42,
            &1_716_223_456,
            &3999,
            &3500,
            &true,
            &String::from_str(&env, "bbox:phase4"),
            &String::from_str(&env, "report:phase4"),
            &String::from_str(&env, "openEO-SentinelHub"),
        );

        assert!(client.is_listing_buyable(&42));
    }
}
