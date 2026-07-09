/**
 * Unit tests for utils/record.ts — the shared predicates + formatters that
 * drive Home/History/ProofDetail state chips and hash rendering.
 */

import type { WorkRecord } from '../../types';
import {
  isAnchored,
  isQueuedAnchor,
  shortHash,
  chunkHash,
  chunkHashJoined,
  formatRecordAmount,
} from '../record';

function makeRecord(overrides: Partial<WorkRecord> = {}): WorkRecord {
  return {
    id: 'rec-1',
    createdAt: '2026-07-01T00:00:00.000Z',
    workType: 'plastering',
    amountReceived: 0,
    amountPending: 0,
    photoUri: '',
    transcript: '',
    hash: '0xdeadbeefcafebabe',
    ...overrides,
  };
}

describe('isAnchored', () => {
  it('returns true only when txHash + chainId are set AND tx is not queued', () => {
    expect(
      isAnchored(
        makeRecord({ anchorTxHash: '0xabc123', anchorChainId: 80002 }),
      ),
    ).toBe(true);
  });

  it('returns false when txHash is missing', () => {
    expect(isAnchored(makeRecord({ anchorChainId: 80002 }))).toBe(false);
  });

  it('returns false when chainId is missing', () => {
    expect(isAnchored(makeRecord({ anchorTxHash: '0xabc' }))).toBe(false);
  });

  it("returns false for the synthetic 'queued:' placeholder", () => {
    expect(
      isAnchored(
        makeRecord({ anchorTxHash: 'queued:0xabc', anchorChainId: 80002 }),
      ),
    ).toBe(false);
  });

  it('returns false when neither is set (fresh record)', () => {
    expect(isAnchored(makeRecord())).toBe(false);
  });
});

describe('isQueuedAnchor', () => {
  it('returns true when txHash starts with "queued:"', () => {
    expect(isQueuedAnchor(makeRecord({ anchorTxHash: 'queued:0xabc' }))).toBe(
      true,
    );
  });

  it('returns false when txHash is a real on-chain hash', () => {
    expect(isQueuedAnchor(makeRecord({ anchorTxHash: '0xabc123' }))).toBe(
      false,
    );
  });

  it('returns false when txHash is missing', () => {
    expect(isQueuedAnchor(makeRecord())).toBe(false);
  });

  it('returns false when txHash is empty string', () => {
    expect(isQueuedAnchor(makeRecord({ anchorTxHash: '' }))).toBe(false);
  });
});

describe('shortHash', () => {
  it('truncates a 0x-prefixed hex to 8 body chars, preserving the prefix', () => {
    expect(shortHash('0xdeadbeefcafebabe1234')).toBe('0xdeadbeef');
  });

  it('truncates a non-0x hex to 8 chars', () => {
    expect(shortHash('deadbeefcafebabe1234')).toBe('deadbeef');
  });

  it('returns the whole string when shorter than 8 body chars', () => {
    expect(shortHash('0xabc')).toBe('0xabc');
    expect(shortHash('abc')).toBe('abc');
  });

  it('returns empty string for empty input', () => {
    expect(shortHash('')).toBe('');
  });

  it('preserves exact 8-char body without truncation', () => {
    expect(shortHash('0xabcdef01')).toBe('0xabcdef01');
  });
});

describe('chunkHash', () => {
  it('splits a hex string into fixed-size chunks', () => {
    expect(chunkHash('deadbeefcafebabe12345678', 8)).toEqual([
      'deadbeef',
      'cafebabe',
      '12345678',
    ]);
  });

  it('handles a partial final chunk', () => {
    expect(chunkHash('deadbeefcafe', 8)).toEqual(['deadbeef', 'cafe']);
  });

  it('returns [] for empty input', () => {
    expect(chunkHash('', 8)).toEqual([]);
  });

  it('returns [] for size <= 0', () => {
    expect(chunkHash('deadbeef', 0)).toEqual([]);
    expect(chunkHash('deadbeef', -1)).toEqual([]);
  });

  it('defaults size to 8', () => {
    expect(chunkHash('deadbeefcafe')).toEqual(['deadbeef', 'cafe']);
  });
});

describe('chunkHashJoined', () => {
  it('joins chunks with the default space separator', () => {
    expect(chunkHashJoined('deadbeefcafebabe')).toBe('deadbeef cafebabe');
  });

  it('accepts a custom separator', () => {
    expect(chunkHashJoined('deadbeefcafebabe', 8, '-')).toBe(
      'deadbeef-cafebabe',
    );
  });

  it('accepts a custom chunk size', () => {
    expect(chunkHashJoined('deadbeef', 4, ' ')).toBe('dead beef');
  });
});

describe('formatRecordAmount', () => {
  it('sums received + pending and prefixes with ₹', () => {
    expect(
      formatRecordAmount(makeRecord({ amountReceived: 500, amountPending: 200 })),
    ).toBe('₹700');
  });

  it('renders 0 when both amounts are 0', () => {
    expect(formatRecordAmount(makeRecord())).toBe('₹0');
  });

  it('handles undefined amounts as 0', () => {
    // TS-typed as number, but the runtime can still receive undefined in
    // partial hydration — the ?? 0 fallback matters.
    expect(
      formatRecordAmount({
        ...makeRecord(),
        amountReceived: undefined as unknown as number,
        amountPending: undefined as unknown as number,
      }),
    ).toBe('₹0');
  });

  it('formats large numbers with thousands separators (locale-aware)', () => {
    const out = formatRecordAmount(
      makeRecord({ amountReceived: 1_500_000, amountPending: 500_000 }),
    );
    // 2_000_000 — separator varies by locale ('2,000,000' vs '2 000 000'
    // vs '20,00,000'). Assert the digit run rather than exact format.
    expect(out.replace(/[^\d]/g, '')).toBe('2000000');
  });

  it('caps to 2 decimals for fractional amounts', () => {
    const out = formatRecordAmount(
      makeRecord({ amountReceived: 100.126, amountPending: 0 }),
    );
    // 100.13 (rounded to 2 decimals). Digits: 10013.
    expect(out.replace(/[^\d]/g, '')).toBe('10013');
  });
});
