/**
 * Single source of truth for all landing-page copy.
 *
 * STRICT RULE: do not place copy strings in components. Edit here so localisation
 * and tone-tuning happen in one diff.
 *
 * Truth bar: every claim on this page must map to the Latch PRD
 * (`/marketing/Latch_PRD.md`) and, once shipped, to a verifiable contract or
 * frontend behaviour. We describe the architecture, not deployment status — no
 * "deployed" / "live on mainnet" language until it is true onchain.
 */

import {
  Connect,
  FileSearch,
  FingerPrint,
  Flash,
  Github,
  Layers,
  Refresh,
  Shield,
  View,
  Wallet,
  type Icon,
} from "@/lib/icons";

// -----------------------------------------------------------------------------
// Brand / global
// -----------------------------------------------------------------------------

export const BRAND = {
  name: "Latch",
  tagline: "The pool you can't rug.",
  github: "https://github.com/Enoch208/latch",
  // X handle pending — swap this single value when the account is live.
  x: "#",
  builtWith: "Uniswap v4 · X Layer",
} as const;

export const NAV_LINKS = [
  { label: "Mechanism", href: "#pipeline" },
  { label: "Contracts", href: "#stack" },
  { label: "Scope", href: "#threats" },
] as const;

// -----------------------------------------------------------------------------
// Primary actions (hero + CTA buttons). Latch is a web dApp, not a download —
// these point at the repo and the build account until the frontend ships.
// -----------------------------------------------------------------------------

export const ACTIONS = {
  primary: {
    label: "Try the playground",
    sub: "See a rug get blocked",
    href: "#playground",
    glyph: Flash as Icon,
  },
  secondary: {
    label: "View on GitHub",
    sub: "Open source · Foundry",
    href: BRAND.github,
    glyph: Github as Icon,
  },
} as const;

// -----------------------------------------------------------------------------
// Hero
// -----------------------------------------------------------------------------

export const HERO = {
  marker: { num: "01", label: "The lock" },
  badge: "Uniswap v4 Hook · X Layer",
  // Two short lines. Together they read as one sentence — the memory anchor.
  headline: ["The pool", "you can't rug."],
  // Single-line subhead. Anything longer reads as a paragraph in a hero.
  sub: "A Uniswap v4 hook that locks launch liquidity onchain. The creator physically cannot pull it — a rug attempt reverts. Verify before you buy.",
  // Two ornaments — kept minimal; the hero should breathe.
  nodes: [
    {
      pos: "top-[18%] left-[5%]",
      reverse: false,
      icon: Shield as Icon,
      label: "beforeRemoveLiquidity",
      meta: "reverts the rug",
      dotClass: "bg-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,0.8)]",
    },
    {
      pos: "bottom-[22%] right-[5%]",
      reverse: true,
      icon: Refresh as Icon,
      label: "Graduated release",
      meta: "vests in steps",
      dotClass: "bg-amber-400/80 shadow-[0_0_8px_rgba(251,191,36,0.7)]",
    },
  ],
} as const;

// -----------------------------------------------------------------------------
// Proof cards (rendered as visual proof of the guarantee)
//
// The three cards trace the story: a rug reverts (the wedge), liquidity vests
// in steps (the nuance), a pool is Verified (the product). Each "citation" is
// something the chain can prove — an event or a pure-state check.
// -----------------------------------------------------------------------------

export type Verdict = "GREEN" | "YELLOW" | "RED";

export const VERDICTS: Array<{
  level: Verdict;
  title: string;
  summary: string;
  citations: string[];
  meta: string;
}> = [
  {
    level: "RED",
    title: "Rug blocked — removal reverted",
    summary:
      "The creator tried to pull liquidity before the schedule allowed. The hook reverted it onchain.",
    citations: [
      "beforeRemoveLiquidity: requested removal exceeds releasedFraction(now) = 0%. Transaction reverts.",
      "Enforced from pure pool state — transferring the LP position to another address does not bypass it.",
      "Emitted RugBlocked. The failed attempt is a permanent, visible transaction in the explorer.",
    ],
    meta: "Hook · revert · onchain",
  },
  {
    level: "YELLOW",
    title: "Graduated release — vested step",
    summary:
      "Past the cliff, only the vested portion can be withdrawn. The rest stays locked.",
    citations: [
      "releasedFraction(now) climbs a fixed amount each period; the withdrawal is capped to it.",
      "No single moment empties the pool — liquidity unlocks in steps, not all at once.",
      "Emitted LiquidityReleased. Each unlock is onchain and matches the public schedule.",
    ],
    meta: "Schedule · vesting · partial",
  },
  {
    level: "GREEN",
    title: "Latch Verified — safe to buy",
    summary:
      "Liquidity locked under a public schedule, launched with a fixed-supply token.",
    citations: [
      "LP locked via the canonical Latch hook; the release schedule is readable by anyone.",
      "Token launched through Latch: no mint, no blacklist, no owner dump privileges.",
      "Listed in LatchRegistry — emitted PoolVerified. Check it before you buy.",
    ],
    meta: "Registry · Verified · onchain",
  },
];

// -----------------------------------------------------------------------------
// Verify-before-you-buy (section header above the proof cards)
// -----------------------------------------------------------------------------

export const WHY_LOCAL = {
  marker: { num: "02", label: "Verify before you buy" },
  title: ["Don't trust the founder.", "Read the lock onchain."],
  body:
    "A buyer doesn't take anyone's word. They check the registry and read the lock from pure pool state. Every rule is enforced onchain, every attempt to break it is a visible transaction, and there is no admin key.",
  stat: "0",
  statLabel: "Admin keys — the lock is immutable",
} as const;

// -----------------------------------------------------------------------------
// Mechanism cards
// -----------------------------------------------------------------------------

export const PIPELINE_INTRO = {
  marker: { num: "03", label: "Mechanism" },
  title: ["One guarantee,", "enforced in the curve."],
  body:
    "Launch in one transaction. Liquidity locks under a public schedule. Any early or oversized removal reverts. No oracle, no identity, no admin key — every rule is enforced from pure pool state and emits an event the chain can prove.",
} as const;

export type PipelineCard = {
  icon: Icon;
  title: string;
  blurb: string;
  variant: "code" | "orbit" | "sonar";
};

export const PIPELINE_CARDS: PipelineCard[] = [
  {
    icon: Shield,
    title: "Lock & gate",
    blurb:
      "LatchHook compares every withdrawal against releasedFraction(now) from the stored schedule. Exceed it and the transaction reverts with RugBlocked. Built on the Uniswap v4 BaseHook.",
    variant: "code",
  },
  {
    icon: Refresh,
    title: "Graduated release",
    blurb:
      "Liquidity vests in steps — 0% until the cliff, then a fixed fraction per period. No single unlock can empty the pool, and each step emits LiquidityReleased.",
    variant: "orbit",
  },
  {
    icon: FileSearch,
    title: "Verify before you buy",
    blurb:
      "LatchRegistry lists every Latch-locked pool with its release schedule readable by anyone. The frontend reads it live — Latch Verified means locked, with a safe-token template.",
    variant: "sonar",
  },
];

// -----------------------------------------------------------------------------
// Contracts matrix
// -----------------------------------------------------------------------------

export const QVAC_MARKER = { num: "04", label: "Contracts" } as const;

export type QvacRow = {
  icon: Icon;
  module: string;
  use: string;
  path: string;
  status?: "live" | "reserved";
};

export const QVAC_ROWS: QvacRow[] = [
  {
    icon: Shield,
    module: "LatchHook.sol",
    use: "Inherits the Uniswap v4 BaseHook. Enforces the lock in beforeRemoveLiquidity — reverts any early or oversized withdrawal. Storage: mapping(PoolId => Schedule).",
    path: "src/LatchHook.sol",
  },
  {
    icon: FileSearch,
    module: "LatchRegistry.sol",
    use: "Onchain directory of Latch-locked pools. register(poolId, schedule), isVerified(poolId), and a view of release terms. Emits PoolVerified.",
    path: "src/LatchRegistry.sol",
  },
  {
    icon: Flash,
    module: "LatchLauncher.sol",
    use: "One-transaction factory. launch(params) deploys the token, initializes the pool, writes the release schedule, and lists the pool in the registry.",
    path: "src/LatchLauncher.sol",
  },
  {
    icon: Layers,
    module: "DemoToken.sol",
    use: "Fixed-supply OpenZeppelin ERC-20 — no mint, no blacklist, no owner dump privileges. The safe-token template behind Latch Verified.",
    path: "src/DemoToken.sol",
  },
  {
    icon: Refresh,
    module: "Creator-allocation vesting",
    use: "Stretch: the creator's own token allocation vests on a schedule, closing the supply-dump vector that an LP lock alone cannot.",
    path: "stretch",
    status: "reserved",
  },
];

// -----------------------------------------------------------------------------
// Honest scope catalog
// -----------------------------------------------------------------------------

export const THREAT_MARKER = { num: "05", label: "Honest scope" } as const;

export type Threat = {
  icon: Icon;
  title: string;
  body: string;
};

export const THREATS: Threat[] = [
  {
    icon: Shield,
    title: "Hard liquidity pull",
    body: "The creator removing the pool's liquidity and vanishing. Latch reverts it inside `beforeRemoveLiquidity` — this is the vector we close structurally.",
  },
  {
    icon: FingerPrint,
    title: "LP position transfer",
    body: "Moving the LP position to a fresh address to dodge the lock. Gating fires from pure pool state regardless of owner, so transferring does not help.",
  },
  {
    icon: Layers,
    title: "Malicious token",
    body: "Mint-and-dump, blacklist, or pausable transfers. Verified pools launch through a fixed-supply template with none of these; external pools are lock-only, not Verified.",
  },
  {
    icon: Wallet,
    title: "Supply dump",
    body: "The creator selling a large token allocation into the pool. The LP lock does not stop this — mitigated by allocation vesting (stretch) and disclosing allocation in the registry.",
  },
  {
    icon: Connect,
    title: "Second unprotected pool",
    body: "A creator seeding a second pool without the hook. Out of hook scope by design — the registry is the answer: buyers transact through the Verified pool.",
  },
  {
    icon: View,
    title: "Unaudited code",
    body: "Hackathon code with a small, auditable surface, Foundry tests, and no admin key. We disclose this rather than claim foolproof.",
  },
];

// -----------------------------------------------------------------------------
// CTA + Footer
// -----------------------------------------------------------------------------

export const CTA = {
  title: ["Launch rug-proof.", "Verify before you buy."],
  body:
    "One transaction stands up the token, the pool, the public release schedule, and the registry listing. Creators get a verified, rug-proof pool without writing Solidity — and buyers check it onchain before they touch it.",
} as const;

export const FOOTER = {
  links: [
    {
      heading: "Product",
      items: [
        { label: "Mechanism", href: "#pipeline" },
        { label: "Contracts", href: "#stack" },
        { label: "Scope", href: "#threats" },
      ],
    },
    {
      heading: "Repository",
      items: [
        { label: "GitHub", href: BRAND.github },
        { label: "X", href: BRAND.x },
      ],
    },
    {
      heading: "Built with",
      items: [
        { label: "Uniswap v4", href: "https://docs.uniswap.org/contracts/v4/overview" },
        { label: "X Layer", href: "https://www.okx.com/xlayer" },
        { label: "Foundry", href: "https://book.getfoundry.sh" },
        { label: "OpenZeppelin", href: "https://www.openzeppelin.com/contracts" },
      ],
    },
  ],
  hackathon: {
    label: "X Layer BuildX · Hook the Future",
    deadline: "May 28 · 2026",
  },
} as const;
