# Latch — Product Requirements Document

**The pool you can't rug.**

A Uniswap v4 Hook that locks launch liquidity onchain so the creator physically cannot pull it. Not a fee. A revert. Live on X Layer, with a public registry of pools proven safe to buy.

| | |
|---|---|
| **Hackathon** | X Layer BuildX / Hook the Future (X Layer × Uniswap × Flap) |
| **Build window** | May 22 to May 28, 2026. This plan covers the remaining May 25 to 28. |
| **Submission deadline** | May 28, 23:59 UTC (we submit by 12:00 UTC) |
| **Builder** | [your handle] |
| **Chain** | X Layer (OKX L2), testnet then mainnet |
| **Direction** | DeFi Hook. A structural anti-rug primitive on the v4 curve. |
| **Prize target** | First prize: 5,000 USDT + OKX PR support + cooperation + accelerator slot |

> **THE BET** — We watched the field. The visible submissions all do the same thing: they manipulate the swap fee to deter a dump. None of them stop the actual hard rug, the creator removing the liquidity and vanishing. Latch closes that vector structurally: a rug attempt reverts onchain. We are precise about scope — a lock alone does not stop a malicious token or a supply dump, so Latch Verified layers a safe-token launch template and allocation vesting on top, and we disclose what remains rather than claim foolproof. One claim a judge can repeat and we can defend: the pool you can't pull liquidity from, with a registry to verify before you buy.

---

## 1. Executive Summary

Latch is a Uniswap v4 Hook that makes a token launch structurally safe to buy into. Its single guarantee: the creator cannot remove the launch liquidity before a public, onchain release schedule. `beforeRemoveLiquidity` reverts any early or oversized withdrawal. Liquidity unlocks gradually on a vesting schedule, not all at once, so there is never a single moment where the whole pool can disappear.

Around that guarantee sits the product that makes it usable: **LatchRegistry**, an onchain directory of pools that are provably Latch-locked, and a verify-before-you-buy frontend that reads it. A buyer does not trust the founder. They check the registry and read the lock onchain. Every rule is enforced from pure pool state, every attempt to break it is a visible transaction, and there is no admin key. We submit by 12:00 UTC on May 28.

---

## 2. The Brief Decode

### Hackathon parameters

X Layer BuildX (Hook the Future) runs May 22 to May 28, 23:59 UTC. Prize pool 14,000 USDT. First prize 5,000 USDT plus OKX official PR support plus a cooperation opportunity, plus priority access to the X Layer Future Accelerator. The PR and accelerator slot outweigh the cash and should shape every decision. A rug-proof primitive is exactly the story those teams want to amplify.

### Competitive landscape (read May 26)

Multiple deployed submissions cluster in one lane: dynamic and decaying swap fees that respond to market conditions to deter snipers and dumps. That lane is now crowded. A second fee hook there blends in and reads as a port. Crucially, none of the visible entries lock liquidity, so the creator-rug vector is wide open. Latch takes the open lane.

### Hard disqualifiers (filter before judging)

- **Not built around a v4 Hook.** Solved: the product is hook logic in `beforeRemoveLiquidity`.
- **Not deployed on X Layer.** Solved: hook, registry, and launcher deployed and verified, with verifiable addresses in the submission.
- **No dedicated X account posting actively.** Solved: 24 posts across the remaining four days, tagging @XLayerOfficial, @Uniswap, @flapdotsh.
- **Existing project, no new dev.** Solved: all contract logic written during the event.

### Scoring criteria

| Criterion | How we win it | Risk if we lose it |
|---|---|---|
| **Innovation** | Structural anti-rug enforced inside the AMM, plus a graduated release schedule and a public verification registry. A different mechanism class from the fee hooks the field is shipping. | Read as one more fee hook. Mitigated by never touching the fee. |
| **Market potential** | Rugs are the number one reason buyers lose money on launches and the core pain of the asset-issuance space Flap lives in. The registry turns the guarantee into a buyer-facing product that drives launches and activity on X Layer. | Reads as niche infra. Mitigated by the registry as a demand surface. |
| **Completion** | Hook, registry, and launcher deployed and verified. Every rule triggered by real transactions. Clean repo with Foundry tests and NatSpec. | Empty or unverified contracts. The AI judge sees the gap. |
| **Demo video** | 90 seconds: a rug attempt reverting onchain, the graduated unlock, and a buyer verifying via the registry. | Bonus only, but easy points most teams skip. |

### Dual-track judging

AI and human judges score independently on onchain data, code quality, innovation, and market potential. The AI judge shapes how we ship: NatSpec on every function, Foundry tests, verified contracts, a readable README, structured commits across the days, and an event on every meaningful action so the chain itself proves each rule fired.

---

## 3. Wedge and Positioning

**They tax the dump. We make the rug revert.**

The crowded move in this hackathon is a fee that reacts to market conditions. That deters a dump economically: a determined seller simply pays the fee and dumps anyway. It does nothing about the larger betrayal, the creator pulling liquidity. Latch changes what the pool guarantees rather than what it charges.

| Fee hooks (the field) | Latch (the lock) |
|---|---|
| Economic deterrence. A dumper pays a high fee and proceeds. | Structural prevention. The removal transaction reverts. |
| Targets fast traders, not the founder. | Targets the actual rug vector: liquidity removal. |
| The creator can still remove liquidity and vanish. | Graduated release, public registry, no admin key. |

**Memory anchor for judges:** "the pool you can't rug." A fee hook is one of several this week. A rug-proof pool with a verification registry is a category of one, and it sits exactly where the sponsors point, since Flap is an asset-issuance protocol and X Layer wants real, safe launches.

---

## 4. The Product

One guarantee, one product surface, one launch path.

### The Guarantee — Locked Liquidity with Graduated Release

| Field | Detail |
|---|---|
| **Hooks into** | `beforeRemoveLiquidity` (with `beforeInitialize` / `afterInitialize` to register config) |
| **What it does** | Reverts any liquidity withdrawal that exceeds the cumulative amount released by the public schedule. |
| **Graduated release** | Liquidity vests in steps (for example 0% until cliff, then 25% per period) rather than a single unlock. No single moment empties the pool. |
| **Mechanism** | Compares the requested removal against `releasedFraction(block.timestamp)` derived from the stored schedule. Reverts if it would exceed it. |
| **Onchain output** | Every premature removal is a failed, visible transaction (`RugBlocked`). Each unlock emits `LiquidityReleased`. |
| **Bypass resistance** | Enforced from pure state. No oracle, no identity. Gating fires regardless of who owns the position, so transferring the LP position does not help. |

### The Product Surface — LatchRegistry (verify before you buy)

| Field | Detail |
|---|---|
| **What it is** | An onchain registry of pools that are provably Latch-locked, with their release schedules readable by anyone. |
| **Why it matters** | Turns the guarantee into something buyers use. "Latch Verified" means the liquidity is locked and the schedule is public. This is the demand surface none of the fee hooks have. |
| **What Verified means** | Three layers, not one: (1) LP locked under a public schedule via the canonical Latch hook; (2) token launched through Latch using a fixed-supply template with no mint, no blacklist, no owner dump privileges; (3) stretch: the creator's token allocation itself vested on a schedule. Layer 2 is what makes a lock meaningful, since a malicious token defeats any LP lock. |
| **Onchain output** | `PoolVerified` on registration. Frontend reads the registry directly. |

### The Launch Path — LatchLauncher (one transaction)

| Field | Detail |
|---|---|
| **What it does** | In one transaction: deploys or registers the token, initializes the pool with the Latch hook, seeds liquidity, writes the release schedule, and lists the pool in the registry. |
| **Why it matters** | A creator gets a verified, rug-proof pool without writing Solidity. Maps directly onto Flap-style issuance and makes the demo one click. |

> **Honest scope note (what Latch does and does not stop):** A liquidity lock closes exactly one rug vector, the hard liquidity pull. It does *not*, on its own, stop a supply dump (the creator selling a large token allocation into the pool), a malicious token (mint-and-dump, blacklist, pausable), or a dump on a second unprotected pool. This is why Verified is three layers: the safe-token template closes the malicious-token vector for launcher pools, and allocation vesting closes the supply dump. Second-venue dumps and unaudited-code risk remain, and we disclose them rather than claim foolproof. We also do not touch the swap fee; fee-based dump deterrence is a different, crowded approach and not our mechanism.

---

## 5. Architecture

Latch is onchain-first. Every guarantee is enforced inside the hook, so nothing off-chain sits in the trust path. The backend is a read-only surface that indexes the chain to power verification and the live feed.

### 5.1 Smart Contract Architecture

```
LAUNCH FLOW
  Creator --launch()--> LatchLauncher (one transaction)
                              |--> DemoToken (ERC-20)
                              |--> Pool on PoolManager (init + seed liquidity)
                              |--> LatchHook (write release schedule)
                              |--> LatchRegistry (list as Verified)

RUG ATTEMPT & BUYER FLOW
  Creator --removeLiquidity--> PoolManager --callback--> LatchHook (BaseHook)
                                                            beforeRemoveLiquidity:
                                                              if amount > releasedFraction(now): REVERT
                                                            graduated release:
                                                              allow only the vested portion
                                                            storage: mapping(PoolId => Schedule)
                              PoolManager --REVERT--> Creator
  Buyer ---------------------- verify before buy ----------------------> LatchRegistry (is this Verified?)
```

*Figure 1. Contract architecture. Launch (top): one transaction stands up token, pool, schedule, and registry listing. Below: a creator's early removal hits the hook and REVERTS; a buyer checks the registry before buying.*

| Contract | ~Lines | Role and key surface |
|---|---|---|
| `LatchHook.sol` | ~140 | Inherits `BaseHook`. Enforces the lock. `getHookPermissions`, `beforeRemoveLiquidity`, `afterInitialize`. Storage: `mapping(PoolId => Schedule)`. |
| `LatchRegistry.sol` | ~90 | Onchain directory. `register(poolId, schedule)`, `isVerified(poolId)`, view of release terms. Emits `PoolVerified`. |
| `LatchLauncher.sol` | ~120 | One-transaction factory. `launch(params)`: token, pool, schedule, registry listing. |
| `DemoToken.sol` | ~40 | Standard OpenZeppelin ERC-20, the launched asset for the demo. |

**Schedule struct:** `cliffTime`, `periodLength`, `periodsCount`, `creator`, `totalLocked`. `releasedFraction(now)` derives the allowed cumulative withdrawal. Stack: Solidity 0.8.26, Foundry, `v4-core` / `v4-periphery`, OpenZeppelin, NatSpec on every function.

**Hook permissions and address mining.** v4 encodes a hook's enabled callbacks in the low bits of its address. We mine a CREATE2 salt with `HookMiner` so the deployed address carries the `BEFORE_REMOVE_LIQUIDITY` and initialize flags. This is the most common v4 deployment gotcha, so we budget time on deploy day. We deliberately do not enable the swap-fee path; we are not a fee hook.

### 5.2 Backend Architecture

> **Honest framing:** the hook enforces the lock onchain with zero backend in the trust path. A pool stays rug-proof even if our servers are down. The backend is read-only. Its only job is to index the registry and lock events so the verify-before-you-buy frontend and the live "receipts" can read them.

```
X LAYER (ONCHAIN)                    OFF-CHAIN (READ-ONLY)
  LatchRegistry  ---events--->  Indexer  --->  Postgres (pools, schedules, events)
  LatchHook                    (RPC ws,        Redis (cache + pub/sub)
   emits:                       decode logs)        |
    PoolVerified                                     v
    RugBlocked                              Read-only API  --HTTP/WS-->  Next.js
    LiquidityReleased                         GET /verify/:pool           (verify before buy,
    PoolLaunched                              GET /registry                registry directory,
                                              GET /stats                   live receipts, launch)

  Writes (launch, buy, remove) go straight to the contracts from the user's wallet.
  The backend never holds keys, never signs, never custodies funds. It only reads the chain.
```

*Figure 2. Backend architecture. A one-directional read pipeline feeding the verify-before-you-buy frontend. Writes bypass the backend entirely.*

The hook and registry emit an event on each meaningful action (`PoolLaunched`, `PoolVerified`, `RugBlocked`, `LiquidityReleased`). That single choice does double duty: it powers the backend feed and gives the AI judge clean, greppable evidence that every rule fired. Components: an indexer subscribing to X Layer logs; Postgres for indexed pools, schedules, and the event log; Redis for cache and the live-feed pub/sub; and a read-only Fastify API exposing verification status and aggregate counts. None of it is required for a pool to stay rug-proof.

### 5.3 Frontend

A thin Next.js app with wallet connect (wagmi + OKX Wallet). The hero surface is the registry: search a pool or token, see Latch Verified status, the release schedule, and time to next unlock, read live from the chain. Secondary surfaces: a live receipts feed of blocked rugs and releases, and the one-transaction launch form. All writes go directly from the user's wallet to the contracts.

---

## 6. Rubric Mapping

| Rubric criterion | Our specific evidence |
|---|---|
| **Innovation** | Structural anti-rug via `beforeRemoveLiquidity`, graduated release, and an onchain verification registry. A different mechanism class from the fee hooks in the field. Not a port. |
| **Market potential** | Solves the top reason buyers lose money on launches. The registry is a buyer-facing demand surface. Sits in Flap's issuance lane; drives safe launches and activity on X Layer. |
| **Completion** | Hook, registry, and launcher deployed and verified. Every rule triggered by real transactions. Clean repo with tests. |
| **Code quality (AI judge)** | NatSpec on every function. Small, auditable surface. Foundry tests. Conventional commits across the days. |
| **Onchain verifiability (AI judge)** | Every rule produces a visible transaction or event. Verified contracts resolve in the block explorer. |

---

## 7. The Build Schedule (4 days)

| Day | Date | Contracts / build | Deploy / proof | Posts |
|---|---|---|---|---|
| 1 | Mon May 25 | Repo + Foundry scaffold. Confirm X Layer v4 PoolManager + RPC. `LatchHook` permissions stubbed. Schedule math (`releasedFraction`). | Testnet hello-deploy. | 6 |
| 2 | Tue May 26 | `beforeRemoveLiquidity` gating + graduated release. `LatchRegistry`. Foundry tests: rug reverts, vested portion releases, verify resolves. | Local test proof. | 6 |
| 3 | Wed May 27 | `LatchLauncher` one-tx launch. Mine hook address. Registry frontend (verify before buy). | Deploy + verify all contracts on X Layer. Capture the revert clip. | 6 |
| 4 | Thu May 28 | Final QA. README + addresses. Record 90-sec demo. | Submit Google Form by 12:00 UTC. | 6 |

*Front-load the critical path: a deployed, verified hook whose rug attempt reverts is a complete submission by end of Day 3. The registry frontend and launcher are the differentiators layered on top.*

---

## 8. In Scope / Out of Scope

| In scope | Out of scope |
|---|---|
| Locked liquidity via `beforeRemoveLiquidity` | Any swap-fee manipulation (the crowded lane; not our mechanism) |
| Graduated release schedule | Volatility or circuit-breaker fees |
| LatchRegistry, onchain verification | Sniper / anti-bot buy throttling |
| Verify-before-you-buy frontend | Per-buyer sell vesting (different problem) |
| One-transaction LatchLauncher | Bonding-curve / graduation mechanics |
| X Layer deploy + contract verification | Cross-chain deployment |
| X account, 24 posts tagging all three sponsors | Naming or attacking other hackathon entries |
| Clean repo, Foundry tests, NatSpec, events | Price oracle (not needed) |
| Honest claim discipline | Upgradeable / admin-keyed hook (immutable is the trust signal) |

---

## 9. Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Judges pattern-match us to the fee hooks | Medium | We never touch the fee, and say so. The contrast ("tax the dump vs revert the rug") is the headline of every surface. |
| Creator seeds a second, unprotected pool | High | Out of hook scope by design. The registry is the answer: buyers transact through the verified pool. Stated openly. |
| Malicious token defeats the lock (open mint, blacklist) | High | Verified pools launch through Latch with a safe fixed-supply template, so the token cannot mint or block transfers. Externally-created pools are marked lock-only, not Verified. |
| Supply dump: creator sells a large token allocation | Medium | The lock does not stop this. Mitigation: creator-allocation vesting (stretch) and disclosing allocation in the registry so buyers see it before buying. |
| Bug in the hook (reentrancy, arithmetic, access control) | Medium | Small auditable surface, Foundry tests, no admin key, follow checks-effects. Disclosed as unaudited hackathon code, not "foolproof." |
| Hook address mining eats time | Medium | Do it Day 3 with `HookMiner`. Keep a Day 4 buffer. |
| Wrong or changed v4 addresses on X Layer | Medium | Confirm from official docs Day 1. Never hardcode from memory. |
| Locked LPs cannot exit during the schedule | Low | Intended: the launch seed is locked to guarantee a market. The schedule and terms are public before anyone buys. |
| Demo fails live | Low | Pre-record the revert Day 3 to 4. Never demo cold. |
| Submission form fails near deadline | Medium | Submit by 12:00 UTC. 11.5 hours buffer. Pre-fill the form. |

---

## 10. Demo Video Plan (90 seconds)

| Time | Beat |
|---|---|
| 0:00 - 0:10 | Cold open. "Everyone's taxing the dump. Nobody's stopping the rug. We did." Title card. |
| 0:10 - 0:25 | Wedge. A fee deters a dumper who pays it anyway. The real rug is the creator pulling liquidity. Latch gates that. |
| 0:25 - 0:45 | Launch. One-tx launch on X Layer. The pool appears in the registry as Latch Verified, schedule visible. |
| 0:45 - 1:05 | Try to rug. The creator attempts to remove liquidity before the schedule allows. Transaction reverts. Show it in the explorer. |
| 1:05 - 1:20 | Graduated release. Fast-forward past a vesting step; the allowed portion releases, the rest stays locked. |
| 1:20 - 1:30 | Buyer verifies in the registry. Close: "Latch. The pool you can't rug. Uniswap v4. X Layer." |

---

## 11. Likely Q&A

*Each answer scripted to 30 seconds. Honest answers, including what did not get finished.*

**Mechanism and positioning**
- Why a liquidity lock instead of a high sell fee like the other entries?
- What exactly reverts, and at what point in the v4 lifecycle?
- How does the graduated release schedule compute the allowed withdrawal?
- Can a creator dodge the lock by transferring the LP position to another address?
- What is the single thing Latch cannot stop?

**The second-pool problem**
- If a creator seeds a second pool without your hook, your lock is moot. How do you handle that?
- What does "Latch Verified" actually certify, and what does it not?
- Could a malicious token contract make a locked pool worthless anyway?

**Architecture and security**
- Walk us through what happens when someone calls removeLiquidity early.
- How did you handle the hook permission flags?
- Is the hook upgradeable or admin-controlled? Why does that matter here?
- What is the gas overhead on a removal?
- Why no oracle?

**User and market**
- Why would a creator accept a pool that locks their own liquidity?
- Why would a buyer prefer a Latch Verified pool?
- How does the registry drive activity on X Layer specifically?
- How does this fit Flap's issuance flow?
- What does adoption look like after the hackathon?

**Team**
- What did you not finish?
- What scares you about this design?
- What is your Monday after the hackathon?

---

## 12. Submission Checklist (Day 7, May 28)

**By 10:00 UTC**
- Hook, registry, and launcher deployed and verified on the X Layer explorer. Addresses copied.
- One-tx launch demonstrated; pool appears Latch Verified in the registry.
- Rug attempt reverting captured onchain. Graduated release demonstrated.
- GitHub repo public, clean README, Foundry tests passing, NatSpec present.
- Demo video uploaded to YouTube (unlisted).
- X account: 18+ posts live, tagging @XLayerOfficial, @Uniswap, @flapdotsh.
- Contradiction-hunt pass: every address, claim, and link verified. No overclaiming, no naming competitors.

**By 12:00 UTC (submission target, 11.5h before deadline)**
- Google Form submitted. Project: Latch. Verifiable contract addresses, demo link, GitHub link, X handle.
- Submission post tagging @XLayerOfficial, @Uniswap, @flapdotsh with the demo video.

**By 23:59 UTC**
- Submission confirmation post, numbers post (real counts only), thank-you, manifesto close.
- Onchain monitoring continues. Keep the account warm with activity screenshots through judging.

---

## 13. If We Place Top 3

- Priority access to the X Layer Future Accelerator. One-page next-step plan: open the registry to third-party front-ends, token-safety checks in verification, per-buyer protections as a separate module.
- LinkedIn long-form (architect's angle, ~400 words) and a 3-tweet technical thread from the project account.
- Outreach to the X Layer, Uniswap, and Flap teams about the cooperation opportunity. The PR support is the real prize.
- Press angles: crypto press plus Nigerian tech press (Techpoint, BenjaminDada).
- Sleep before posting wins. No 2am victory posts. They age badly.

> *"Everyone else taxed the trader. We locked the liquidity. A rug is a design choice, and so is making it revert. Latch. The pool you can't rug. Uniswap v4. X Layer."*
