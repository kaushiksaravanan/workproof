import type { WorkRecord } from '../types';

/**
 * Shared record predicates + formatters. Home and History both consume these
 * so an "anchored" badge means the same thing everywhere — and a single line
 * of code defines what counts as anchored vs pending.
 */

/**
 * Prefix used to synthesize a "queued" tx id when a proof was submitted
 * offline (anchorHash → enqueueHash). Anything with this prefix is a
 * placeholder that flushQueue will replace once the on-chain anchor lands.
 *
 * Consumers (anchor.ts producers, ProofDetail's isQueuedTx, reconcile.ts's
 * filter, App.tsx's drainQueueAndReconcile) all reference this constant so
 * a format change here propagates everywhere instead of silently drifting.
 */
export const QUEUED_TX_PREFIX = 'queued:';

/** Build the synthetic queued tx id for a given record hash. */
export function makeQueuedTxId(hashHex: string): string {
  return `${QUEUED_TX_PREFIX}${hashHex}`;
}

/**
 * A record is anchored only when both the tx hash AND the chain id are
 * recorded AND the tx hash is a real on-chain hash (not the synthetic
 * `queued:<hash>` placeholder that anchorHash returns when offline).
 */
export function isAnchored(record: WorkRecord): boolean {
  return Boolean(
    record.anchorTxHash &&
      record.anchorChainId &&
      !record.anchorTxHash.startsWith(QUEUED_TX_PREFIX),
  );
}

/**
 * The record has been submitted but is still in the offline anchor queue.
 * Distinct from "anchored" — used to drive the "Queued for chain" chip.
 */
export function isQueuedAnchor(record: WorkRecord): boolean {
  return Boolean(
    record.anchorTxHash && record.anchorTxHash.startsWith(QUEUED_TX_PREFIX),
  );
}

const HASH_PREFIX_LEN = 8;

/**
 * Truncate a hash to the first 8 hex chars, preserving any "0x" prefix so the
 * caller can render it as e.g. "0xabcdef12".
 */
export function shortHash(hash: string): string {
  if (!hash) return '';
  const has0x = hash.startsWith('0x');
  const body = has0x ? hash.slice(2) : hash;
  const truncated =
    body.length > HASH_PREFIX_LEN ? body.slice(0, HASH_PREFIX_LEN) : body;
  return has0x ? `0x${truncated}` : truncated;
}

/**
 * Split a hex hash into fixed-size chunks for human-readable rendering.
 * Returns the chunks as an array so callers can choose their own join.
 */
export function chunkHash(hash: string, size = 8): string[] {
  if (!hash || size <= 0) return [];
  const out: string[] = [];
  for (let i = 0; i < hash.length; i += size) {
    out.push(hash.slice(i, i + size));
  }
  return out;
}

/**
 * Convenience wrapper around `chunkHash` that joins the chunks with a
 * separator. Defaults to `"deadbeef cafef00d ..."` style.
 */
export function chunkHashJoined(hash: string, size = 8, sep = ' '): string {
  return chunkHash(hash, size).join(sep);
}

/** Sum (received + pending), formatted for the row trailing label. */
export function formatRecordAmount(record: WorkRecord): string {
  const received = record.amountReceived ?? 0;
  const pending = record.amountPending ?? 0;
  const total = received + pending;
  return `₹${total.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
