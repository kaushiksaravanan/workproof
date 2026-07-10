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

import { JsonRpcProvider, Contract, getBytes } from "ethers";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { AnchorResult, AnchorStatus } from "../types";
import { QUEUED_TX_PREFIX, makeQueuedTxId } from "../utils/record";
import { getOrCreateWallet } from "./identity";
import {
  POLYGON_AMOY_RPC,
  POLYGON_AMOY_CHAIN_ID,
  ANCHOR_CONTRACT_ADDRESS,
} from "./config";

/** AsyncStorage key for the offline anchor queue. */
const ANCHOR_QUEUE_KEY = "@workproof/anchor-queue";

/**
 * AsyncStorage key for per-hash reconcile-attempt counts. When
 * MAX_RECONCILE_ATTEMPTS is exceeded, the hash is removed from the queue
 * and appended to the dead-letter list — the on-chain anchor already
 * landed, but we've given up trying to reconcile it with local state.
 * A future recovery UI can drain the dead-letter list manually.
 */
const RECONCILE_ATTEMPTS_KEY = "@workproof/anchor-reconcile-attempts";
const DEAD_LETTER_KEY = "@workproof/anchor-dead-letter";
const MAX_RECONCILE_ATTEMPTS = 5;

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

/**
 * Queue entry. Each queued hash carries the signer's wallet address at the
 * time of enqueue so a later flush can refuse to anchor from a rotated
 * wallet (which would silently break the pdf-to-chain identity binding).
 *
 * For backward-compat with entries written before this change (bare
 * string[]), getQueue tolerates both shapes and normalizes to entries.
 * Entries without workerAddress use the special sentinel '' — those
 * entries CAN still be anchored (best-effort), but flushQueue skips them
 * when a strict-signer wallet mismatch is detected.
 */
export interface QueueEntry {
  hashHex: string;
  workerAddress: string;
}

function isQueueEntry(v: unknown): v is QueueEntry {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { hashHex?: unknown }).hashHex === "string" &&
    typeof (v as { workerAddress?: unknown }).workerAddress === "string"
  );
}

/**
 * Read the queued anchor entries from AsyncStorage (oldest first).
 * Backward-compatible with the pre-signer-binding shape (bare string[]) —
 * legacy entries surface as QueueEntry with workerAddress = '' so the
 * caller can distinguish them.
 */
export async function getQueue(): Promise<QueueEntry[]> {
  const raw = await AsyncStorage.getItem(ANCHOR_QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: QueueEntry[] = [];
    for (const item of parsed) {
      if (typeof item === "string") {
        // Legacy bare-string entry — no signer binding.
        out.push({ hashHex: item, workerAddress: "" });
      } else if (isQueueEntry(item)) {
        out.push(item);
      }
      // Anything else is corrupt; skip silently.
    }
    return out;
  } catch {
    return [];
  }
}

async function setQueue(queue: QueueEntry[]): Promise<void> {
  await AsyncStorage.setItem(ANCHOR_QUEUE_KEY, JSON.stringify(queue));
}

// ---------------------------------------------------------------------------
// Reconcile-attempt bookkeeping — prevents the anchor-forever loop when
// on-chain success is followed by a persistent local write failure (iOS
// storage quota, Android disk full, corrupted AsyncStorage key). Without a
// cap, every foreground bounce would re-submit the same hash on-chain
// forever, burning gas on each retry.
//
// The counter is bumped when a reconcile throws. When it hits
// MAX_RECONCILE_ATTEMPTS, the hash moves out of the retry queue into a
// dead-letter bucket that no scheduled flush touches (a future recovery
// UI can drain it explicitly).
// ---------------------------------------------------------------------------

/**
 * Read a single hash's reconcile-attempt count. Stored as its own
 * AsyncStorage key (`@workproof/anchor-reconcile-attempts:<hash>`) so
 * one hash's corrupted counter can't wipe out every other hash's budget.
 */
async function getReconcileAttempts(hashHex: string): Promise<number> {
  const raw = await AsyncStorage.getItem(
    `${RECONCILE_ATTEMPTS_KEY}:${hashHex}`,
  );
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

async function setReconcileAttempts(
  hashHex: string,
  count: number,
): Promise<void> {
  await AsyncStorage.setItem(
    `${RECONCILE_ATTEMPTS_KEY}:${hashHex}`,
    String(count),
  );
}

async function clearReconcileAttempts(hashHex: string): Promise<void> {
  await AsyncStorage.removeItem(`${RECONCILE_ATTEMPTS_KEY}:${hashHex}`);
}

/** Read the dead-letter list (hashes we anchored on-chain but couldn't reconcile locally). */
export async function getDeadLetter(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(DEAD_LETTER_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

async function setDeadLetter(list: string[]): Promise<void> {
  await AsyncStorage.setItem(DEAD_LETTER_KEY, JSON.stringify(list));
}

/**
 * Append a hash to the offline queue (atomic via mutex, deduped).
 * Records the signer's current wallet address alongside the hash so
 * flushQueue can detect wallet rotation between enqueue and flush and
 * refuse to anchor with the wrong signer.
 */
async function enqueueHash(hashHex: string): Promise<void> {
  const walletAddress = (await getOrCreateWallet()).address;
  await withQueueLock(async () => {
    const queue = await getQueue();
    // Skip if already queued — otherwise a double-tap on 'Retry anchor'
    // would submit the same hash twice (gas waste on mainnet; harmless on
    // testnet but still worth avoiding).
    if (queue.some((e) => e.hashHex === hashHex)) return;
    queue.push({ hashHex, workerAddress: walletAddress });
    await setQueue(queue);
  });
}

/**
 * Submit a hash on-chain using this install's per-install wallet. Caller
 * MUST have validated `hashHex` and confirmed contract config is available —
 * this helper does NOT enqueue on missing config.
 *
 * Concurrency: routed through `submitLock` so concurrent callers don't race
 * on the per-install wallet's pending nonce.
 */
async function _anchorOnChain(hashHex: string): Promise<AnchorResult> {
  return withSubmitLock(async () => {
    const wallet = (await getOrCreateWallet()).connect(provider());
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
 * If the contract address is missing, OR if the on-chain submission fails
 * (offline, RPC timeout, chain congestion), the hash is queued locally and
 * a synthetic `queued:<hash>` tx id is returned. Callers
 * can rely on `flushQueue` to drain the backlog later.
 */
export async function anchorHash(hashHex: string): Promise<AnchorResult> {
  assertValidHash(hashHex);
  if (!ANCHOR_CONTRACT_ADDRESS) {
    await enqueueHash(hashHex);
    return {
      txHash: makeQueuedTxId(hashHex),
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
      txHash: makeQueuedTxId(hashHex),
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
  if (txHash.startsWith(QUEUED_TX_PREFIX)) {
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
 * Crash-safe: reads the queue WITHOUT clearing it, then removes each hash
 * from the queue only AFTER its on-chain submission succeeds AND (if a
 * reconcile callback was provided) the local record state has been updated.
 * If the OS kills the app mid-drain, unprocessed items remain in
 * AsyncStorage and the next flush retries them.
 *
 * The `reconcile` callback, if passed, is invoked AFTER the on-chain success
 * but BEFORE the queue-remove step. This ordering means: crashes between
 * anchor-success and queue-remove result in a re-anchor next flush (harmless
 * on the idempotent contract; a small gas cost on mainnet), but the local
 * record state is never left stuck at "queued" when the on-chain tx has
 * actually landed. Without the callback, callers can still reconcile from
 * the returned results but risk data loss if the process is killed between
 * flushQueue returning and their reconcile step completing.
 *
 * Concurrent `enqueueHash` calls during a flush are no-ops for hashes
 * currently being processed, because the dedup guard in enqueueHash sees
 * the hash still in the queue.
 *
 * Returns the list of successful anchor results paired with the originating
 * hash. Failed hashes stay in the queue for a future flush.
 */
// ---------------------------------------------------------------------------
// Flush in-flight guard — flushQueue is called from multiple places (App
// mount effect + every AppState 'active' event). Without this, a slow drain
// on cold launch + a foreground bounce during it would cause two concurrent
// flushQueue calls to both snapshot the same [h1,h2,h3] (queue-remove happens
// AFTER each on-chain confirm), both call _anchorOnChain on every hash, and
// the app would submit every queued hash TWICE on-chain (real gas cost on
// mainnet, wasted testnet gas, two Anchored events per proof).
//
// Concurrent callers share the same promise. When it settles, the guard
// clears so a subsequent foreground bounce can start a fresh flush of any
// items that arrived during the previous drain.
// ---------------------------------------------------------------------------

let flushInFlight: Promise<
  Array<{ hashHex: string; result: AnchorResult }>
> | null = null;

export async function flushQueue(
  reconcile?: (
    hashHex: string,
    result: AnchorResult,
  ) => Promise<void>,
): Promise<Array<{ hashHex: string; result: AnchorResult }>> {
  if (flushInFlight) return flushInFlight;
  flushInFlight = _flushQueue(reconcile).finally(() => {
    flushInFlight = null;
  });
  return flushInFlight;
}

async function _flushQueue(
  reconcile?: (
    hashHex: string,
    result: AnchorResult,
  ) => Promise<void>,
): Promise<Array<{ hashHex: string; result: AnchorResult }>> {
  if (!ANCHOR_CONTRACT_ADDRESS) {
    return [];
  }

  // Snapshot the queue without clearing it. Items stay in AsyncStorage
  // through their entire anchor attempt so a mid-flight process kill
  // doesn't lose them.
  const snapshot = await withQueueLock(async () => {
    return await getQueue();
  });

  if (snapshot.length === 0) return [];

  const results: Array<{ hashHex: string; result: AnchorResult }> = [];

  // Resolve the current signer wallet address LAZILY per-entry. Legacy
  // entries (workerAddress='') don't need it, so we can still make
  // progress even if identity is temporarily unavailable (keystore locked
  // at boot, e.g.). A single failure here is cached so we don't spam
  // secure-store per iteration when identity truly is broken.
  let currentWalletAddress: string | null = null;
  let identityFailed = false;
  const resolveCurrentAddress = async (): Promise<string | null> => {
    if (currentWalletAddress !== null) return currentWalletAddress;
    if (identityFailed) return null;
    try {
      const wallet = await getOrCreateWallet();
      currentWalletAddress = wallet.address.toLowerCase();
      return currentWalletAddress;
    } catch {
      // Identity unavailable. Signer-mismatch check will treat as
      // 'cannot verify' and skip strict-signer entries this pass;
      // legacy entries still proceed.
      identityFailed = true;
      return null;
    }
  };

  for (const entry of snapshot) {
    const { hashHex, workerAddress: expectedSigner } = entry;
    // Validate the hash BEFORE any dead-letter routing — a malformed
    // hash is a data corruption issue, not an identity mismatch, so
    // treat it as a queue error and leave it in place for a future
    // manual review (or the assertValidHash throw path below).
    try {
      assertValidHash(hashHex);
    } catch {
      // Malformed queued hash — leave in the queue; assertValidHash's
      // rethrow below handles this. (Continue so the per-entry try/catch
      // handles the actual throw path uniformly.)
    }
    // Signer mismatch → refuse to anchor. workerAddress='' is a legacy
    // entry from before this schema change; anchor it (best-effort, no
    // stricter guarantee available). Otherwise the current wallet MUST
    // match — anchoring with a rotated wallet would produce an
    // Anchored(hash, worker=new, ...) on-chain event whose `worker`
    // doesn't match the WorkRecord's workerAddress, silently breaking
    // the pdf-to-chain identity binding.
    if (expectedSigner !== "") {
      const cur = await resolveCurrentAddress();
      if (cur === null) {
        // Identity is unavailable — we can't verify the signer.
        // Leave the entry in the queue for a future flush (once identity
        // is loadable again). Do NOT dead-letter — that would be a
        // permanent decision based on a transient identity failure.
        continue;
      }
      if (expectedSigner.toLowerCase() !== cur) {
        // Move this entry to dead-letter and skip. The record is now
        // orphan-anchorable-locally: on-chain anchor never happened, but
        // the current wallet isn't the one the user attributed it to.
        // A recovery UI can decide what to do (surface, delete, re-attest).
        await withQueueLock(async () => {
          const current = await getQueue();
          await setQueue(current.filter((e) => e.hashHex !== hashHex));
          const dead = await getDeadLetter();
          if (!dead.includes(hashHex)) {
            await setDeadLetter([...dead, hashHex]);
          }
        });
        continue;
      }
    }
    try {
      assertValidHash(hashHex);
      const result = await _anchorOnChain(hashHex);
      results.push({ hashHex, result });
      // Reconcile the record BEFORE removing from the queue. If we crash
      // between anchor and reconcile, next flush re-anchors (idempotent);
      // the record never gets stuck in the "queued locally but anchored
      // on-chain" divergence.
      if (reconcile) {
        try {
          await reconcile(hashHex, result);
          // Reconcile succeeded — clear this hash's attempt counter.
          await withQueueLock(async () => {
            await clearReconcileAttempts(hashHex);
          });
        } catch {
          // Reconcile failure: normally we'd leave the hash in the queue
          // so the next flush retries. But if reconcile has been failing
          // repeatedly (persistent AsyncStorage issue — disk full, quota
          // exceeded, corrupted keys), retrying on every foreground would
          // re-submit the same hash on-chain forever and burn gas each
          // time. Bump the attempt counter; if it hits the cap, move
          // the hash to a dead-letter list that scheduled flushes ignore.
          const shouldDeadLetter = await withQueueLock(async () => {
            const current = await getReconcileAttempts(hashHex);
            const next = current + 1;
            await setReconcileAttempts(hashHex, next);
            return next >= MAX_RECONCILE_ATTEMPTS;
          });
          if (shouldDeadLetter) {
            // Move from queue → dead-letter. On-chain anchor already
            // succeeded; local state stays diverged until a future
            // recovery UI drains the dead-letter list explicitly.
            await withQueueLock(async () => {
              const current = await getQueue();
              await setQueue(current.filter((e) => e.hashHex !== hashHex));
              const dead = await getDeadLetter();
              if (!dead.includes(hashHex)) {
                // Cap the dead-letter list at 1000 entries to bound
                // AsyncStorage bloat. Oldest entries evicted first.
                const nextDead =
                  dead.length >= 1000
                    ? [...dead.slice(dead.length - 999), hashHex]
                    : [...dead, hashHex];
                await setDeadLetter(nextDead);
              }
              await clearReconcileAttempts(hashHex);
            });
          }
          continue;
        }
      }
      // Remove this hash from the queue now that both the on-chain anchor
      // and the local reconcile have succeeded. Under the lock so a
      // concurrent enqueue can't get lost in a read-modify-write race.
      await withQueueLock(async () => {
        const current = await getQueue();
        await setQueue(current.filter((e) => e.hashHex !== hashHex));
      });
    } catch {
      // Leave the failed hash in the queue for a future flush. No merge
      // step needed — items are removed on success, not batch-rewritten.
    }
  }

  return results;
}
