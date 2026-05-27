"use client";

import { useState } from "react";

import { SectionMarker } from "@/components/ui/section-marker";
import { Cancel, Tick, ShieldStrong, Refresh, Flash, Layers } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { layout, type, surface } from "@/lib/tokens";
import {
  DEMO_SCHEDULE,
  TIMELINE_END,
  releasedAmount,
  attemptRemove,
  stepBoundaries,
  stateNote,
  type RemoveOutcome,
} from "@/lib/sim";

const s = DEMO_SCHEDULE;

export function RugSimulator() {
  const [day, setDay] = useState(2);
  const [amount, setAmount] = useState(50);
  const [removed, setRemoved] = useState(0);
  const [last, setLast] = useState<RemoveOutcome | null>(null);
  const [shake, setShake] = useState(0);

  const released = releasedAmount(s, day);
  const withdrawable = Math.max(0, released - removed);
  const locked = 100 - released;
  const boundaries = stepBoundaries(s);

  function tryRug() {
    const outcome = attemptRemove(s, removed, amount, day);
    setLast(outcome);
    if (outcome.kind === "released") setRemoved(outcome.removedSoFar);
    else setShake((n) => n + 1);
  }

  function reset() {
    setDay(2);
    setAmount(50);
    setRemoved(0);
    setLast(null);
  }

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
            <span className="block">Try to rug it.</span>
            <span className="block">Watch it revert.</span>
          </h2>
        </div>
        <div className="flex flex-col justify-end gap-3 lg:col-span-5">
          <p className={cn(type.body, "max-w-md")}>
            A Uniswap v4 hook runs inside the pool. Move the clock, choose how much liquidity to pull,
            and hit the pool. Latch checks the public schedule and reverts anything it has not released
            yet. This runs the exact maths the deployed hook does.
          </p>
        </div>
      </div>

      <div className="grid gap-5 md:gap-6 lg:grid-cols-12">
        <div className={cn("rounded-2xl lg:col-span-7", surface.panel, "p-6 md:p-8")}>
          <div className="flex items-center justify-between">
            <span className={type.eyebrow}>
              <ShieldStrong size={14} /> Pool · seed liquidity
            </span>
            <span className="font-mono text-[11px] tracking-wide text-white/45">day {day} of {TIMELINE_END}</span>
          </div>

          <div key={shake} className={cn("mt-4", last?.kind === "blocked" && "animate-rug-shake")}>
            <div className="flex h-12 w-full overflow-hidden rounded-xl border border-white/10 bg-black">
              {removed > 0 ? (
                <div
                  className="h-full border-r border-white/10 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.05)_0_6px,transparent_6px_12px)]"
                  style={{ width: `${removed}%` }}
                />
              ) : null}
              {withdrawable > 0 ? (
                <div
                  className="h-full bg-emerald-500/30"
                  style={{ width: `${withdrawable}%` }}
                />
              ) : null}
              {locked > 0 ? (
                <div className="h-full bg-white/[0.12]" style={{ width: `${locked}%` }} />
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] uppercase tracking-[0.18em]">
              <span className="text-white/45">
                <span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-white/[0.12] align-middle" />
                locked {locked.toFixed(0)}%
              </span>
              <span className="text-emerald-300/80">
                <span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-emerald-500/40 align-middle" />
                withdrawable {withdrawable.toFixed(0)}%
              </span>
              <span className="text-white/35">
                <span className="mr-1.5 inline-block h-2 w-2 rounded-sm border border-white/15 align-middle" />
                removed {removed.toFixed(0)}%
              </span>
            </div>
          </div>

          <div className="mt-7">
            <div className="mb-2 flex items-center justify-between">
              <label className={type.eyebrow}>
                <Flash size={14} /> Clock
              </label>
              <span className="font-mono text-[11px] text-white/45">released {released.toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={TIMELINE_END}
              step={1}
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
              className="w-full accent-white"
              aria-label="Advance the clock"
            />
            <div className="relative mt-1 h-4">
              {boundaries.map((b) => (
                <span
                  key={b.day}
                  className="absolute -translate-x-1/2 font-mono text-[9px] text-white/30"
                  style={{ left: `${(b.day / TIMELINE_END) * 100}%` }}
                >
                  {b.releasedPct}%
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <label className={type.eyebrow}>Pull liquidity</label>
              <span className="font-mono text-[11px] text-white/45">{amount}%</span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full accent-white"
              aria-label="Amount to remove"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={tryRug}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-[13px] font-medium text-black transition-opacity hover:opacity-90"
            >
              Try to rug {amount}%
            </button>
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-white/15 px-5 text-[13px] text-white/70 transition-colors hover:border-white/30 hover:text-white"
            >
              <Refresh size={15} /> Reset
            </button>
          </div>

          {last ? (
            <div
              className={cn(
                "mt-5 flex items-start gap-3 rounded-xl border p-4",
                last.kind === "blocked"
                  ? "border-rose-500/25 bg-rose-500/[0.06]"
                  : "border-emerald-500/25 bg-emerald-500/[0.06]",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                  last.kind === "blocked" ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300",
                )}
              >
                {last.kind === "blocked" ? <Cancel size={13} /> : <Tick size={13} />}
              </span>
              {last.kind === "blocked" ? (
                <div>
                  <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-rose-300">
                    Transaction reverted
                  </p>
                  <p className="mt-1 font-mono text-[12px] text-white/60">
                    RugBlocked(requested: {last.requested}, alreadyRemoved: {last.alreadyRemoved}, released: {last.released})
                  </p>
                  <p className={cn(type.bodySm, "mt-1.5")}>
                    The hook reverted before any liquidity moved. The pool is intact.
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-emerald-300">
                    LiquidityReleased
                  </p>
                  <p className="mt-1 font-mono text-[12px] text-white/60">
                    Released {last.amount}% · cumulative removed {last.removedSoFar}% of {last.released}% unlocked
                  </p>
                  <p className={cn(type.bodySm, "mt-1.5")}>
                    Within the vested portion, so the hook let exactly this much through.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className={cn(type.bodySm, "mt-5")}>{stateNote(s, day, removed)}</p>
          )}
        </div>

        <div className="flex flex-col gap-5 lg:col-span-5">
          <div className={cn("rounded-2xl", surface.panel, "p-6 md:p-7")}>
            <span className={type.eyebrow}>
              <Layers size={14} /> The gate, live
            </span>
            <pre className="mt-4 overflow-x-auto rounded-xl border border-white/[0.07] bg-black p-4 font-mono text-[11.5px] leading-relaxed text-white/70">
              <code>
                {`function _beforeRemoveLiquidity(...) {\n`}
                {`  released = releasedAmount(now);  `}
                <span className="text-white/35">{`// ${released}`}</span>
                {`\n  removedSoFar;                    `}
                <span className="text-white/35">{`// ${removed}`}</span>
                {`\n`}
                <span
                  className={cn(
                    last?.kind === "blocked" && "rounded bg-rose-500/15 text-rose-300",
                  )}
                >
                  {`  if (removedSoFar + ${amount} > released)\n      revert RugBlocked();`}
                </span>
                {`\n`}
                <span className={cn(last?.kind === "released" && "rounded bg-emerald-500/15 text-emerald-300")}>
                  {`  removedSoFar += ${amount};`}
                </span>
                {`\n}`}
              </code>
            </pre>
          </div>

          <div className={cn("rounded-2xl", surface.panel, "p-6 md:p-7")}>
            <span className={type.eyebrow}>Where the hook fires</span>
            <ol className="mt-4 flex flex-col gap-3">
              {[
                "Someone calls removeLiquidity on the pool",
                "Uniswap v4 PoolManager calls back into the hook",
                "beforeRemoveLiquidity checks the public schedule",
                "Over the released amount → revert. Within it → allow.",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/12 font-mono text-[10px] text-white/55">
                    {i + 1}
                  </span>
                  <span className="text-[13px] font-light leading-[1.5] text-white/60">{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 border-t border-white/[0.07] pt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
              No oracle · no admin key · pure pool state
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
