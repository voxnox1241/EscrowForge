#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, String, Vec,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum StageStatus {
    Secured,
    Disbursed,
    Returned,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowStage {
    pub label: String,
    pub value: i128,
    pub state: StageStatus,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ForgeDeal {
    pub creator: Address,
    pub provider: Address,
    pub token_address: Address,
    pub stages: Vec<EscrowStage>,
    pub is_aborted: bool,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum StorageKey {
    Deal(u64),
    SequenceId,
}

const TTL_THRESHOLD: u32 = 518_400; // ~30 days of ledgers
const TTL_EXTEND_TO: u32 = 1_036_800; // ~60 days of ledgers

fn read_deal(env: &Env, id: u64) -> ForgeDeal {
    let key = StorageKey::Deal(id);
    let deal: ForgeDeal = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| panic!("deal not found"));
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    deal
}

fn write_deal(env: &Env, id: u64, deal: &ForgeDeal) {
    let key = StorageKey::Deal(id);
    env.storage().persistent().set(&key, deal);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn increment_sequence(env: &Env) -> u64 {
    let id: u64 = env
        .storage()
        .persistent()
        .get(&StorageKey::SequenceId)
        .unwrap_or(0);
    env.storage()
        .persistent()
        .set(&StorageKey::SequenceId, &(id + 1));
    env.storage()
        .persistent()
        .extend_ttl(&StorageKey::SequenceId, TTL_THRESHOLD, TTL_EXTEND_TO);
    id
}

#[contract]
pub struct EscrowForgeContract;

#[contractimpl]
impl EscrowForgeContract {
    /// Creator initiates an agreement: transfers the FULL sum of all stage
    /// amounts from creator into this contract's custody (inter-contract
    /// call: token.transfer(creator, contract_address, total)).
    pub fn forge_deal(
        env: Env,
        creator: Address,
        provider: Address,
        token_address: Address,
        stages: Vec<(String, i128)>,
    ) -> u64 {
        creator.require_auth();

        if stages.len() < 2 || stages.len() > 3 {
            panic!("must have 2 to 3 milestones");
        }
        if creator == provider {
            panic!("client and freelancer must differ");
        }

        let mut total: i128 = 0;
        let mut stored: Vec<EscrowStage> = Vec::new(&env);
        for (label, value) in stages.iter() {
            if value <= 0 {
                panic!("milestone amount must be positive");
            }
            total += value;
            stored.push_back(EscrowStage {
                label,
                value,
                state: StageStatus::Secured,
            });
        }

        // Inter-contract call: move the full total into escrow custody.
        token::Client::new(&env, &token_address).transfer(
            &creator,
            &env.current_contract_address(),
            &total,
        );

        let id = increment_sequence(&env);
        let deal = ForgeDeal {
            creator,
            provider,
            token_address,
            stages: stored,
            is_aborted: false,
            timestamp: env.ledger().timestamp(),
        };
        write_deal(&env, id, &deal);

        env.events().publish(
            (symbol_short!("forge"), symbol_short!("initiated")),
            (id, deal.creator.clone(), deal.provider.clone(), total),
        );
        id
    }

    /// Creator disburses stage `index`: inter-contract call
    /// token.transfer(contract_address, provider, amount).
    pub fn disburse_stage(env: Env, id: u64, index: u32) {
        let mut deal = read_deal(&env, id);
        deal.creator.require_auth();

        if deal.is_aborted {
            panic!("escrow is cancelled");
        }
        if index >= deal.stages.len() {
            panic!("milestone index out of range");
        }
        let mut stage = deal.stages.get(index).unwrap();
        if stage.state != StageStatus::Secured {
            panic!("milestone is not locked");
        }

        // Inter-contract call: pay the provider from escrow custody.
        token::Client::new(&env, &deal.token_address).transfer(
            &env.current_contract_address(),
            &deal.provider,
            &stage.value,
        );

        let value = stage.value;
        stage.state = StageStatus::Disbursed;
        deal.stages.set(index, stage);
        write_deal(&env, id, &deal);

        env.events().publish(
            (symbol_short!("forge"), symbol_short!("disbursed")),
            (id, index, value),
        );
    }

    /// Creator cancels the agreement: every still-Secured stage is refunded
    /// to the creator and marked Returned. Disbursed stages untouched.
    pub fn abort_deal(env: Env, id: u64) {
        let mut deal = read_deal(&env, id);
        deal.creator.require_auth();

        if deal.is_aborted {
            panic!("escrow already cancelled");
        }

        let mut refunded_total: i128 = 0;
        let mut updated: Vec<EscrowStage> = Vec::new(&env);
        for stage in deal.stages.iter() {
            if stage.state == StageStatus::Secured {
                refunded_total += stage.value;
                updated.push_back(EscrowStage {
                    label: stage.label.clone(),
                    value: stage.value,
                    state: StageStatus::Returned,
                });
            } else {
                updated.push_back(stage);
            }
        }
        if refunded_total == 0 {
            panic!("nothing to refund");
        }

        // Inter-contract call: refund secured funds to the creator.
        token::Client::new(&env, &deal.token_address).transfer(
            &env.current_contract_address(),
            &deal.creator,
            &refunded_total,
        );

        deal.stages = updated;
        deal.is_aborted = true;
        write_deal(&env, id, &deal);

        env.events().publish(
            (symbol_short!("forge"), symbol_short!("aborted")),
            (id, refunded_total),
        );
    }

    pub fn fetch_deal(env: Env, id: u64) -> ForgeDeal {
        read_deal(&env, id)
    }

    pub fn fetch_payout_progress(env: Env, id: u64) -> (i128, i128) {
        let deal = read_deal(&env, id);
        let mut disbursed: i128 = 0;
        let mut secured: i128 = 0;
        for stage in deal.stages.iter() {
            match stage.state {
                StageStatus::Disbursed => disbursed += stage.value,
                StageStatus::Secured => secured += stage.value,
                StageStatus::Returned => {}
            }
        }
        (disbursed, secured)
    }

    pub fn total_deals_count(env: Env) -> u64 {
        env.storage()
            .persistent()
            .get(&StorageKey::SequenceId)
            .unwrap_or(0)
    }
}

mod test;
