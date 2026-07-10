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
    // Simulate the race: flushQueue takes a snapshot of [validHash], tries
    // to anchor it (fails). While that's happening, anchorHash(validHash)
    // is called again from the UI ('Retry anchor' tap), which enqueues
    // validHash into the now-empty queue → current queue = [validHash].
    // flushQueue's merge step must dedupe so the queue doesn't end up as
    // [validHash, validHash].
    mockConfigured = true;
    mockAnchorImpl = async () => {
      // Simulate a re-enqueue during the network window. Directly writing
      // through the storage layer is the simplest way to model 'another
      // caller enqueued while we were awaiting the tx'.
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
    // The naive `[...failed, ...current]` would have produced
    // [validHash, validHash]; the dedup step collapses it to one.
    expect(await getQueue()).toEqual([validHash]);
  });
});
