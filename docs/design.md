# Latch Contracts — Design Spec

**Date:** 2026-05-26
**Scope:** The four Latch smart contracts + a full Foundry test suite.
**Out of scope (this spec):** Live X Layer deployment/verification, the read-only indexer backend, the frontend. Deploy scripts are written but running them against testnet is a later step.
**Source of truth:** [`Latch_PRD.md`](../../../../Latch_PRD.md) §4–§6.

---

## 1. Goal

Latch is a Uniswap v4 Hook that makes launch liquidity structurally un-ruggable: the creator cannot remove launch liquidity before a public, onchain release schedule. An early or oversized withdrawal **reverts**. Liquidity unlocks stepwise on a vesting schedule, so no single moment empties the pool. A registry lets buyers verify a pool is Latch-locked before they buy, and a launcher stands the whole thing up in one transaction.

The single defensible claim: **the pool you can't pull liquidity from.** Every rule is enforced from pure pool state, every break attempt is a visible failed transaction, and there is no admin key.

## 2. Foundation

Base the project on Uniswap's official **`v4-template`** (Foundry). It vendors `v4-core` + `v4-periphery` as git submodules and ships `BaseHook`, `HookMiner`, and the `Deployers` test harness that deploys a local `PoolManager`. This is the idiomatic stack named in the PRD and the only way to prove the hook against *real* v4 mechanics (what the AI judge inspects).

- **Solidity:** 0.8.26
- **Deps:** `v4-core`, `v4-periphery`, `forge-std`, OpenZeppelin (ERC-20)
- **Standards:** NatSpec on every public/external function; events on every meaningful state change; checks-effects-interactions; no admin key; immutable config.
- **Home:** the `backend/` directory, tracking the `backend` branch of `treasure567/latch`.

## 3. Contracts

### 3.1 `LatchHook.sol` (~140 LOC) — the lock

Inherits `BaseHook`.

**Permissions (`getHookPermissions`):** `beforeRemoveLiquidity = true` only. All others false. We deliberately do **not** enable any swap-fee path — Latch is not a fee hook. (Refined from the original draft: `afterInitialize` is dropped — enabling its flag would force an `_afterInitialize` implementation or pool init reverts, and the schedule is written via an explicit `setSchedule` call after seeding anyway. A single-flag hook is the smallest auditable surface and the simplest CREATE2 mining.)

**Storage:**
```solidity
struct Schedule {
    uint64  cliffTime;     // unix ts; nothing releasable before this
    uint64  periodLength;  // seconds per vesting step
    uint32  periodsCount;  // number of equal steps to reach 100%
    address creator;       // who locked (recorded for transparency, not for privilege)
    uint256 totalLocked;   // declared locked liquidity units the schedule governs
}
mapping(PoolId => Schedule) public schedules;
mapping(PoolId => uint256)  public removedSoFar; // cumulative liquidity removed
```

**`setSchedule(PoolKey key, Schedule s)`** — write-once per pool (revert `ScheduleExists` on second call). Validates `periodsCount > 0`, `periodLength > 0`, `totalLocked > 0`. Records `creator`. Emits `ScheduleSet`. Called by the launcher (or directly by a creator locking an externally-created pool). No admin key: once set, immutable.

> **Design note — why `setSchedule`, not `afterInitialize`:** a meaningful `totalLocked` is only known after liquidity is seeded, so the launcher writes the schedule through `setSchedule` immediately after seeding, within the same launch transaction. This makes `afterInitialize` unnecessary, so its flag stays off.

> **Design note — testability.** A hook revert is re-wrapped by v4 as `CustomRevert.WrappedError(hook, selector, reason, context)`, so a test cannot naively `expectRevert(RugBlocked.selector)`. The gating *decision* is therefore exposed as public views (`releasedAmount`, `wouldExceedLock`) and unit-tested exactly; the integration tests (removal through a real router) assert that a blocked attempt reverts and an allowed one succeeds.

**`releasedAmount(PoolId, uint256 timestamp) → uint256`** (pure-ish view):
- `timestamp < cliffTime` → `0`
- else `periodsElapsed = (timestamp - cliffTime) / periodLength`; `stepped = min(periodsElapsed, periodsCount)`; return `totalLocked * stepped / periodsCount`.
- **Stepwise**, not linear: 0% at the cliff instant, then a full step unlocks at each `periodLength` past the cliff, reaching `totalLocked` after `periodsCount` steps. Reads cleanly in the demo's "fast-forward past a step" beat.

**`_beforeRemoveLiquidity(sender, key, params, hookData)`** (override; `params.liquidityDelta < 0` for a removal):
1. `removeAmount = uint256(-params.liquidityDelta)`.
2. If no schedule set for the pool → pass through (pool isn't Latch-governed). *(See open question Q1.)*
3. `allowed = releasedAmount(poolId, block.timestamp)`.
4. **Check:** `require(removedSoFar[poolId] + removeAmount <= allowed, RugBlocked(removeAmount, removedSoFar[poolId], allowed))`.
5. **Effect:** `removedSoFar[poolId] += removeAmount`.
6. Emit `LiquidityReleased(poolId, removeAmount, removedSoFar[poolId], allowed)`.
7. Return the selector.

Gating is pure state with no identity/oracle check, so it fires regardless of who calls or owns the position — transferring the LP position does not help. Because the storage write is part of the same transaction, if core removal later reverts the increment rolls back too (transactionally safe under checks-effects).

> **Design note — `RugBlocked` is a custom *error*, not an event.** A reverting transaction rolls back its logs, so an "event" emitted on a blocked rug would never persist. The visible onchain artifact of a blocked rug is the **failed transaction carrying the `RugBlocked` revert reason** — that is what the explorer and the AI judge see. The PRD wording ("emits `RugBlocked`") conflates the two; we implement it correctly as a revert error.

**Events:** `ScheduleSet`, `LiquidityReleased`. **Errors:** `RugBlocked`, `ScheduleExists`, `InvalidSchedule`.

### 3.2 `LatchRegistry.sol` (~90 LOC) — verify before you buy

Onchain directory of Latch-locked pools, readable by anyone.

**Storage:** `mapping(PoolId => RegistryEntry)` where `RegistryEntry { bool verified; address hook; Schedule schedule; address token0; address token1; }`.

- **`register(PoolId id, address hook, Schedule schedule, address token0, address token1)`** — records the entry, sets `verified = true`, emits `PoolVerified(id, hook, creator)`. Idempotent guard: revert `AlreadyRegistered` on duplicate.
- **`isVerified(PoolId) → bool`**.
- **`getEntry(PoolId) → RegistryEntry`** — exposes release terms to the frontend.

"Verified" in this contract means: locked under a public schedule via the canonical Latch hook (PRD Verified layer 1) and, for launcher pools, launched through the fixed-supply `DemoToken` template (layer 2). Layer 3 (creator-allocation vesting) is a documented stretch, not in this build.

### 3.3 `LatchLauncher.sol` (~120 LOC) — one transaction

**`launch(LaunchParams) → (PoolId, address token)`** does, atomically:
1. Deploy `DemoToken` (fixed supply minted to launcher, then provisioned for seeding).
2. Initialize the pool on `PoolManager` with the Latch hook and the given `PoolKey`.
3. Seed liquidity via v4 `modifyLiquidity` (through the unlock callback / periphery router used in the v4-template test setup).
4. `hook.setSchedule(key, schedule)` with `totalLocked` = the seeded liquidity.
5. `registry.register(...)`.
6. Emit `PoolLaunched(poolId, token, creator)`.

The hook address is supplied to the launcher (mined with `HookMiner` at deploy time); the launcher itself is hook-agnostic, taking the canonical hook address as a constructor arg.

### 3.4 `DemoToken.sol` (~40 LOC) — the safe asset

Standard OpenZeppelin ERC-20. Fixed supply minted once at construction. **No** mint function, **no** blacklist, **no** pause, **no** owner dump privileges. This is what makes the lock meaningful (a malicious token would defeat any LP lock).

## 4. Events & errors (onchain evidence map)

| Signal | Type | Where | Proves |
|---|---|---|---|
| `PoolLaunched` | event | Launcher | one-tx launch happened |
| `PoolVerified` | event | Registry | pool is Latch-verified |
| `ScheduleSet` | event | Hook | lock terms written, immutable |
| `LiquidityReleased` | event | Hook | a vested removal was allowed |
| `RugBlocked` | **error** (revert) | Hook | a premature/oversized rug attempt failed visibly |

## 5. Test plan (Foundry — the deliverable)

Use the v4-template `Deployers` harness (real local `PoolManager`). Test files mirror contracts.

**Schedule math (`LatchSchedule.t.sol` / within hook tests):**
- before cliff → 0
- exactly at cliff → 0
- after 1 period → `totalLocked/periodsCount`
- mid-period (no new step) → previous step amount (stepwise, not linear)
- at/after `periodsCount` periods → `totalLocked` (caps, never exceeds)
- fuzz: `releasedAmount` monotonic non-decreasing in time and never `> totalLocked`

**Hook (`LatchHook.t.sol`):**
- remove before cliff → reverts `RugBlocked`
- remove more than released after partial vest → reverts `RugBlocked`
- remove exactly the vested portion → succeeds; emits `LiquidityReleased`
- cumulative cap across multiple partial removals → second removal that would exceed `allowed` reverts
- full removal after schedule completes → succeeds
- gating independent of caller: a different `sender` / post-transfer position is still gated
- `setSchedule` twice → reverts `ScheduleExists`; invalid params → `InvalidSchedule`
- removal on a pool with no schedule → passes through

**Registry (`LatchRegistry.t.sol`):**
- `register` then `isVerified` true; `getEntry` returns terms; emits `PoolVerified`
- duplicate register → reverts `AlreadyRegistered`

**Launcher (`LatchLauncher.t.sol`):**
- end-to-end `launch`: token deployed (fixed supply, no mint), pool initialized with hook, liquidity seeded, schedule written with `totalLocked` = seeded amount, registry shows verified; emits `PoolLaunched`
- post-launch rug attempt on the launched pool reverts `RugBlocked` (integration proof)

**DemoToken (`DemoToken.t.sol`):**
- fixed supply, no mint path, transfers work

**Quality bar:** `forge build` clean (no warnings we introduced), `forge test -vvv` all green, `forge fmt` applied, NatSpec on every function, gas snapshot captured for the removal path.

## 6. Open questions (resolve during implementation)

- **Q1 — pass-through vs revert for un-scheduled pools.** Current design: a pool with no schedule passes through (the hook only governs pools that opted in via `setSchedule`). Alternative: revert if a pool uses the Latch hook but has no schedule. Leaning pass-through for composability; will confirm against v4 init flow.
- **Q2 — exact liquidity-seeding path in the launcher.** v4 requires `modifyLiquidity` via the `unlock` callback. Decide between using the periphery `PositionManager` vs a minimal in-launcher unlock callback. Pick whichever keeps the surface small and the test deterministic.
- **Q3 — units of `totalLocked`/`removeAmount`.** v4 `liquidityDelta` is in liquidity units (L), not token amounts. The schedule governs L. Confirm this reads sensibly for the registry display (may surface both L and an approximate token value later).

## 7. Risks

- **Hook address flags** — the deployed hook address must encode the enabled callbacks. Handled at deploy time with `HookMiner`; tests use the template's `deployCodeTo`/flag helpers so the test address carries the right flags. (Out of this spec's run scope but the test harness must respect it.)
- **v4 API drift** — pin submodule commits from the template; read the actual vendored interfaces rather than coding signatures from memory.
- **`totalLocked` is declared, not measured** — closes via the launcher always setting it to the actually-seeded amount; externally-locked pools display the declared value and are marked lock-only, not Verified (per PRD).
