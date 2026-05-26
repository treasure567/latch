# Latch — Contracts

**The pool you can't rug.**

A Uniswap v4 Hook that locks launch liquidity onchain so the creator physically cannot pull it. Not a fee — a revert. A premature or oversized liquidity removal reverts; liquidity unlocks gradually on a public, immutable schedule. A registry lets buyers verify a pool is Latch-locked before they buy.

Built for the X Layer BuildX / Hook the Future hackathon. See [`../Latch_PRD.md`](../Latch_PRD.md) for the full product spec, and [`docs/design.md`](docs/design.md) / [`docs/implementation-plan.md`](docs/implementation-plan.md) for the design and implementation plan.

## Contracts

| Contract | Role |
|---|---|
| [`src/LatchHook.sol`](src/LatchHook.sol) | The lock. A `beforeRemoveLiquidity`-only v4 hook that reverts (`RugBlocked`) any cumulative removal exceeding the schedule's released amount. Pure-state enforcement — no oracle, no identity check, no admin key. |
| [`src/LatchRegistry.sol`](src/LatchRegistry.sol) | Verify-before-you-buy directory of Latch-locked pools, with their release terms readable onchain. Emits `PoolVerified`. |
| [`src/LatchLauncher.sol`](src/LatchLauncher.sol) | One-transaction launch: deploy token, init pool with the hook, seed liquidity, write the schedule, list in the registry. Emits `PoolLaunched`. |
| [`src/DemoToken.sol`](src/DemoToken.sol) | Fixed-supply ERC-20. No mint, no blacklist, no pause, no owner privileges — a malicious token would defeat any LP lock. |
| [`src/libraries/LatchTypes.sol`](src/libraries/LatchTypes.sol) | The `Schedule` struct. |
| [`src/libraries/LatchMath.sol`](src/libraries/LatchMath.sol) | Stepwise vesting math (`releasedAmount`). |

### The guarantee

A pool's `Schedule` (`cliffTime`, `periodLength`, `periodsCount`, `creator`, `totalLocked`) is written once via `setSchedule` and is then immutable. `releasedAmount(t)` is `0` before the cliff, then unlocks one equal step per `periodLength`, reaching `totalLocked` after `periodsCount` steps. On every removal the hook checks `removedSoFar + amount <= releasedAmount(now)` and reverts `RugBlocked` otherwise. Because the gate reads only pool state, transferring the LP position does not help.

> `RugBlocked` is a custom **error**, not an event: a reverting transaction rolls back its logs, so the visible onchain artifact of a blocked rug is the failed transaction carrying the `RugBlocked` revert reason.

## Build & test

Foundry, built on the [`v4-template`](https://github.com/uniswapfoundation/v4-template) stack (uniswap-hooks `BaseHook`, `v4-core`/`v4-periphery`, `hookmate`).

```bash
forge build
forge test -vvv
forge snapshot        # gas snapshot (see .gas-snapshot)
```

The test suite (26 tests) covers: schedule-math boundaries + fuzz; rug reverts before cliff and on oversized removals; vested-portion release; the cumulative cap across multiple removals; registry register/verify; and the end-to-end one-transaction launch producing a verified, locked pool. Tests run against a real local `PoolManager` via the template's `Deployers` harness.

## Deployment (X Layer mainnet)

Uniswap v4 is live on **X Layer mainnet (chainId 196)**; the `PoolManager` is `0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32` (confirmed onchain via `rpc.xlayer.tech`). v4 is **not** on X Layer testnet, so we deploy to mainnet. The hook address must encode the `BEFORE_REMOVE_LIQUIDITY` flag in its low bits; [`script/DeployLatch.s.sol`](script/DeployLatch.s.sol) mines it with `HookMiner` and deploys via CREATE2.

Dry-run (read-only, no key, no funds — validated against live mainnet state, ~0.0003 OKB est.):

```bash
forge script script/DeployLatch.s.sol --fork-url https://rpc.xlayer.tech
```

Broadcast for real (needs a deployer key funded with a little OKB):

```bash
export PRIVATE_KEY=0x...   # deployer with OKB for gas
forge script script/DeployLatch.s.sol \
  --rpc-url https://rpc.xlayer.tech \
  --private-key $PRIVATE_KEY --broadcast
```

Then verify on the OKLink explorer (`forge verify-contract`, OKLink verifier + API key).

Deployed and verified-wired on **X Layer mainnet (chainId 196)** on 2026-05-26:

| Contract | X Layer address |
|---|---|
| PoolManager (Uniswap v4) | [`0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32`](https://www.oklink.com/xlayer/address/0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32) |
| LatchHook | [`0xf856b2992612d55874cE2f8fB2cAb1B3a5Bf8200`](https://www.oklink.com/xlayer/address/0xf856b2992612d55874cE2f8fB2cAb1B3a5Bf8200) |
| LatchRegistry | [`0x5Af8F4928A776A7d656B873CF91B9614C8c23f86`](https://www.oklink.com/xlayer/address/0x5Af8F4928A776A7d656B873CF91B9614C8c23f86) |
| LatchLauncher | [`0x253B3520d8c75151F3c6EE02741e2f7DB2fF5c69`](https://www.oklink.com/xlayer/address/0x253B3520d8c75151F3c6EE02741e2f7DB2fF5c69) |

The hook address low 14 bits are `0x200` (exactly `BEFORE_REMOVE_LIQUIDITY`); `launcher.{poolManager,hook,registry}` confirmed onchain. Contracts not yet source-verified on the explorer (see below).
