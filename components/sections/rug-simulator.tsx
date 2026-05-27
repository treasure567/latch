"use client";

import { useEffect, useRef, useState } from "react";

import { SectionMarker } from "@/components/ui/section-marker";
import { Cancel, Tick, ShieldStrong, Refresh, Activity } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { layout, type, surface } from "@/lib/tokens";
import {
  initLaunch,
  tick,
  applyTrade,
  rugWithoutLatch,
  marketCap,
  changePct,
  RELEASE_STEPS,
  type Launch,
} from "@/lib/launch-sim";

type RugEvent = "blocked" | "crashed" | null;

function fmtOkb(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  if (n >= 10) return n.toFixed(0);
  if (n >= 1) return n.toFixed(1);
  return n.toPrecision(2);
}

export function RugSimulator() {
  const [launch, setLaunch] = useState<Launch>(initLaunch);
  const [event, setEvent] = useState<RugEvent>(null);
  const [shake, setShake] = useState(0);
  const [tradeOkb, setTradeOkb] = useState(1);
  const [pending, setPending] = useState<null | "rug" | "without">(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setLaunch((l) => (l.status === "live" ? tick(l) : l));
    }, 750);
    return () => clearInterval(id);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const rugged = launch.status === "rugged";
  const busy = pending !== null;
  const mc = marketCap(launch);
  const chg = changePct(launch);

  const hist = launch.history;
  const min = Math.min(...hist);
  const max = Math.max(...hist);
  const span = max - min || 1;
  const coords = hist.map((p, i) => {
    const x = hist.length === 1 ? 0 : (i / (hist.length - 1)) * 100;
    const y = 38 - ((p - min) / span) * 34;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const linePts = coords.join(" ");
  const areaPts = `0,40 ${linePts} 100,40`;
  const stroke = rugged ? "#fb7185" : "#34d399";

  function tryRug() {
    if (busy || rugged) return;
    setEvent(null);
    setPending("rug");
    timer.current = setTimeout(() => {
      setEvent("blocked");
      setPending(null);
    }, 1300);
  }
  function rugWithout() {
    if (busy || rugged) return;
    setEvent(null);
    setPending("without");
    timer.current = setTimeout(() => {
      setLaunch((l) => rugWithoutLatch(l));
      setEvent("crashed");
      setShake((n) => n + 1);
      setPending(null);
    }, 1300);
  }
  function reset() {
    if (timer.current) clearTimeout(timer.current);
    setPending(null);
    setLaunch(initLaunch());
    setEvent(null);
  }

  const stats = [
    { label: "Market cap", value: `${fmtOkb(mc)} OKB`, big: true },
    { label: "24h", value: `${chg >= 0 ? "+" : ""}${chg.toFixed(0)}%`, tone: chg >= 0 && !rugged },
    { label: "Liquidity", value: `${fmtOkb(launch.reserveOkb)} OKB`, lock: true },
    { label: "Holders", value: launch.holders.toLocaleString() },
    { label: "Volume", value: `${fmtOkb(launch.volume)} OKB` },
  ];

  return (
    <section
      id="playground"
      data-scroll-reveal="section"
      className={cn("relative w-full", layout.container, layout.sectionX, layout.sectionY)}
    >
      <div className="mb-12 grid gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="flex flex-col gap-5 lg:col-span-7">
          <SectionMarker num="02" label="Hook lab" />
          <h2 className={type.h2}>
            <span className="block">A live launch.</span>
            <span className="block">Try to rug it.</span>
          </h2>
        </div>
        <div className="flex flex-col justify-end gap-3 lg:col-span-5">
          <p className={cn(type.body, "max-w-md")}>
            A token is launching — buyers are piling in, the chart is pumping, market cap is climbing.
            Now play the creator and try to pull the liquidity. Latch is a Uniswap v4 hook inside the
            pool: the rug reverts onchain. Then watch the same launch without it.
          </p>
        </div>
      </div>

      <div className="grid gap-5 md:gap-6 lg:grid-cols-12">
        <div className={cn("rounded-2xl lg:col-span-8", surface.panel, "p-6 md:p-8")}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/[0.08] bg-white/[0.04] font-mono text-[13px] text-white">
                R
              </span>
              <div>
                <p className="text-[15px] font-medium text-white">RUGME / OKB</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                  Latch verified pool
                </p>
              </div>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em]",
                rugged
                  ? "border-rose-500/25 bg-rose-500/[0.06] text-rose-300"
                  : "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-300",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  rugged ? "bg-rose-400" : "animate-pulse bg-emerald-400",
                )}
              />
              {rugged ? "rugged" : "live"}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
            {stats.map((st) => (
              <div key={st.label}>
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/40">
                  {st.label}
                  {st.lock ? <span className="text-emerald-300/70"> · locked</span> : null}
                </p>
                <p
                  className={cn(
                    "mt-1 font-mono tabular-nums",
                    st.big ? "text-2xl text-white" : "text-base",
                    st.tone === true ? "text-emerald-300" : st.tone === false ? "text-rose-300" : "text-white/80",
                  )}
                >
                  {st.value}
                </p>
              </div>
            ))}
          </div>

          <div key={shake} className={cn("mt-6", event === "crashed" && "animate-rug-shake")}>
            <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-40 w-full">
              <polygon points={areaPts} fill={stroke} fillOpacity="0.08" />
              <polyline
                points={linePts}
                fill="none"
                stroke={stroke}
                strokeWidth="0.8"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2.5 border-t border-white/[0.07] pt-5">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">Trade it</span>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={tradeOkb}
              onChange={(e) => setTradeOkb(Math.max(0.1, Number(e.target.value)))}
              disabled={rugged || busy}
              className="h-9 w-20 rounded-lg border border-white/10 bg-black px-2 text-right font-mono text-sm text-white outline-none disabled:opacity-40"
              aria-label="Amount in OKB"
            />
            <span className="font-mono text-[11px] text-white/40">OKB</span>
            <button
              type="button"
              onClick={() => setLaunch((l) => applyTrade(l, "buy", tradeOkb))}
              disabled={rugged || busy}
              className="inline-flex h-9 items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 text-[12px] font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:opacity-30"
            >
              Buy
            </button>
            <button
              type="button"
              onClick={() => setLaunch((l) => applyTrade(l, "sell", tradeOkb))}
              disabled={rugged || busy}
              className="inline-flex h-9 items-center rounded-full border border-white/15 px-4 text-[12px] text-white/70 transition-colors hover:border-white/30 hover:text-white disabled:opacity-30"
            >
              Sell
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={tryRug}
              disabled={rugged || busy}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-[13px] font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending === "rug" ? (
                <Refresh size={15} className="animate-spin" />
              ) : (
                <ShieldStrong size={15} />
              )}
              {pending === "rug" ? "Pulling liquidity…" : "Creator: pull all liquidity"}
            </button>
            <button
              type="button"
              onClick={rugWithout}
              disabled={rugged || busy}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-rose-500/30 px-5 text-[13px] text-rose-300 transition-colors hover:bg-rose-500/10 disabled:opacity-40"
            >
              {pending === "without" ? <Refresh size={15} className="animate-spin" /> : null}
              {pending === "without" ? "Draining pool…" : "Replay without Latch"}
            </button>
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-white/15 px-5 text-[13px] text-white/70 transition-colors hover:border-white/30 hover:text-white"
            >
              <Refresh size={15} /> Reset
            </button>
          </div>

          {pending ? (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-white/12 bg-white/[0.03] p-4">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80">
                <Refresh size={13} className="animate-spin" />
              </span>
              <div>
                <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-white/70">
                  {pending === "rug" ? "Submitting removal to the pool…" : "Draining the pool…"}
                </p>
                <p className="mt-1 font-mono text-[12px] text-white/50">
                  {pending === "rug"
                    ? "beforeRemoveLiquidity is about to run"
                    : "no hook in this pool — nothing to stop it"}
                </p>
              </div>
            </div>
          ) : event === "blocked" ? (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                <Tick size={13} />
              </span>
              <div>
                <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-emerald-300">
                  Rug reverted · RugBlocked
                </p>
                <p className="mt-1 font-mono text-[12px] text-white/60">
                  beforeRemoveLiquidity: requested 100% &gt; released 0% → revert
                </p>
                <p className={cn(type.bodySm, "mt-1.5")}>
                  The creator tried to drain the pool. The hook reverted before any liquidity moved —
                  the chart never flinched, buyers untouched.
                </p>
              </div>
            </div>
          ) : event === "crashed" ? (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-300">
                <Cancel size={13} />
              </span>
              <div>
                <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-rose-300">
                  Rugged · liquidity gone
                </p>
                <p className="mt-1 font-mono text-[12px] text-white/60">
                  Creator removed the pool. Price → 0. Every buyer wiped out.
                </p>
                <p className={cn(type.bodySm, "mt-1.5")}>
                  This is every unprotected launch. Latch makes this exact transaction revert.
                </p>
              </div>
            </div>
          ) : (
            <p className={cn(type.bodySm, "mt-5")}>
              The launch seed is locked by Latch on a public schedule. Pull it and the hook reverts.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-5 lg:col-span-4">
          <div className={cn("rounded-2xl", surface.panel, "p-5 md:p-6")}>
            <span className={type.eyebrow}>
              <Activity size={14} /> Live trades
            </span>
            <ul className="mt-4 flex flex-col gap-2">
              {launch.trades.length === 0 ? (
                <li className="font-mono text-[12px] text-white/35">waiting for the first buy…</li>
              ) : (
                launch.trades.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 font-mono text-[12px]">
                    <span className="flex items-center gap-2">
                      <span className={cn("h-1.5 w-1.5 rounded-full", t.kind === "buy" ? "bg-emerald-400" : "bg-rose-400")} />
                      <span className="text-white/45">{t.who}</span>
                      <span className={t.kind === "buy" ? "text-emerald-300/80" : "text-rose-300/80"}>{t.kind}</span>
                    </span>
                    <span className="tabular-nums text-white/55">{t.okb.toFixed(2)} OKB</span>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className={cn("rounded-2xl", surface.panel, "p-5 md:p-6")}>
            <span className={type.eyebrow}>The gate</span>
            <pre className="mt-3 overflow-x-auto rounded-xl border border-white/[0.07] bg-black p-4 font-mono text-[11px] leading-relaxed text-white/65">
              <code>{`beforeRemoveLiquidity:
  if (removed + amount
      > released(now))
    revert RugBlocked();`}</code>
            </pre>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
              No oracle · no admin key · pure pool state
            </p>
          </div>

          <div className={cn("rounded-2xl", surface.panel, "p-5 md:p-6")}>
            <span className={type.eyebrow}>Release schedule</span>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {RELEASE_STEPS.map((step) => (
                <span
                  key={step.when}
                  className="rounded-full border border-white/10 px-2.5 py-1 font-mono text-[10px] text-white/55"
                >
                  {step.when} · {step.pct}%
                </span>
              ))}
            </div>
            <p className={cn(type.bodySm, "mt-3")}>
              Public and immutable. The seed unlocks gradually — never all at once, so there is no
              single moment the pool can vanish.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
