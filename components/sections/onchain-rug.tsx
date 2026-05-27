"use client";

import { useCallback, useEffect, useState } from "react";

import { SectionMarker } from "@/components/ui/section-marker";
import { AlertCircle, ArrowUpRight, Flash, ShieldStrong, Tick, Wallet } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { layout, type, surface } from "@/lib/tokens";
import {
  ADDRS,
  explorerAddr,
  explorerTx,
  fmtL,
  getLiveReads,
  hasWallet,
  IS_LIVE,
  parseRevert,
  RUG_DEMO,
  sendRealRug,
  simulateRug,
  waitForRug,
  type LiveReads,
  type RugResult,
} from "@/lib/onchain";

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const CONTRACTS = [
  { label: "LatchHook", addr: ADDRS.hook, note: "the gate" },
  { label: "LatchRegistry", addr: ADDRS.registry, note: "verify before buy" },
  { label: "Uniswap v4 PoolManager", addr: ADDRS.poolManager, note: "canonical singleton" },
];

export function OnchainRug() {
  const [reads, setReads] = useState<LiveReads | null>(null);
  const [readsFailed, setReadsFailed] = useState(false);

  const [simResult, setSimResult] = useState<RugResult | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  const [txHash, setTxHash] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<"pending" | "reverted" | "success" | null>(null);
  const [sendResult, setSendResult] = useState<RugResult | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!IS_LIVE) return;
    let live = true;
    getLiveReads()
      .then((r) => {
        if (live) setReads(r);
      })
      .catch(() => {
        if (live) setReadsFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const onSimulate = useCallback(async () => {
    setSimLoading(true);
    setSimResult(null);
    try {
      setSimResult(await simulateRug());
    } catch (err) {
      setSimResult(parseRevert(err));
    } finally {
      setSimLoading(false);
    }
  }, []);

  const onSendReal = useCallback(async () => {
    setSendResult(null);
    setTxHash(null);
    setTxStatus(null);
    if (!hasWallet()) {
      setSendResult({ status: "nowallet" });
      return;
    }
    setSending(true);
    try {
      const { hash } = await sendRealRug();
      setTxHash(hash);
      setTxStatus("pending");
      const outcome = await waitForRug(hash);
      setTxStatus(outcome);
    } catch (err) {
      if (err instanceof Error && err.message === "NO_WALLET") {
        setSendResult({ status: "nowallet" });
      } else {
        setSendResult(parseRevert(err));
      }
    } finally {
      setSending(false);
    }
  }, []);

  const lockedL = reads?.lockedL;
  const pct = (v?: bigint) => (lockedL && lockedL > 0n && v !== undefined ? Number((v * 10000n) / lockedL) / 100 : null);

  const idle = !IS_LIVE || readsFailed;
  const readRows = [
    { label: "Locked liquidity", value: reads ? `${fmtL(reads.lockedL)} L` : idle ? "—" : "…" },
    {
      label: "Released now",
      value: reads ? `${fmtL(reads.released)} L` : idle ? "—" : "…",
      tone: reads && reads.released === 0n ? ("good" as const) : undefined,
    },
    { label: "Removed so far", value: reads ? `${fmtL(reads.removed)} L` : idle ? "—" : "…" },
    { label: "Network", value: "X Layer · 196" },
  ];

  return (
    <section
      id="onchain"
      data-scroll-reveal="section"
      className={cn("relative w-full", layout.container, layout.sectionX, layout.sectionY)}
    >
      <div className="mb-12 grid gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="flex flex-col gap-5 lg:col-span-7">
          <SectionMarker num="03" label="On mainnet" />
          <h2 className={type.h2}>
            <span className="block">Not a simulation.</span>
            <span className="block">Try it on X Layer.</span>
          </h2>
        </div>
        <div className="flex flex-col justify-end gap-3 lg:col-span-5">
          <p className={cn(type.body, "max-w-md")}>
            The panel above is the idea. This one talks to the real Latch hook deployed on X Layer
            mainnet. There is a live pool with its liquidity locked. Ask the chain to pull it — the
            deployed hook reverts the call. No testnet, no mock.
          </p>
        </div>
      </div>

      <div className="grid gap-5 md:gap-6 lg:grid-cols-12">
        <div className={cn("rounded-2xl lg:col-span-8", surface.panel, "p-6 md:p-8")}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/[0.08] bg-white/[0.04] text-white">
                <ShieldStrong size={16} />
              </span>
              <div>
                <p className="text-[15px] font-medium text-white">Latch demo pool</p>
                {IS_LIVE ? (
                  <a
                    href={explorerAddr(RUG_DEMO)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 transition-colors hover:text-white/70"
                  >
                    {short(RUG_DEMO)} <ArrowUpRight size={11} />
                  </a>
                ) : (
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                    deploying to mainnet
                  </p>
                )}
              </div>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em]",
                reads?.verified
                  ? "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-300"
                  : "border-white/15 text-white/45",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", reads?.verified ? "bg-emerald-400" : "bg-white/30")} />
              {reads?.verified ? "registry verified" : IS_LIVE ? "reading…" : "pending"}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {readRows.map((r) => (
              <div key={r.label}>
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/40">{r.label}</p>
                <p
                  className={cn(
                    "mt-1 font-mono text-base tabular-nums",
                    r.tone === "good" ? "text-emerald-300" : "text-white/80",
                  )}
                >
                  {r.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-white/[0.07] pt-6">
            <button
              type="button"
              onClick={onSimulate}
              disabled={!IS_LIVE || simLoading}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-[13px] font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-30"
            >
              <Flash size={15} /> {simLoading ? "Calling mainnet…" : "Ask the live hook to remove it"}
            </button>
            <button
              type="button"
              onClick={onSendReal}
              disabled={!IS_LIVE || sending}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-white/15 px-5 text-[13px] text-white/70 transition-colors hover:border-white/30 hover:text-white disabled:opacity-30"
            >
              <Wallet size={15} /> {sending ? "Confirm in wallet…" : "Send the real transaction"}
            </button>
          </div>

          {simResult ? <ResultCard result={simResult} pct={pct} mode="sim" /> : null}

          {txHash ? (
            <div
              className={cn(
                "mt-4 flex items-start gap-3 rounded-xl border p-4",
                txStatus === "reverted"
                  ? "border-emerald-500/25 bg-emerald-500/[0.06]"
                  : txStatus === "success"
                    ? "border-rose-500/25 bg-rose-500/[0.06]"
                    : "border-white/10 bg-white/[0.03]",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                  txStatus === "reverted" ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-white/70",
                )}
              >
                {txStatus === "reverted" ? <Tick size={13} /> : <Wallet size={13} />}
              </span>
              <div className="min-w-0">
                <p
                  className={cn(
                    "font-mono text-[12px] uppercase tracking-[0.18em]",
                    txStatus === "reverted" ? "text-emerald-300" : "text-white/70",
                  )}
                >
                  {txStatus === "pending"
                    ? "Transaction sent · mining…"
                    : txStatus === "reverted"
                      ? "Mined as failed · the rug was rejected onchain"
                      : "Transaction confirmed"}
                </p>
                <a
                  href={explorerTx(txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 font-mono text-[12px] text-white/55 transition-colors hover:text-white"
                >
                  {short(txHash)} <ArrowUpRight size={12} />
                </a>
                {txStatus === "reverted" ? (
                  <p className={cn(type.bodySm, "mt-1.5")}>
                    You signed a real transaction that tried to pull the locked liquidity. The hook
                    reverted it. It exists on the explorer forever — as a failed rug.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {sendResult ? <ResultCard result={sendResult} pct={pct} mode="send" /> : null}

          {!IS_LIVE ? (
            <p className={cn(type.bodySm, "mt-5")}>
              The demo pool is being deployed to X Layer mainnet. The hook and registry on the right
              are already live — this control goes hot the moment the pool lands.
            </p>
          ) : !simResult && !txHash && !sendResult ? (
            <p className={cn(type.bodySm, "mt-5")}>
              The read-only call hits the deployed hook instantly, no wallet needed. The real
              transaction lets you sign the rug attempt yourself and watch the chain refuse it.
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-5 lg:col-span-4">
          <div className={cn("rounded-2xl", surface.panel, "p-5 md:p-6")}>
            <span className={type.eyebrow}>Deployed on X Layer</span>
            <ul className="mt-4 flex flex-col gap-3">
              {CONTRACTS.map((c) => (
                <li key={c.addr} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-white/80">{c.label}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">{c.note}</p>
                  </div>
                  <a
                    href={explorerAddr(c.addr)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] text-white/45 transition-colors hover:text-white"
                  >
                    {short(c.addr)} <ArrowUpRight size={11} />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className={cn("rounded-2xl", surface.panel, "p-5 md:p-6")}>
            <span className={type.eyebrow}>Why it always fails</span>
            <p className={cn(type.bodySm, "mt-3")}>
              The pool seed is locked on a public schedule with a far-future cliff, so the released
              amount is zero. Any removal is checked against it first — and reverts.
            </p>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
              Same hook · same gate · real chain
            </p>
          </div>

          <div className={cn("rounded-2xl", surface.panel, "p-5 md:p-6")}>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-white/40">
                <AlertCircle size={16} />
              </span>
              <p className={cn(type.bodySm)}>
                Uniswap v4 is mainnet-only on X Layer, so this is the real thing. A reverted
                transaction still costs a little OKB gas — that is the only thing you spend.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ResultCard({
  result,
  pct,
  mode,
}: {
  result: RugResult;
  pct: (v?: bigint) => number | null;
  mode: "sim" | "send";
}) {
  if (result.status === "blocked") {
    const reqPct = pct(result.requested);
    const relPct = pct(result.released);
    return (
      <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
          <Tick size={13} />
        </span>
        <div>
          <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-emerald-300">
            Reverted by the hook · RugBlocked
          </p>
          <p className="mt-1 font-mono text-[12px] text-white/60">
            {reqPct !== null && relPct !== null
              ? `requested ${reqPct}% of locked · released ${relPct}%`
              : `requested ${fmtL(result.requested)} L · released ${fmtL(result.released)} L`}
          </p>
          <p className={cn(type.bodySm, "mt-1.5")}>
            {mode === "sim"
              ? "That call hit the real Latch hook on X Layer. The chain refused to move the liquidity — exactly as it would for a creator trying to rug."
              : "The chain executed your transaction and reverted it at the hook. Nothing moved."}
          </p>
        </div>
      </div>
    );
  }
  if (result.status === "reverted") {
    return (
      <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
          <Tick size={13} />
        </span>
        <div>
          <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-emerald-300">
            Reverted onchain · rug blocked
          </p>
          <p className={cn(type.bodySm, "mt-1.5")}>
            The deployed hook rejected the removal. The liquidity stayed put.
          </p>
        </div>
      </div>
    );
  }
  if (result.status === "rejected") {
    return (
      <p className={cn(type.bodySm, "mt-5")}>You rejected the transaction in your wallet. No harm done — try again whenever.</p>
    );
  }
  if (result.status === "nowallet") {
    return (
      <p className={cn(type.bodySm, "mt-5")}>
        No EVM wallet detected. Install OKX Wallet or MetaMask to sign the real attempt — or just use the
        read-only call, which needs no wallet.
      </p>
    );
  }
  return <p className={cn(type.bodySm, "mt-5 text-rose-300/80")}>{result.message}</p>;
}
