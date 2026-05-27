export type Trade = { id: number; kind: "buy" | "sell"; who: string; okb: number };

export type Launch = {
  reserveOkb: number;
  reserveToken: number;
  supply: number;
  holders: number;
  volume: number;
  history: number[];
  trades: Trade[];
  seq: number;
  status: "live" | "rugged";
};

const SEED_OKB = 8;
const SEED_TOKEN = 1_000_000;
const SUPPLY = 1_000_000;
const HISTORY_LEN = 64;

export function initLaunch(): Launch {
  return {
    reserveOkb: SEED_OKB,
    reserveToken: SEED_TOKEN,
    supply: SUPPLY,
    holders: 3,
    volume: 0,
    history: [SEED_OKB / SEED_TOKEN],
    trades: [],
    seq: 0,
    status: "live",
  };
}

export function price(l: Launch): number {
  return l.reserveOkb / l.reserveToken;
}

export function marketCap(l: Launch): number {
  return price(l) * l.supply;
}

export function changePct(l: Launch): number {
  const first = l.history[0] ?? 1;
  const now = price(l);
  if (first === 0) return 0;
  return ((now - first) / first) * 100;
}

function randAddr(): string {
  const hex = "0123456789abcdef";
  const pick = (n: number) =>
    Array.from({ length: n }, () => hex[Math.floor(Math.random() * 16)]).join("");
  return `0x${pick(4)}…${pick(2)}`;
}

export function tick(l: Launch): Launch {
  if (l.status !== "live") return l;
  let { reserveOkb, reserveToken, holders, volume, seq } = l;
  const fresh: Trade[] = [];
  const count = 1 + Math.floor(Math.random() * 3);

  for (let i = 0; i < count; i += 1) {
    const isBuy = Math.random() < 0.78;
    const okb = Number((0.2 + Math.random() * 3.2).toFixed(2));
    const k = reserveOkb * reserveToken;
    if (isBuy) {
      reserveOkb += okb;
      reserveToken = k / reserveOkb;
      if (Math.random() < 0.55) holders += 1;
    } else {
      const out = Math.min(okb, reserveOkb * 0.04);
      reserveOkb = Math.max(0.5, reserveOkb - out);
      reserveToken = k / reserveOkb;
    }
    volume += okb;
    seq += 1;
    fresh.push({ id: seq, kind: isBuy ? "buy" : "sell", who: randAddr(), okb });
  }

  const history = [...l.history, reserveOkb / reserveToken].slice(-HISTORY_LEN);
  const trades = [...fresh.reverse(), ...l.trades].slice(0, 7);
  return { ...l, reserveOkb, reserveToken, holders, volume, history, trades, seq };
}

export function rugWithoutLatch(l: Launch): Launch {
  const reserveOkb = 0.0002;
  const history = [...l.history, reserveOkb / l.reserveToken].slice(-HISTORY_LEN);
  return { ...l, reserveOkb, history, status: "rugged" };
}
