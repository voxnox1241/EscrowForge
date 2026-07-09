# 🛡️ EscrowForge — Translucent Milestone Escrow on Stellar Soroban

[![CI/CD](https://github.com/voxnox1241/EscrowForge/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/voxnox1241/EscrowForge/actions/workflows/ci.yml)
[![Stellar Testnet](https://img.shields.io/badge/Stellar-Testnet-7B61FF?logo=stellar&logoColor=white)](https://stellar.org)
[![Soroban](https://img.shields.io/badge/Soroban-SDK%20v25-orange?logo=rust&logoColor=white)](https://developers.stellar.org/docs/build/smart-contracts)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-22C55E.svg)](LICENSE)

<div align="center">

**Milestone-based escrow for client/provider payments on Stellar Testnet — funds locked in Soroban smart-contract custody and disbursed one stage at a time, with verifiable on-chain inter-contract transfers.**

### 🔗 [Live Demo → escrowforge.daisy-plop-curtsy.workers.dev](https://escrowforge.daisy-plop-curtsy.workers.dev/)

</div>

![EscrowForge landing page — glassmorphic identity](screenshots/desktop-landing.png)

## Live Demo

**<https://escrowforge.daisy-plop-curtsy.workers.dev/>** — deployed on Cloudflare Workers, wired to the real testnet contract. Connect Freighter (testnet), create an escrow deal, disburse stages, and watch the tracker fill live.

## Demo Video (1–2 minutes)

![EscrowForge Demo Walkthrough](screenshots/demo.gif)

---

## Project Description

EscrowForge is a premium, milestone-based escrow platform built on Stellar testnet. It enables clients (creators) to lock the full budget of a contract into an on-chain smart contract, segmented into 2–3 milestones for a provider. As project phases are completed, the creator disburses the locked stage amounts through a real, secure inter-contract call (Escrow -> Stellar Asset Contract) paying that phase's value to the provider. 

If the agreement is aborted early, all still-secured (locked) stages are returned on-chain to the creator, while already disbursed payments remain secure and untouched. The UI implements a soft, tactile, and luminous Glassmorphic design system to create a premium, clean visual experience.

---

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                     Next.js 14 Frontend                       │
│       (static export · Tailwind CSS · Glassmorphic UI)        │
│                                                               │
│   ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐   │
│   │  Dashboard  │  │ Create flow  │  │ Escrow workspace  │   │
│   │  (agreements)  (forge deal)   │  │ (tracker + feed)  │   │
│   └──────┬──────┘  └──────┬───────┘  └─────────┬─────────┘   │
└──────────┼────────────────┼────────────────────┼─────────────┘
           │   StellarWalletsKit (Freighter et al.)
           ▼                ▼                    ▼
┌───────────────────────────────────────────────────────────────┐
│              Soroban RPC · Stellar Testnet                    │
│                                                               │
│   ┌──────────────────────┐  inter-contract  ┌─────────────┐  │
│   │ EscrowForge Contract │      calls       │ Native XLM  │  │
│   │ [PENDING - Address]  │ ───────────────► │ SAC (token) │  │
│   │ forge / disburse /   │  token.transfer  │ CDLZ…CYSC   │  │
│   │ abort + events       │                  │             │  │
│   └──────────────────────┘                  └─────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart contracts | Rust + Soroban SDK v25 |
| Frontend | Next.js 14 (App Router), TypeScript 5, Static HTML Export |
| Styling | Tailwind CSS (tactile Glassmorphism Design System) |
| Animation | Framer Motion (glow backdrops & progress segment transitions) |
| Wallet | `@creit.tech/stellar-wallets-kit` v2.5 (Freighter primary) |
| Data fetching | SWR (5s polling of contract state + event filters) |
| Chain access | `@stellar/stellar-sdk` v16 (Soroban RPC + Horizon) |
| Deployment | Cloudflare Workers static assets (`wrangler.toml`) |
| CI/CD | GitHub Actions (contracts + frontend verification workflows) |
| Network | Stellar Testnet, funded via Friendbot |

---

## Smart Contracts (Testnet)

| Contract | Address | Stellar Expert Link |
|---|---|---|
| EscrowForge | `CDX6WKGBC4VQINRMWACSPZXDILBR6VQHA6TVJUBJUWG2JE5NBE2DJDJY` | [Stellar Expert (Testnet)](https://stellar.expert/explorer/testnet/contract/CDX6WKGBC4VQINRMWACSPZXDILBR6VQHA6TVJUBJUWG2JE5NBE2DJDJY) |
| Native XLM SAC (token) | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` | [Stellar Expert (Testnet)](https://stellar.expert/explorer/testnet/contract/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC) |

---

## Inter-Contract Calls

Every fund movement in EscrowForge is a real Soroban cross-contract invocation from the escrow contract to the Stellar Asset Contract (SAC) for native XLM, via the generated token client (`soroban_sdk::token::Client`):

*   `forge_deal` -> `token.transfer(creator, escrow_contract, total)` — pulls and locks the full budget into contract custody.
*   `disburse_stage` -> `token.transfer(escrow_contract, provider, amount)` — transfers the specified stage amount to the provider.
*   `abort_deal` -> `token.transfer(escrow_contract, creator, refunded_total)` — returns all still-secured stage balances to the creator.

On-chain proof:
*   `create_escrow` / `forge_deal` transaction: [`0085fedea2a723147d2c7bf0078b8d13d73440270beedd6b0d6e4f99853bfeb6`](https://stellar.expert/explorer/testnet/tx/0085fedea2a723147d2c7bf0078b8d13d73440270beedd6b0d6e4f99853bfeb6)
*   `release_milestone` / `disburse_stage` transaction: [`2a50b421c56d9fbb877ba659ea46b36b0ab85b10b598c3518f3d864ff7e1935d`](https://stellar.expert/explorer/testnet/tx/2a50b421c56d9fbb877ba659ea46b36b0ab85b10b598c3518f3d864ff7e1935d)
*   `cancel_escrow` / `abort_deal` transaction: [`f68d96cb4218a3f77748ddea2058352fbb28563053b41704389c4ac546306e8e`](https://stellar.expert/explorer/testnet/tx/f68d96cb4218a3f77748ddea2058352fbb28563053b41704389c4ac546306e8e)

---

## Wallet Connection

Multi-wallet support is integrated using **StellarWalletsKit** (`@creit.tech/stellar-wallets-kit` v2.5). The connection trigger launches the kit's modal, allowing selection between Freighter, Albedo, xBull, Lobstr, and hardware wallets. 

Upon connection, the header dynamically fetches and displays the connected account's public key (truncated) and native XLM balance (polled from Horizon). Disconnection clears the active session and resets state variables safely.

---

## Core Mechanics

*   **Decimal precision:** Amounts are processed and stored as raw `i128` integers in **stroops** ($1\text{ XLM} = 10^7\text{ stroops}$).
*   **Segmented tracking:** An escrow deal contains 2 to 3 distinct stages. Each stage is tracked through three states: `Secured`, `Disbursed`, or `Returned`.
*   **Progress math:** On-chain progress indicators are calculated dynamically by `fetch_payout_progress`:
    $$\text{disbursed\_total} = \sum \text{value} \quad \text{where state} == \text{Disbursed}$$
    $$\text{secured\_total} = \sum \text{value} \quad \text{where state} == \text{Secured}$$
*   **On-chain validation:** The contract enforces constraints (panicking with clear messages): between 2 and 3 stages only, all values $> 0$, creator $\neq$ provider, no double disbursals, no disbursement after aborting, and aborting requires at least one remaining secured stage.

---

## Error Handling

The application implements three distinct, custom-designed user-facing error states:
1.  **Wallet not found** (`error / no. 01`) — triggered if no browser wallet extension is active. Displays a clear warning card with instructions and a link to install Freighter.
2.  **Rejected signature** (`error / no. 02`) — triggered if the user rejects a transaction signing request. Displays a gentle warning informing the user that assets are untouched, with a retry button.
3.  **Insufficient balance** (`error / no. 03`) — pre-flight verification comparing the total deposit amount plus $2\text{ XLM}$ fee headroom against the user's current wallet balance. Displays a shortfall banner preventing submission if funds are insufficient.

---

## Screenshots

**Desktop landing — glassmorphic visual identity**

![Desktop landing page](screenshots/desktop-landing.png)

**Create Deal Form**

![Create deal form](screenshots/create-form.png)

**Escrow Detail**

![Escrow detail workspace](screenshots/escrow-detail.png)

**Mobile UI (390px)**

![Mobile landing at 390px](screenshots/mobile-landing-390px.png)


**Connected state + XLM balance**

![Wallet connected with XLM balance](screenshots/wallet-connected-balance.png)

**Live activity feed**

`PENDING — Take and place screenshot showing disbursed milestone cards plus the Activity Feed polling real contract events`

**CI/CD run**

![CI checks all passing](screenshots/ci-all-checks-green.png)

**Test output**

![cargo test output from CI](screenshots/cargo-test-output.png)

---

## Setup Instructions

```bash
# 1. Clone the project
git clone <your-escrowforge-repo-url> && cd escrowforge

# 2. Smart Contracts Workspace
cd contracts/escrowforge
cargo test                 # runs the 11 unit tests

# (Optional) Deploy to Testnet
stellar contract build
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/escrowforge.wasm \
  --source <your-alias> \
  --network testnet

# 3. Frontend App
cd ../../frontend
cp .env.example .env.local  # configure your NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS here
npm ci
npm run dev                # starts local dev server at http://localhost:3000
```

---

## Testing

### Contract Unit Tests
11 passing unit tests in Rust with assertions verifying custody transfers, authorization barriers, and refund distributions:
```
running 11 tests
test test::test_forge_fails_one_stage - should panic ... ok
test test::test_forge_fails_zero_value - should panic ... ok
test test::test_forge_fails_creator_is_provider - should panic ... ok
test test::test_forge_fails_four_stages - should panic ... ok
test test::test_disburse_after_abort_fails - should panic ... ok
test test::test_disburse_requires_creator_auth ... ok
test test::test_forge_deal_locks_total ... ok
test test::test_abort_with_nothing_secured_fails - should panic ... ok
test test::test_double_disburse_fails - should panic ... ok
test test::test_disburse_pays_correct_amount ... ok
test test::test_abort_refunds_only_secured ... ok

test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.18s
```

### Frontend Unit Tests
Frontend testing covers config utils and error message translators:
```
 Test Files  2 passed (2)
      Tests  14 passed (14)
```
Run tests yourself:
*   Contracts: `cd contracts/escrowforge && cargo test`
*   Frontend: `cd frontend && npm test`

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
