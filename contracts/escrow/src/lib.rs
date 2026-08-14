#![no_std]

use soroban_sdk::{
    auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation},
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype,
    panic_with_error, token, vec, Address, Env, IntoVal, MuxedAddress, Symbol,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_payment_is_70_20_10() {
        let split = EscrowContract::split_payment(1_000_0000i128);
        assert_eq!(split.escrow_amount, 700_0000i128);
        assert_eq!(split.farmer_upfront, 200_0000i128);
        assert_eq!(split.treasury_amount, 100_0000i128);
    }
}

#[contractclient(name = "CropNftClient")]
pub trait CropNftContract {
    fn get_farmer(env: Env, nft_id: u64) -> Address;
    fn get_price(env: Env, nft_id: u64) -> i128;
    fn transfer_nft_by_escrow(env: Env, nft_id: u64, to: Address);
    fn set_status_by_verification(env: Env, nft_id: u64, status: CropStatus);
}

#[contractclient(name = "VerificationClient")]
pub trait VerificationContract {
    fn is_listing_buyable(env: Env, nft_id: u64) -> bool;
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
pub enum EscrowStatus {
    Reserved,
    Released,
    Refunded,
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

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    CropNftContract,
    VerificationContract,
    UsdcToken,
    Treasury,
    TreasuryPoolBalance,
    Position(u64),
}

#[contracterror]
#[derive(Clone, Copy, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum EscrowError {
    AlreadyInitialized = 1,
    Unauthorized = 2,
    PositionExists = 3,
    PositionMissing = 4,
    InvalidAmount = 5,
}

#[contractevent(topics = ["escrow", "reserved"])]
#[derive(Clone)]
pub struct EscrowReservedEvent {
    #[topic]
    pub nft_id: u64,
    #[topic]
    pub buyer: Address,
    pub total_price: i128,
}

#[contractevent(topics = ["escrow", "released"])]
#[derive(Clone)]
pub struct EscrowReleasedEvent {
    #[topic]
    pub nft_id: u64,
    pub released_amount: i128,
}

#[contractevent(topics = ["escrow", "refunded"])]
#[derive(Clone)]
pub struct EscrowRefundedEvent {
    #[topic]
    pub nft_id: u64,
    pub refund_amount: i128,
    pub treasury_compensation: i128,
}

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    pub fn __constructor(
        env: Env,
        admin: Address,
        crop_nft_contract: Address,
        verification_contract: Address,
        usdc_token: Address,
        treasury: Address,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, EscrowError::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::CropNftContract, &crop_nft_contract);
        env.storage()
            .instance()
            .set(&DataKey::VerificationContract, &verification_contract);
        env.storage()
            .instance()
            .set(&DataKey::UsdcToken, &usdc_token);
        env.storage().instance().set(&DataKey::Treasury, &treasury);
        env.storage()
            .instance()
            .set(&DataKey::TreasuryPoolBalance, &0i128);
    }

    pub fn buy_crop_nft(env: Env, buyer: Address, nft_id: u64) -> EscrowPosition {
        buyer.require_auth();

        let crop_nft_contract = Self::crop_nft_contract(&env);
        let verification_contract = Self::verification_contract(&env);
        let crop_client = CropNftClient::new(&env, &crop_nft_contract);
        let verification_client = VerificationClient::new(&env, &verification_contract);
        let farmer = crop_client.get_farmer(&nft_id);
        let total_price = crop_client.get_price(&nft_id);
        let is_buyable = verification_client.is_listing_buyable(&nft_id);

        if !is_buyable {
            panic_with_error!(&env, EscrowError::Unauthorized);
        }

        if total_price <= 0 {
            panic_with_error!(&env, EscrowError::InvalidAmount);
        }

        let position_key = DataKey::Position(nft_id);
        if env.storage().persistent().has(&position_key) {
            panic_with_error!(&env, EscrowError::PositionExists);
        }

        let split = Self::split_payment(total_price);
        let token_client = token::TokenClient::new(&env, &Self::usdc_token(&env));
        let current_contract = env.current_contract_address();
        let contract_destination = MuxedAddress::from(current_contract.clone());

        // Pull funds directly from the authenticated buyer. Using `transfer_from`
        // requires prior allowance setup; the walkthrough does not include that.
        token_client.transfer(&buyer, &contract_destination, &total_price);

        Self::authorize_token_transfer(&env, &current_contract, &farmer, split.farmer_upfront);
        let farmer_destination = MuxedAddress::from(farmer.clone());
        token_client.transfer(
            &current_contract,
            &farmer_destination,
            &split.farmer_upfront,
        );

        let pool_before = Self::treasury_pool_balance(&env);
        env.storage()
            .instance()
            .set(&DataKey::TreasuryPoolBalance, &(pool_before + split.treasury_amount));

        Self::authorize_crop_transfer(&env, &crop_nft_contract, nft_id, &buyer);
        crop_client.transfer_nft_by_escrow(&nft_id, &buyer);

        let position = EscrowPosition {
            nft_id,
            buyer: buyer.clone(),
            farmer,
            total_price,
            split,
            status: EscrowStatus::Reserved,
        };

        env.storage().persistent().set(&position_key, &position);
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

    pub fn release_escrow(env: Env, nft_id: u64) -> EscrowPosition {
        Self::require_verification(&env);
        let mut position = Self::load_position(&env, nft_id);
        let current_contract = env.current_contract_address();
        let token_client = token::TokenClient::new(&env, &Self::usdc_token(&env));

        Self::authorize_token_transfer(
            &env,
            &current_contract,
            &position.farmer,
            position.split.escrow_amount,
        );
        let farmer_destination = MuxedAddress::from(position.farmer.clone());
        token_client.transfer(
            &current_contract,
            &farmer_destination,
            &position.split.escrow_amount,
        );

        position.status = EscrowStatus::Released;

        env.storage()
            .persistent()
            .set(&DataKey::Position(nft_id), &position);
        EscrowReleasedEvent {
            nft_id,
            released_amount: position.split.escrow_amount,
        }
        .publish(&env);

        position
    }

    pub fn refund_after_disaster(
        env: Env,
        nft_id: u64,
        refund_amount: i128,
        treasury_compensation: i128,
    ) -> EscrowPosition {
        Self::require_verification(&env);
        let position = Self::load_position(&env, nft_id);

        if refund_amount < 0 || treasury_compensation < 0 {
            panic_with_error!(&env, EscrowError::InvalidAmount);
        }

        let current_contract = env.current_contract_address();
        let token_client = token::TokenClient::new(&env, &Self::usdc_token(&env));

        if refund_amount > 0 {
            Self::authorize_token_transfer(&env, &current_contract, &position.buyer, refund_amount);
            let buyer_destination = MuxedAddress::from(position.buyer.clone());
            token_client.transfer(&current_contract, &buyer_destination, &refund_amount);
        }

        if treasury_compensation > 0 {
            let pool = Self::treasury_pool_balance(&env);
            if treasury_compensation > pool {
                panic_with_error!(&env, EscrowError::InvalidAmount);
            }

            Self::authorize_token_transfer(
                &env,
                &current_contract,
                &position.buyer,
                treasury_compensation,
            );
            let buyer_destination = MuxedAddress::from(position.buyer.clone());
            token_client.transfer(&current_contract, &buyer_destination, &treasury_compensation);

            env.storage()
                .instance()
                .set(&DataKey::TreasuryPoolBalance, &(pool - treasury_compensation));
        }

        let updated = EscrowPosition {
            status: EscrowStatus::Refunded,
            ..position
        };

        env.storage()
            .persistent()
            .set(&DataKey::Position(nft_id), &updated);
        EscrowRefundedEvent {
            nft_id,
            refund_amount,
            treasury_compensation,
        }
        .publish(&env);

        updated
    }

    pub fn get_position(env: Env, nft_id: u64) -> EscrowPosition {
        Self::load_position(&env, nft_id)
    }

    pub fn get_treasury_pool_balance(env: Env) -> i128 {
        Self::treasury_pool_balance(&env)
    }

    fn load_position(env: &Env, nft_id: u64) -> EscrowPosition {
        env.storage()
            .persistent()
            .get(&DataKey::Position(nft_id))
            .unwrap_or_else(|| panic_with_error!(env, EscrowError::PositionMissing))
    }

    fn crop_nft_contract(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::CropNftContract)
            .unwrap_or_else(|| panic_with_error!(env, EscrowError::Unauthorized))
    }

    fn usdc_token(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::UsdcToken)
            .unwrap_or_else(|| panic_with_error!(env, EscrowError::Unauthorized))
    }

    fn verification_contract(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::VerificationContract)
            .unwrap_or_else(|| panic_with_error!(env, EscrowError::Unauthorized))
    }

    fn treasury_pool_balance(env: &Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TreasuryPoolBalance)
            .unwrap_or(0i128)
    }

    fn require_verification(env: &Env) {
        let verification_contract: Address = env
            .storage()
            .instance()
            .get(&DataKey::VerificationContract)
            .unwrap_or_else(|| panic_with_error!(env, EscrowError::Unauthorized));
        verification_contract.require_auth();
    }

    fn authorize_token_transfer(env: &Env, from: &Address, to: &Address, amount: i128) {
        env.authorize_as_current_contract(vec![
            env,
            InvokerContractAuthEntry::Contract(SubContractInvocation {
                context: ContractContext {
                    contract: Self::usdc_token(env),
                    fn_name: Symbol::new(env, "transfer"),
                    args: vec![
                        env,
                        from.clone().into_val(env),
                        to.clone().into_val(env),
                        amount.into_val(env),
                    ],
                },
                sub_invocations: vec![env],
            }),
        ]);
    }

    fn authorize_crop_transfer(env: &Env, crop_nft_contract: &Address, nft_id: u64, to: &Address) {
        env.authorize_as_current_contract(vec![
            env,
            InvokerContractAuthEntry::Contract(SubContractInvocation {
                context: ContractContext {
                    contract: crop_nft_contract.clone(),
                    fn_name: Symbol::new(env, "transfer_nft_by_escrow"),
                    args: vec![env, nft_id.into_val(env), to.clone().into_val(env)],
                },
                sub_invocations: vec![env],
            }),
        ]);
    }
}
