/**
 * On-chain anchoring service for work-proof hashes.
 *
 * Anchors a SHA-256 hash of a work record to the WorkProofAnchor contract on
 * Polygon Amoy by calling `anchor(bytes32)`, which emits an `Anchored` event.
 * If the contract address or demo signing key is not configured (or if the
 * device is offline at call time), the hash is enqueued in AsyncStorage and
 * can be flushed later via `flushQueue`.
 *
 * Concurrency: every read-modify-write of the queue serialises through
 * `withQueueLock`, an in-memory promise chain. Without this, two concurrent
 * enqueues / flushes can clobber each other across an `await tx.wait()`
 * window.
 */

import { JsonRpcProvider, Wallet, Contract, getBytes } from "ethers";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { AnchorResult, AnchorStatus } from "../types";
import {
  POLYGON_AMOY_RPC,
  POLYGON_AMOY_CHAIN_ID,
  HACKATHON_DEMO_KEY,
  ANCHOR_CONTRACT_ADDRESS,
} from "./config";

/** AsyncStorage key for the offline anchor queue. */
const ANCHOR_QUEUE_KEY = "@workproof/anchor-queue";

/** Minimal ABI fragment for the `anchor(bytes32)` entrypoint. */
const ANCHOR_ABI = [
  "function anchor(bytes32 hash) external",
] as const;

/** Build a Polygonscan (Amoy) explorer URL for a given tx hash. */
export function explorerUrl(txHash: string): string {
  return `https://amoy.polygonscan.com/tx/${txHash}`;
}

// ---------------------------------------------------------------------------
// Provider memo — building a JsonRpcProvider on every status poll churns
// connections; one shared provider per session is plenty.
// ---------------------------------------------------------------------------

let _provider: JsonRpcProvider | null = null;
function provider(): JsonRpcProvider {
  if (_provider === null) {
    _provider = new JsonRpcProvider(POLYGON_AMOY_RPC);
  }
  return _provider;
}

// ---------------------------------------------------------------------------
// Hash validation. anchor() requires bytes32 — silently anchoring a 30-byte
// commitment because of left-padding is a real bug surface.
// ---------------------------------------------------------------------------

const HASH_RE = /^[0-9a-f]{64}$/i;

function assertValidHash(hashHex: string): void {
  if (!HASH_RE.test(hashHex)) {
    throw new Error(
      `anchor: hash must be 64 hex chars (got ${hashHex.length})`,
    );
  }
}

// ---------------------------------------------------------------------------
// Async mutex over queue mutations. Operations chain on a module-level
// promise so they observe each other's writes.
// ---------------------------------------------------------------------------

let queueLock: Promise<unknown> = Promise.resolve();

function withQueueLock<T>(work: () => Promise<T>): Promise<T> {
  const next = queueLock.then(work, work);
  // Don't let the chain reject — that would poison subsequent callers.
  queueLock = next.catch(() => undefined);
  return next;
}

// ---------------------------------------------------------------------------
// Submit lock — serialises every on-chain `_anchorOnChain` call so two
// concurrent anchor requests can't race the same demo wallet's nonce.
// ethers v6 reads the pending nonce lazily during populateTransaction, so
// without this two parallel callers both see N and submit nonce=N.
// ---------------------------------------------------------------------------

let submitLock: Promise<unknown> = Promise.resolve();

function withSubmitLock<T>(work: () => Promise<T>): Promise<T> {
  const next = submitLock.then(work, work);
  submitLock = next.catch(() => undefined);
  return next;
}

/** Read the queued hashes from AsyncStorage (oldest first). */
export async function getQueue(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(ANCHOR_QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

/** Persist the queue back to AsyncStorage. */
async function setQueue(queue: string[]): Promise<void> {
  await AsyncStorage.setItem(ANCHOR_QUEUE_KEY, JSON.stringify(queue));
}

/** Append a hash to the offline queue (atomic via mutex, deduped). */
async function enqueueHash(hashHex: string): Promise<void> {
  await withQueueLock(async () => {
    const queue = await getQueue();
    // Skip if already queued — otherwise a double-tap on 'Retry anchor'
    // would submit the same hash twice (gas waste on mainnet; harmless on
    // testnet but still worth avoiding).
    if (queue.includes(hashHex)) return;
    queue.push(hashHex);
    await setQueue(queue);
  });
}

/**
 * Submit a hash on-chain. Caller MUST have validated `hashHex` and confirmed
 * config is available — this helper does NOT enqueue on missing config.
 * Used by both `anchorHash` and `flushQueue` to avoid the double-enqueue
 * regression where flushQueue re-pushed every hash it processed.
 *
 * Concurrency: routed through `submitLock` so concurrent callers don't race
 * on the demo wallet's pending nonce.
 */
async function _anchorOnChain(hashHex: string): Promise<AnchorResult> {
  return withSubmitLock(async () => {
    const wallet = new Wallet(HACKATHON_DEMO_KEY as string, provider());
    const contract = new Contract(
      ANCHOR_CONTRACT_ADDRESS as string,
      ANCHOR_ABI,
      wallet,
    );
    const tx = await contract.anchor(getBytes("0x" + hashHex));
    await tx.wait();
    return {
      txHash: tx.hash,
      chainId: POLYGON_AMOY_CHAIN_ID,
      explorerUrl: explorerUrl(tx.hash),
    };
  });
}

/**
 * Anchor a hex-encoded SHA-256 hash on-chain.
 *
 * If the contract address or demo signing key is missing, OR if the on-chain
 * submission fails (offline, RPC timeout, chain congestion), the hash is
 * queued locally and a synthetic `queued:<hash>` tx id is returned. Callers
 * can rely on `flushQueue` to drain the backlog later.
 */
export async function anchorHash(hashHex: string): Promise<AnchorResult> {
  assertValidHash(hashHex);
  if (!ANCHOR_CONTRACT_ADDRESS || !HACKATHON_DEMO_KEY) {
    await enqueueHash(hashHex);
    return {
      txHash: `queued:${hashHex}`,
      chainId: POLYGON_AMOY_CHAIN_ID,
      explorerUrl: "",
    };
  }
  try {
    return await _anchorOnChain(hashHex);
  } catch {
    // Network / RPC / chain failure — queue and return a synthetic id so
    // the UI can render "queued" state. flushQueue will retry later.
    await enqueueHash(hashHex);
    return {
      txHash: `queued:${hashHex}`,
      chainId: POLYGON_AMOY_CHAIN_ID,
      explorerUrl: "",
    };
  }
}

/**
 * Resolve the on-chain status of a previously-anchored tx hash.
 *
 * Returns "queued" for synthetic queued ids, "pending" while the receipt is
 * still null, and "confirmed" / "failed" once mined.
 */
export async function getAnchorStatus(txHash: string): Promise<AnchorStatus> {
  if (txHash.startsWith("queued:")) {
    return "queued";
  }
  const receipt = await provider().getTransactionReceipt(txHash);
  if (receipt === null) {
    return "pending";
  }
  if (receipt.status === 1) {
    return "confirmed";
  }
  return "failed";
}

/**
 * Drain the offline queue, attempting to anchor each hash on-chain.
 *
 * Race-safe: takes the queue snapshot under the mutex, drops it, runs the
 * on-chain submissions OUTSIDE the lock, then re-acquires the lock to merge
 * any hashes that arrived during the long network round-trips with the
 * unprocessed remainder.
 *
 * Returns the list of successful anchor results paired with the originating
 * hash so callers can reconcile to record state; failed hashes are
 * re-enqueued for a future flush.
 */
export async function flushQueue(): Promise<
  Array<{ hashHex: string; result: AnchorResult }>
> {
  if (!ANCHOR_CONTRACT_ADDRESS || !HACKATHON_DEMO_KEY) {
    return [];
  }

  // Snapshot + clear under the lock so concurrent writers don't see the
  // hashes we're about to process and re-enqueue them.
  const snapshot = await withQueueLock(async () => {
    const queue = await getQueue();
    if (queue.length === 0) return [] as string[];
    await setQueue([]);
    return queue;
  });

  if (snapshot.length === 0) return [];

  const results: Array<{ hashHex: string; result: AnchorResult }> = [];
  const failed: string[] = [];

  for (const hashHex of snapshot) {
    try {
      assertValidHash(hashHex);
      const result = await _anchorOnChain(hashHex);
      results.push({ hashHex, result });
    } catch {
      failed.push(hashHex);
    }
  }

  // Merge failures with anything queued during the network window above.
  await withQueueLock(async () => {
    const current = await getQueue();
    await setQueue([...failed, ...current]);
  });

  return results;
}
