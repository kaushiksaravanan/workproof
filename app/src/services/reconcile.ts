import type { WorkRecord, AnchorResult } from '../types';

/**
 * After `flushQueue()` drains the offline anchor queue, walk each successful
 * result and mark the matching in-memory records as anchored. Called both on
 * initial app hydrate and every time the app returns to foreground.
 *
 * Pure over its inputs — takes the flush results, the current records list,
 * and the setAnchored mutator; no direct store or storage dependency. This
 * makes the reconcile step trivially unit-testable.
 *
 * A record is considered "queued for this hashHex" if BOTH:
 *   - record.hash === hashHex             (we know which record it is)
 *   - record.anchorTxHash === `queued:` + hashHex   (it was actually queued)
 * The double-match protects against a rare case where two records happen to
 * share a hash but only one was queued for anchoring.
 *
 * Individual setAnchored failures are swallowed: a subsequent flush + reconcile
 * will retry them, and one bad record shouldn't block others.
 */
export async function reconcileAnchoredHashes(
  results: Array<{ hashHex: string; result: AnchorResult }>,
  records: WorkRecord[],
  setAnchored: (
    id: string,
    txHash: string,
    chainId: number,
  ) => Promise<void>,
): Promise<void> {
  for (const { hashHex, result } of results) {
    const queuedRecords = records.filter(
      (r) =>
        r.hash === hashHex && r.anchorTxHash === `queued:${hashHex}`,
    );
    for (const r of queuedRecords) {
      try {
        await setAnchored(r.id, result.txHash, result.chainId);
      } catch {
        // Ignore per-record failures; the outer flush cadence retries.
      }
    }
  }
}
