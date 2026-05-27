export type Schedule = {
  cliffTime: number;
  periodLength: number;
  periodsCount: number;
  totalLocked: number;
};

export const DEMO_SCHEDULE: Schedule = {
  cliffTime: 0,
  periodLength: 7,
  periodsCount: 4,
  totalLocked: 100,
};

export const TIMELINE_END =
  DEMO_SCHEDULE.cliffTime + DEMO_SCHEDULE.periodLength * DEMO_SCHEDULE.periodsCount + 4;

export function releasedAmount(s: Schedule, day: number): number {
  if (day < s.cliffTime) return 0;
  const elapsed = Math.floor((day - s.cliffTime) / s.periodLength);
  if (elapsed >= s.periodsCount) return s.totalLocked;
  return (s.totalLocked * elapsed) / s.periodsCount;
}

export type RemoveOutcome =
  | { kind: "released"; amount: number; released: number; removedSoFar: number }
  | { kind: "blocked"; requested: number; alreadyRemoved: number; released: number };

export function attemptRemove(
  s: Schedule,
  removedSoFar: number,
  amount: number,
  day: number,
): RemoveOutcome {
  const released = releasedAmount(s, day);
  if (removedSoFar + amount > released) {
    return { kind: "blocked", requested: amount, alreadyRemoved: removedSoFar, released };
  }
  return { kind: "released", amount, released, removedSoFar: removedSoFar + amount };
}

export function stepBoundaries(s: Schedule): { day: number; releasedPct: number }[] {
  const out: { day: number; releasedPct: number }[] = [];
  for (let i = 1; i <= s.periodsCount; i += 1) {
    out.push({ day: s.cliffTime + s.periodLength * i, releasedPct: (100 * i) / s.periodsCount });
  }
  return out;
}

export function stateNote(s: Schedule, day: number, removedSoFar: number): string {
  const released = releasedAmount(s, day);
  const withdrawable = Math.max(0, released - removedSoFar);
  if (released === 0) return "Nothing is released yet. Any removal reverts — the pool is fully locked.";
  if (withdrawable === 0) return "The released portion is already out. Further removal reverts until the next unlock.";
  return `${withdrawable.toFixed(0)}% is withdrawable now. Anything beyond that reverts.`;
}
