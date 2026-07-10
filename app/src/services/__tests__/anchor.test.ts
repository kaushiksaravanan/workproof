/**
 * Unit tests for services/anchor.ts.
 *
 * We mock ethers so no real network calls are made; a stub Contract/Wallet/
 * JsonRpcProvider set drives the anchoring branches. AsyncStorage is mocked
 * globally by jest.setup.js.
 *
 * jest.mock factories may only reference module-level identifiers that begin
 * with `mock` (babel-jest enforces this to catch scope leaks). All test-owned
 * mutable state below uses that prefix.
 */

// eslint-disable-next-line no-var
var mockConfigured = true;
// eslint-disable-next-line no-var
var mockAnchorImpl: (hash: unknown) => Promise<{
  hash: string;
  wait: () => Promise<void>;
}> = async () => ({
  hash: '0xstubtxhash' + Math.floor(Math.random() * 1e6).toString(16),
  wait: async () => undefined,
});
// eslint-disable-next-line no-var
var mockReceiptForTx: (
  txHash: string,
) => Promise<{ status: number } | null> = async () => ({ status: 1 });

jest.mock('../config', () => ({
  get POLYGON_AMOY_RPC() {
    return 'https://amoy.example.local';
  },
  get POLYGON_AMOY_CHAIN_ID() {
    return 80002;
  },
  get HACKATHON_DEMO_KEY() {
    return mockConfigured ? '0x' + '11'.repeat(32) : undefined;
  },
  get ANCHOR_CONTRACT_ADDRESS() {
    return mockConfigured
      ? '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
      : undefined;
  },
}));

jest.mock('ethers', () => ({
  JsonRpcProvider: jest.fn().mockImplementation(() => ({
    getTransactionReceipt: (h: string) => mockReceiptForTx(h),
  })),
  Wallet: jest.fn().mockImplementation((_pk: string, _provider: unknown) => ({
    address: '0xwallet',
  })),
  Contract: jest.fn().mockImplementation(() => ({
    anchor: (h: unknown) => mockAnchorImpl(h),
  })),
  getBytes: jest.fn((h: string) => h),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

const validHash = 'a'.repeat(64);
const anotherHash = 'b'.repeat(64);

const importAnchor = () => {
  // Re-require so the config-mock getters (mockConfigured flag) are re-read
  // through the module load chain.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../anchor') as typeof import('../anchor');
};

beforeEach(async () => {
  // Module state (queueLock, submitLock, _provider) accumulates across tests
  // but stays functionally correct — the locks always resolve, the provider
  // memo is idempotent. We deliberately do NOT jest.resetModules() here
  // because doing so would give the anchor module a fresh AsyncStorage
  // singleton that no longer sees data written via the top-level import.
  await AsyncStorage.clear();
  mockAnchorImpl = async () => ({
    hash: '0xstubtx',
    wait: async () => undefined,
  });
  mockReceiptForTx = async () => ({ status: 1 });
  mockConfigured = true;
});

describe('explorerUrl', () => {
  it('builds a Polygonscan Amoy URL for a tx hash', () => {
    const { explorerUrl } = importAnchor();
    expect(explorerUrl('0xdead')).toBe('https://amoy.polygonscan.com/tx/0xdead');
  });
});

describe('assertValidHash — accepts 64-hex, rejects other lengths', () => {
  it('accepts a 64-lowercase-hex string', async () => {
    const { anchorHash } = importAnchor();
    // no throw → path continues to _anchorOnChain
    await expect(anchorHash(validHash)).resolves.toBeDefined();
  });

  it('rejects a 63-char hash with a descriptive error', async () => {
    const { anchorHash } = importAnchor();
    await expect(anchorHash('a'.repeat(63))).rejects.toThrow(
      /64 hex chars/,
    );
  });

  it('rejects a 66-char hash (0x-prefixed 64) with a descriptive error', async () => {
    const { anchorHash } = importAnchor();
    await expect(anchorHash('0x' + 'a'.repeat(64))).rejects.toThrow(
      /64 hex chars/,
    );
  });

  it('rejects a non-hex string with a descriptive error', async () => {
    const { anchorHash } = importAnchor();
    await expect(anchorHash('z'.repeat(64))).rejects.toThrow(/64 hex chars/);
  });
});

describe('anchorHash — config-missing → queue-only mode', () => {
  beforeEach(() => {
    mockConfigured = false;
  });

  it('returns a queued: synthetic tx id and appends to the queue', async () => {
    const { anchorHash, getQueue } = importAnchor();
    const result = await anchorHash(validHash);
    expect(result.txHash).toBe(`queued:${validHash}`);
    expect(result.explorerUrl).toBe('');
    expect(result.chainId).toBe(80002);
    expect(await getQueue()).toEqual([validHash]);
  });

  it('two enqueues preserve FIFO order in the queue', async () => {
    const { anchorHash, getQueue } = importAnchor();
    await anchorHash(validHash);
    await anchorHash(anotherHash);
    expect(await getQueue()).toEqual([validHash, anotherHash]);
  });

  it('deduplicates: re-anchoring the same hash does not grow the queue', async () => {
    // Repro: user taps 'Retry anchor' twice while offline, or LogWork
    // triggers anchor twice for the same record. The queue must not
    // acquire duplicates — otherwise flushQueue would submit the same
    // hash twice, wasting gas on mainnet.
    const { anchorHash, getQueue } = importAnchor();
    await anchorHash(validHash);
    await anchorHash(validHash);
    await anchorHash(validHash);
    expect(await getQueue()).toEqual([validHash]);
  });
});

describe('anchorHash — configured, on-chain success', () => {
  beforeEach(() => {
    mockConfigured = true;
  });

  it('submits + waits, returns { txHash, chainId, explorerUrl }', async () => {
    mockAnchorImpl = async () => ({
      hash: '0xabc123',
      wait: async () => undefined,
    });
    const { anchorHash } = importAnchor();
    const result = await anchorHash(validHash);
    expect(result.txHash).toBe('0xabc123');
    expect(result.chainId).toBe(80002);
    expect(result.explorerUrl).toBe('https://amoy.polygonscan.com/tx/0xabc123');
  });

  it('does NOT push to the queue on successful anchoring', async () => {
    const { anchorHash, getQueue } = importAnchor();
    await anchorHash(validHash);
    expect(await getQueue()).toEqual([]);
  });
});

describe('anchorHash — configured, on-chain failure falls back to queue', () => {
  beforeEach(() => {
    mockConfigured = true;
  });

  it('on submission rejection, returns queued: id and pushes to queue', async () => {
    mockAnchorImpl = async () => {
      throw new Error('rpc timeout');
    };
    const { anchorHash, getQueue } = importAnchor();
    const result = await anchorHash(validHash);
    expect(result.txHash).toBe(`queued:${validHash}`);
    expect(await getQueue()).toEqual([validHash]);
  });

  it('on tx.wait() rejection, still queues + returns queued: id', async () => {
    mockAnchorImpl = async () => ({
      hash: '0xstub',
      wait: async () => {
        throw new Error('reverted');
      },
    });
    const { anchorHash, getQueue } = importAnchor();
    const result = await anchorHash(validHash);
    expect(result.txHash).toBe(`queued:${validHash}`);
    expect(await getQueue()).toEqual([validHash]);
  });
});

describe('getQueue — corruption resilience', () => {
  beforeEach(() => {
  });

  it('returns [] when the queue key is missing', async () => {
    const { getQueue } = importAnchor();
    expect(await getQueue()).toEqual([]);
  });

  it('returns [] when the stored JSON is malformed', async () => {
    await AsyncStorage.setItem('@workproof/anchor-queue', '{{corrupt');
    const { getQueue } = importAnchor();
    expect(await getQueue()).toEqual([]);
  });

  it('returns [] when the stored value is not an array', async () => {
    await AsyncStorage.setItem(
      '@workproof/anchor-queue',
      JSON.stringify({ garbage: true }),
    );
    const { getQueue } = importAnchor();
    expect(await getQueue()).toEqual([]);
  });
});

describe('getAnchorStatus', () => {
  beforeEach(() => {
  });

  it("returns 'queued' for queued: prefix", async () => {
    const { getAnchorStatus } = importAnchor();
    expect(await getAnchorStatus(`queued:${validHash}`)).toBe('queued');
  });

  it("returns 'pending' when the receipt is null", async () => {
    mockReceiptForTx = async () => null;
    const { getAnchorStatus } = importAnchor();
    expect(await getAnchorStatus('0xreal')).toBe('pending');
  });

  it("returns 'confirmed' when receipt.status === 1", async () => {
    mockReceiptForTx = async () => ({ status: 1 });
    const { getAnchorStatus } = importAnchor();
    expect(await getAnchorStatus('0xreal')).toBe('confirmed');
  });

  it("returns 'failed' when receipt.status !== 1", async () => {
    mockReceiptForTx = async () => ({ status: 0 });
    const { getAnchorStatus } = importAnchor();
    expect(await getAnchorStatus('0xreal')).toBe('failed');
  });
});

describe('flushQueue', () => {
  beforeEach(() => {
  });

  it('returns [] and touches nothing when config is missing', async () => {
    mockConfigured = false;
    await AsyncStorage.setItem(
      '@workproof/anchor-queue',
      JSON.stringify([validHash]),
    );
    const { flushQueue, getQueue } = importAnchor();
    expect(await flushQueue()).toEqual([]);
    // Queue untouched — flush is a no-op in unconfigured mode.
    expect(await getQueue()).toEqual([validHash]);
  });

  it('returns [] when the queue is empty', async () => {
    mockConfigured = true;
    const { flushQueue } = importAnchor();
    expect(await flushQueue()).toEqual([]);
  });

  it('anchors every queued hash and clears the queue on full success', async () => {
    mockConfigured = true;
    mockAnchorImpl = async () => ({
      hash: '0x' + Math.random().toString(16).slice(2, 10),
      wait: async () => undefined,
    });
    await AsyncStorage.setItem(
      '@workproof/anchor-queue',
      JSON.stringify([validHash, anotherHash]),
    );
    const { flushQueue, getQueue } = importAnchor();
    const results = await flushQueue();
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.hashHex).sort()).toEqual(
      [validHash, anotherHash].sort(),
    );
    expect(await getQueue()).toEqual([]);
  });

  it('re-queues hashes whose on-chain submission failed', async () => {
    mockConfigured = true;
    let call = 0;
    mockAnchorImpl = async () => {
      call += 1;
      if (call === 1) {
        return { hash: '0xok', wait: async () => undefined };
      }
      throw new Error('rpc dropped');
    };
    await AsyncStorage.setItem(
      '@workproof/anchor-queue',
      JSON.stringify([validHash, anotherHash]),
    );
    const { flushQueue, getQueue } = importAnchor();
    const results = await flushQueue();
    expect(results).toHaveLength(1);
    expect(results[0].hashHex).toBe(validHash);
    // The failed hash is re-enqueued.
    expect(await getQueue()).toEqual([anotherHash]);
  });

  it('re-queues hashes that fail assertValidHash mid-flush', async () => {
    mockConfigured = true;
    await AsyncStorage.setItem(
      '@workproof/anchor-queue',
      JSON.stringify([validHash, 'not-a-valid-hash']),
    );
    const { flushQueue, getQueue } = importAnchor();
    const results = await flushQueue();
    expect(results).toHaveLength(1);
    expect(await getQueue()).toEqual(['not-a-valid-hash']);
  });

  it('merge-dedupes: a failed hash re-queued during the network window does not double-list', async () => {
    // With the crash-safe remove-on-success design, the queue is not drained
    // up front — items stay put until anchored. So if anchorHash(validHash)
    // is called again during a slow tx.wait(), enqueueHash's dedup guard sees
    // validHash still in the queue and skips the re-add. Net: queue stays as
    // [validHash] regardless of retry attempts. Verify.
    mockConfigured = true;
    mockAnchorImpl = async () => {
      // Simulate concurrent re-enqueue during the network window. Since the
      // hash is still in the queue (not drained), enqueueHash's includes()
      // guard skips the push — this direct write emulates 'someone called
      // enqueueHash and it correctly no-op'd'.
      await AsyncStorage.setItem(
        '@workproof/anchor-queue',
        JSON.stringify([validHash]),
      );
      throw new Error('rpc dropped');
    };
    await AsyncStorage.setItem(
      '@workproof/anchor-queue',
      JSON.stringify([validHash]),
    );
    const { flushQueue, getQueue } = importAnchor();
    const results = await flushQueue();
    expect(results).toEqual([]);
    // Queue still has exactly one entry — no duplicates, no data loss.
    expect(await getQueue()).toEqual([validHash]);
  });

  it('crash-safe: unprocessed items remain in the queue if the loop exits early', async () => {
    // Regression scenario: OS kills the app mid-flush (e.g., iOS terminates
    // a backgrounded RN app during a long tx.wait). With the old drain-first
    // design, snapshot items were removed BEFORE anchor confirmation, so a
    // process kill mid-loop lost them. New design: items stay in the queue
    // until each is confirmed anchored, so a killed flush leaves them intact.
    //
    // We simulate 'killed mid-loop' by throwing on the SECOND anchor after
    // the FIRST succeeds. The first item's success removes it; the second
    // stays. If the flush is later retried, the queue is [second only].
    mockConfigured = true;
    let call = 0;
    mockAnchorImpl = async () => {
      call += 1;
      if (call === 1) {
        return { hash: '0xok', wait: async () => undefined };
      }
      throw new Error('killed');
    };
    await AsyncStorage.setItem(
      '@workproof/anchor-queue',
      JSON.stringify([validHash, anotherHash]),
    );
    const { flushQueue, getQueue } = importAnchor();
    const results = await flushQueue();
    // First item confirmed anchored → returned in results, removed from queue.
    expect(results).toHaveLength(1);
    expect(results[0].hashHex).toBe(validHash);
    // Second item failed → stays in queue for next flush retry.
    expect(await getQueue()).toEqual([anotherHash]);
  });

  it('reconcile callback fires BEFORE the queue-remove step (crash-safe ordering)', async () => {
    // The callback runs after on-chain success but before removing the hash
    // from the queue. Verify by checking that at the moment the callback
    // fires, the hash is still in the queue.
    mockConfigured = true;
    mockAnchorImpl = async () => ({
      hash: '0xok',
      wait: async () => undefined,
    });
    await AsyncStorage.setItem(
      '@workproof/anchor-queue',
      JSON.stringify([validHash]),
    );
    const { flushQueue, getQueue } = importAnchor();
    let queueAtReconcile: string[] | null = null;
    const reconcile = async (): Promise<void> => {
      queueAtReconcile = await getQueue();
    };
    const results = await flushQueue(reconcile);
    expect(results).toHaveLength(1);
    // At reconcile time, the hash was still in the queue (order: anchor →
    // reconcile → remove). This is the crash-safe ordering that prevents
    // the "anchored on-chain but stuck as queued locally" divergence.
    expect(queueAtReconcile).toEqual([validHash]);
    // After the whole flow, it's gone.
    expect(await getQueue()).toEqual([]);
  });

  it('reconcile failure leaves the hash in the queue for retry', async () => {
    // If the reconcile callback throws (local state update failed), we do
    // NOT remove the hash from the queue. Next flush re-anchors (harmless
    // idempotent op on-chain) and retries reconcile. Better to double-anchor
    // than to permanently diverge from on-chain truth.
    mockConfigured = true;
    mockAnchorImpl = async () => ({
      hash: '0xok',
      wait: async () => undefined,
    });
    await AsyncStorage.setItem(
      '@workproof/anchor-queue',
      JSON.stringify([validHash]),
    );
    const { flushQueue, getQueue } = importAnchor();
    const reconcile = async (): Promise<void> => {
      throw new Error('setAnchored blew up');
    };
    const results = await flushQueue(reconcile);
    // The anchor DID succeed on-chain, so we still return it in results.
    expect(results).toHaveLength(1);
    // But the queue-remove step was skipped, so it's still there for retry.
    expect(await getQueue()).toEqual([validHash]);
  });

  it('re-entrance guard: concurrent flushQueue calls share the same promise', async () => {
    // Regression: without the flushInFlight guard, App.tsx's initial hydrate
    // IIFE and the AppState 'active' listener can both invoke flushQueue
    // during a slow drain. Both would snapshot the SAME items (queue-remove
    // happens AFTER each on-chain confirm), _anchorOnChain each of them
    // twice, and pay gas twice per proof. The guard collapses concurrent
    // callers onto a single in-flight promise.
    mockConfigured = true;
    let anchorCalls = 0;
    mockAnchorImpl = async () => {
      anchorCalls += 1;
      // Simulate a slow tx.wait() so the second flushQueue call arrives
      // mid-drain.
      await new Promise((r) => setTimeout(r, 20));
      return { hash: `0xok${anchorCalls}`, wait: async () => undefined };
    };
    await AsyncStorage.setItem(
      '@workproof/anchor-queue',
      JSON.stringify([validHash, anotherHash]),
    );
    const { flushQueue, getQueue } = importAnchor();

    // Fire two concurrent flushQueue calls. They must resolve to the SAME
    // result object (shared promise) and _anchorOnChain must fire exactly
    // once per hash (2 calls total, not 4).
    const [resultsA, resultsB] = await Promise.all([
      flushQueue(),
      flushQueue(),
    ]);

    // Same reference — both callers got the same in-flight promise.
    expect(resultsA).toBe(resultsB);
    expect(resultsA).toHaveLength(2);
    // Exactly 2 on-chain submissions, one per hash. Not 4.
    expect(anchorCalls).toBe(2);
    // Queue was drained.
    expect(await getQueue()).toEqual([]);
  });

  it('reconcile-attempt cap: after MAX_RECONCILE_ATTEMPTS the hash moves to dead-letter', async () => {
    // Regression: persistent AsyncStorage failure on the reconcile side
    // (iOS storage quota, Android disk full, corrupted key) used to cause
    // an infinite anchor-forever loop — every foreground bounce would
    // re-submit the same hash on-chain and burn gas each time. Now:
    // 5 reconcile failures moves the hash into a dead-letter list that
    // scheduled flushes ignore, and the queue-remove step runs so we
    // stop re-anchoring on the next flush.
    mockConfigured = true;
    mockAnchorImpl = async () => ({
      hash: '0xok',
      wait: async () => undefined,
    });
    await AsyncStorage.setItem(
      '@workproof/anchor-queue',
      JSON.stringify([validHash]),
    );
    const { flushQueue, getQueue, getDeadLetter } = importAnchor();

    const failingReconcile = async (): Promise<void> => {
      throw new Error('AsyncStorage full');
    };

    // 5 flush attempts, all with reconcile failure. Each bumps the
    // per-hash counter. On the 5th attempt the hash moves to dead-letter.
    for (let i = 0; i < 5; i++) {
      await flushQueue(failingReconcile);
    }

    // After the cap: hash left the queue, landed in dead-letter.
    expect(await getQueue()).toEqual([]);
    expect(await getDeadLetter()).toEqual([validHash]);
  });

  it('reconcile-attempt counter resets on eventual success', async () => {
    // If a reconcile fails once, then succeeds on retry, the counter is
    // cleared so a future transient failure gets its full retry budget
    // instead of inheriting the earlier failures.
    mockConfigured = true;
    mockAnchorImpl = async () => ({
      hash: '0xok',
      wait: async () => undefined,
    });
    await AsyncStorage.setItem(
      '@workproof/anchor-queue',
      JSON.stringify([validHash]),
    );
    const { flushQueue, getQueue } = importAnchor();

    let reconcileCall = 0;
    const flaky = async (): Promise<void> => {
      reconcileCall += 1;
      if (reconcileCall === 1) throw new Error('transient');
      // Success on retry.
    };

    await flushQueue(flaky); // fails, bumps counter to 1, hash still in queue
    expect(await getQueue()).toEqual([validHash]);

    await flushQueue(flaky); // succeeds, counter cleared, hash removed
    expect(await getQueue()).toEqual([]);

    // Verify counter is cleared by reading the attempts key directly.
    const rawAttempts = await AsyncStorage.getItem(
      '@workproof/anchor-reconcile-attempts',
    );
    const attempts = rawAttempts ? JSON.parse(rawAttempts) : {};
    expect(attempts[validHash]).toBeUndefined();
  });
});
