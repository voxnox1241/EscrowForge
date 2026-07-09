#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    vec, Address, Env, String,
};

struct Setup<'a> {
    env: Env,
    creator: Address,
    provider: Address,
    token_addr: Address,
    token: TokenClient<'a>,
    escrow: EscrowForgeContractClient<'a>,
    contract_addr: Address,
}

fn setup(env: &Env) -> Setup<'_> {
    env.mock_all_auths();

    let admin = Address::generate(env);
    let creator = Address::generate(env);
    let provider = Address::generate(env);

    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_addr = sac.address();
    let token = TokenClient::new(env, &token_addr);
    let token_admin = StellarAssetClient::new(env, &token_addr);
    token_admin.mint(&creator, &10_000_i128);

    let contract_addr = env.register(EscrowForgeContract, ());
    let escrow = EscrowForgeContractClient::new(env, &contract_addr);

    Setup {
        env: env.clone(),
        creator,
        provider,
        token_addr,
        token,
        escrow,
        contract_addr,
    }
}

fn three_stages(env: &Env) -> Vec<(String, i128)> {
    vec![
        env,
        (String::from_str(env, "Design mockups"), 1000_i128),
        (String::from_str(env, "Build frontend"), 1500_i128),
        (String::from_str(env, "Deploy & handover"), 2500_i128),
    ]
}

#[test]
fn test_forge_deal_locks_total() {
    let env = Env::default();
    let s = setup(&env);

    let id = s
        .escrow
        .forge_deal(&s.creator, &s.provider, &s.token_addr, &three_stages(&env));

    assert_eq!(id, 0);
    assert_eq!(s.token.balance(&s.contract_addr), 5000);
    assert_eq!(s.token.balance(&s.creator), 5000);

    let data = s.escrow.fetch_deal(&id);
    assert_eq!(data.creator, s.creator);
    assert_eq!(data.provider, s.provider);
    assert_eq!(data.stages.len(), 3);
    assert_eq!(data.stages.get(0).unwrap().value, 1000);
    assert_eq!(data.stages.get(0).unwrap().state, StageStatus::Secured);
    assert!(!data.is_aborted);
    assert_eq!(s.escrow.total_deals_count(), 1);
    assert_eq!(s.escrow.fetch_payout_progress(&id), (0, 5000));
}

#[test]
fn test_disburse_pays_correct_amount() {
    let env = Env::default();
    let s = setup(&env);

    let id = s
        .escrow
        .forge_deal(&s.creator, &s.provider, &s.token_addr, &three_stages(&env));

    assert_eq!(s.token.balance(&s.provider), 0);
    s.escrow.disburse_stage(&id, &0);
    // Real inter-contract effect: provider received exactly stage 0.
    assert_eq!(s.token.balance(&s.provider), 1000);
    assert_eq!(s.token.balance(&s.contract_addr), 4000);

    let data = s.escrow.fetch_deal(&id);
    assert_eq!(data.stages.get(0).unwrap().state, StageStatus::Disbursed);
    assert_eq!(s.escrow.fetch_payout_progress(&id), (1000, 4000));
}

#[test]
fn test_disburse_requires_creator_auth() {
    let env = Env::default();
    let s = setup(&env);

    let id = s
        .escrow
        .forge_deal(&s.creator, &s.provider, &s.token_addr, &three_stages(&env));

    // Drop auth mocking: unauthenticated disburse must fail.
    s.env.set_auths(&[]);
    let result = s.escrow.try_disburse_stage(&id, &0);
    assert!(result.is_err());
}

#[test]
#[should_panic(expected = "milestone is not locked")]
fn test_double_disburse_fails() {
    let env = Env::default();
    let s = setup(&env);

    let id = s
        .escrow
        .forge_deal(&s.creator, &s.provider, &s.token_addr, &three_stages(&env));

    s.escrow.disburse_stage(&id, &0);
    s.escrow.disburse_stage(&id, &0);
}

#[test]
fn test_abort_refunds_only_secured() {
    let env = Env::default();
    let s = setup(&env);

    let id = s
        .escrow
        .forge_deal(&s.creator, &s.provider, &s.token_addr, &three_stages(&env));

    s.escrow.disburse_stage(&id, &0);
    s.escrow.abort_deal(&id);

    // Creator refunded total minus disbursed stage 0: 5000 secured, 1000 disbursed.
    assert_eq!(s.token.balance(&s.creator), 5000 + 4000);
    assert_eq!(s.token.balance(&s.provider), 1000);
    assert_eq!(s.token.balance(&s.contract_addr), 0);

    let data = s.escrow.fetch_deal(&id);
    assert!(data.is_aborted);
    assert_eq!(data.stages.get(0).unwrap().state, StageStatus::Disbursed);
    assert_eq!(data.stages.get(1).unwrap().state, StageStatus::Returned);
    assert_eq!(data.stages.get(2).unwrap().state, StageStatus::Returned);
    assert_eq!(s.escrow.fetch_payout_progress(&id), (1000, 0));
}

#[test]
#[should_panic(expected = "nothing to refund")]
fn test_abort_with_nothing_secured_fails() {
    let env = Env::default();
    let s = setup(&env);

    let id = s.escrow.forge_deal(
        &s.creator,
        &s.provider,
        &s.token_addr,
        &vec![
            &env,
            (String::from_str(&env, "A"), 100_i128),
            (String::from_str(&env, "B"), 200_i128),
        ],
    );
    s.escrow.disburse_stage(&id, &0);
    s.escrow.disburse_stage(&id, &1);
    s.escrow.abort_deal(&id);
}

#[test]
#[should_panic(expected = "must have 2 to 3 milestones")]
fn test_forge_fails_one_stage() {
    let env = Env::default();
    let s = setup(&env);
    s.escrow.forge_deal(
        &s.creator,
        &s.provider,
        &s.token_addr,
        &vec![&env, (String::from_str(&env, "Only"), 100_i128)],
    );
}

#[test]
#[should_panic(expected = "must have 2 to 3 milestones")]
fn test_forge_fails_four_stages() {
    let env = Env::default();
    let s = setup(&env);
    s.escrow.forge_deal(
        &s.creator,
        &s.provider,
        &s.token_addr,
        &vec![
            &env,
            (String::from_str(&env, "A"), 100_i128),
            (String::from_str(&env, "B"), 100_i128),
            (String::from_str(&env, "C"), 100_i128),
            (String::from_str(&env, "D"), 100_i128),
        ],
    );
}

#[test]
#[should_panic(expected = "milestone amount must be positive")]
fn test_forge_fails_zero_value() {
    let env = Env::default();
    let s = setup(&env);
    s.escrow.forge_deal(
        &s.creator,
        &s.provider,
        &s.token_addr,
        &vec![
            &env,
            (String::from_str(&env, "A"), 0_i128),
            (String::from_str(&env, "B"), 100_i128),
        ],
    );
}

#[test]
#[should_panic(expected = "client and freelancer must differ")]
fn test_forge_fails_creator_is_provider() {
    let env = Env::default();
    let s = setup(&env);
    s.escrow.forge_deal(
        &s.creator,
        &s.creator,
        &s.token_addr,
        &vec![
            &env,
            (String::from_str(&env, "A"), 100_i128),
            (String::from_str(&env, "B"), 100_i128),
        ],
    );
}

#[test]
#[should_panic(expected = "escrow is cancelled")]
fn test_disburse_after_abort_fails() {
    let env = Env::default();
    let s = setup(&env);

    let id = s
        .escrow
        .forge_deal(&s.creator, &s.provider, &s.token_addr, &three_stages(&env));
    s.escrow.abort_deal(&id);
    s.escrow.disburse_stage(&id, &0);
}
