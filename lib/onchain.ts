import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  custom,
  decodeErrorResult,
  formatUnits,
  http,
  parseAbi,
  type Hex,
} from "viem";
import { xLayer } from "viem/chains";

export const ADDRS = {
  hook: "0xf856b2992612d55874cE2f8fB2cAb1B3a5Bf8200",
  registry: "0x5Af8F4928A776A7d656B873CF91B9614C8c23f86",
  launcher: "0x253B3520d8c75151F3c6EE02741e2f7DB2fF5c69",
  poolManager: "0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32",
} as const;

const DEFAULT_RUG_DEMO = "0x6C72e2f113eC4680565388345793f6478D1083e2";
const ENV_DEMO = (process.env.NEXT_PUBLIC_RUG_DEMO_ADDRESS ?? "").trim();
export const RUG_DEMO = (/^0x[0-9a-fA-F]{40}$/.test(ENV_DEMO) ? ENV_DEMO : DEFAULT_RUG_DEMO) as `0x${string}` | "";
export const IS_LIVE = RUG_DEMO !== "";

const RPC = process.env.NEXT_PUBLIC_XLAYER_RPC || "https://rpc.xlayer.tech";

export const RUG_ABI = parseAbi([
  "function attempt(uint128 amount)",
  "function attemptFull()",
  "function ready() view returns (bool)",
  "function poolId() view returns (bytes32)",
  "function releasedNow() view returns (uint256)",
  "function removedSoFar() view returns (uint256)",
  "function LOCKED_LIQUIDITY() view returns (uint128)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "error RugBlocked(uint256 requested, uint256 alreadyRemoved, uint256 released)",
  "error WrappedError(address target, bytes4 selector, bytes reason, bytes details)",
  "error HookCallFailed()",
  "error NotReady()",
  "error ZeroAmount()",
]);

export const REGISTRY_ABI = parseAbi(["function isVerified(bytes32 id) view returns (bool)"]);

const SIM_FROM = "0x000000000000000000000000000000000000dEaD" as const;

export type RugResult =
  | { status: "blocked"; requested: bigint; alreadyRemoved: bigint; released: bigint }
  | { status: "reverted"; selector?: string }
  | { status: "rejected" }
  | { status: "nowallet" }
  | { status: "error"; message: string };

export type LiveReads = {
  ready: boolean;
  lockedL: bigint;
  released: bigint;
  removed: bigint;
  poolId: Hex;
  verified: boolean;
};

export function publicClient() {
  return createPublicClient({ chain: xLayer, transport: http(RPC) });
}

export function explorerTx(hash: string) {
  return `https://www.oklink.com/xlayer/tx/${hash}`;
}

export function explorerAddr(addr: string) {
  return `https://www.oklink.com/xlayer/address/${addr}`;
}

export function fmtL(v: bigint) {
  const s = formatUnits(v, 18);
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function getInjected(): { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const okx = w.okxwallet as { request: never } | undefined;
  const eth = w.ethereum as { request: never } | undefined;
  return (okx ?? eth ?? null) as never;
}

export function hasWallet() {
  return getInjected() !== null;
}

function isUserRejection(err: unknown): boolean {
  if (err instanceof BaseError) {
    const hit = err.walk((e) => (e as { name?: string })?.name === "UserRejectedRequestError");
    if (hit) return true;
  }
  const code = (err as { code?: number; cause?: { code?: number } })?.code ?? (err as { cause?: { code?: number } })?.cause?.code;
  return code === 4001;
}

function revertData(err: unknown): Hex | undefined {
  if (!(err instanceof BaseError)) return undefined;
  const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
  const raw = (reverted as unknown as { raw?: string })?.raw;
  if (typeof raw === "string" && raw.startsWith("0x")) return raw as Hex;
  const withData = err.walk((e) => {
    const d = (e as { data?: unknown }).data;
    return typeof d === "string" && d.startsWith("0x");
  }) as { data?: string } | null;
  if (typeof withData?.data === "string") return withData.data as Hex;
  return undefined;
}

function decodeRug(data: Hex, depth = 0): RugResult {
  if (depth > 2 || data.length < 10) return { status: "reverted", selector: data.slice(0, 10) };
  try {
    const decoded = decodeErrorResult({ abi: RUG_ABI, data });
    if (decoded.errorName === "RugBlocked") {
      const [requested, alreadyRemoved, released] = decoded.args as readonly bigint[];
      return { status: "blocked", requested, alreadyRemoved, released };
    }
    if (decoded.errorName === "WrappedError") {
      const reason = (decoded.args as readonly unknown[])[2] as Hex;
      if (reason && reason !== "0x") return decodeRug(reason, depth + 1);
    }
    return { status: "reverted", selector: data.slice(0, 10) };
  } catch {
    return { status: "reverted", selector: data.slice(0, 10) };
  }
}

export function parseRevert(err: unknown): RugResult {
  if (isUserRejection(err)) return { status: "rejected" };
  const data = revertData(err);
  if (data && data !== "0x") return decodeRug(data);
  if (err instanceof BaseError) return { status: "reverted" };
  return { status: "error", message: err instanceof Error ? err.message : "Unknown error" };
}

export async function getLiveReads(): Promise<LiveReads | null> {
  if (!IS_LIVE) return null;
  const client = publicClient();
  const addr = RUG_DEMO as `0x${string}`;
  const [ready, lockedL, released, removed, poolId] = await Promise.all([
    client.readContract({ address: addr, abi: RUG_ABI, functionName: "ready" }),
    client.readContract({ address: addr, abi: RUG_ABI, functionName: "LOCKED_LIQUIDITY" }),
    client.readContract({ address: addr, abi: RUG_ABI, functionName: "releasedNow" }),
    client.readContract({ address: addr, abi: RUG_ABI, functionName: "removedSoFar" }),
    client.readContract({ address: addr, abi: RUG_ABI, functionName: "poolId" }),
  ]);
  const verified = await client.readContract({
    address: ADDRS.registry,
    abi: REGISTRY_ABI,
    functionName: "isVerified",
    args: [poolId as Hex],
  });
  return {
    ready: ready as boolean,
    lockedL: lockedL as bigint,
    released: released as bigint,
    removed: removed as bigint,
    poolId: poolId as Hex,
    verified: verified as boolean,
  };
}

export async function simulateRug(): Promise<RugResult> {
  if (!IS_LIVE) return { status: "error", message: "Demo pool not deployed yet." };
  const client = publicClient();
  try {
    await client.simulateContract({
      account: SIM_FROM,
      address: RUG_DEMO as `0x${string}`,
      abi: RUG_ABI,
      functionName: "attemptFull",
    });
    return { status: "error", message: "Unexpected: the rug did not revert." };
  } catch (err) {
    return parseRevert(err);
  }
}

async function ensureXLayer(eth: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> }) {
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xc4" }] });
  } catch (e) {
    const code = (e as { code?: number; data?: { originalError?: { code?: number } } })?.code;
    const nested = (e as { data?: { originalError?: { code?: number } } })?.data?.originalError?.code;
    if (code === 4902 || nested === 4902) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0xc4",
            chainName: "X Layer",
            nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
            rpcUrls: ["https://rpc.xlayer.tech"],
            blockExplorerUrls: ["https://www.oklink.com/xlayer"],
          },
        ],
      });
    } else {
      throw e;
    }
  }
}

export async function sendRealRug(): Promise<{ hash: Hex }> {
  if (!IS_LIVE) throw new Error("Demo pool not deployed yet.");
  const eth = getInjected();
  if (!eth) throw new Error("NO_WALLET");
  await ensureXLayer(eth as never);
  const wallet = createWalletClient({ chain: xLayer, transport: custom(eth as never) });
  const [account] = await wallet.requestAddresses();
  const hash = await wallet.writeContract({
    account,
    chain: xLayer,
    address: RUG_DEMO as `0x${string}`,
    abi: RUG_ABI,
    functionName: "attemptFull",
    gas: 320000n,
  });
  return { hash };
}

export async function waitForRug(hash: Hex): Promise<"reverted" | "success"> {
  const client = publicClient();
  const receipt = await client.waitForTransactionReceipt({ hash });
  return receipt.status === "reverted" ? "reverted" : "success";
}
