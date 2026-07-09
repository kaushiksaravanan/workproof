/**
 * Pure-function unit tests for Home.tsx's exported helpers. These skip the
 * heavy screen mocks in Home.test.tsx — dayjs is real, records are hand-
 * crafted fixtures.
 */

import dayjs from 'dayjs';
import { countThisWeek, countAnchored } from '../Home';
import type { WorkRecord } from '../../types';

function rec(over: Partial<WorkRecord> = {}): WorkRecord {
  return {
    id: 'r',
    createdAt: dayjs().toISOString(),
    workType: 'painting',
    amountReceived: 0,
    amountPending: 0,
    photoUri: '',
    transcript: '',
    hash: '0xdead',
    ...over,
  };
}

describe('countAnchored', () => {
  it('returns 0 for empty list', () => {
    expect(countAnchored([])).toBe(0);
  });

  it('returns 0 when nothing is anchored', () => {
    expect(
      countAnchored([rec({ id: 'a' }), rec({ id: 'b' })]),
    ).toBe(0);
  });

  it('counts records with real txHash + chainId', () => {
    expect(
      countAnchored([
        rec({ id: 'a', anchorTxHash: '0xanchor', anchorChainId: 137 }),
        rec({ id: 'b' }),
        rec({ id: 'c', anchorTxHash: '0xanchor2', anchorChainId: 137 }),
      ]),
    ).toBe(2);
  });

  it('does NOT count queued: prefix (still pending)', () => {
    expect(
      countAnchored([
        rec({ id: 'a', anchorTxHash: 'queued:0xhash', anchorChainId: 137 }),
        rec({ id: 'b', anchorTxHash: '0xreal', anchorChainId: 137 }),
      ]),
    ).toBe(1);
  });

  it('requires both txHash AND chainId', () => {
    expect(
      countAnchored([
        rec({ id: 'a', anchorTxHash: '0xreal' }), // no chainId
        rec({ id: 'b', anchorChainId: 137 }), // no txHash
      ]),
    ).toBe(0);
  });
});

describe('countThisWeek', () => {
  it('returns 0 for empty list', () => {
    expect(countThisWeek([])).toBe(0);
  });

  it('counts records created after start-of-week', () => {
    const startOfWeek = dayjs().startOf('week');
    const midWeek = startOfWeek.add(3, 'day');
    expect(
      countThisWeek([
        rec({ id: 'a', createdAt: midWeek.toISOString() }),
        rec({ id: 'b', createdAt: dayjs().toISOString() }),
      ]),
    ).toBe(2);
  });

  it('excludes records older than start-of-week', () => {
    const startOfWeek = dayjs().startOf('week');
    const lastWeek = startOfWeek.subtract(2, 'day');
    expect(
      countThisWeek([
        rec({ id: 'a', createdAt: lastWeek.toISOString() }),
        rec({ id: 'b', createdAt: startOfWeek.subtract(1, 'month').toISOString() }),
      ]),
    ).toBe(0);
  });

  it('includes records at exactly start-of-week (isSame boundary)', () => {
    const startOfWeek = dayjs().startOf('week');
    expect(
      countThisWeek([rec({ id: 'a', createdAt: startOfWeek.toISOString() })]),
    ).toBe(1);
  });

  it('ignores records with unparseable createdAt (isValid gate)', () => {
    expect(
      countThisWeek([
        rec({ id: 'a', createdAt: 'not-a-date' }),
        rec({ id: 'b', createdAt: '' }),
        rec({ id: 'c', createdAt: 'garbage-\u{1F4A9}' }),
      ]),
    ).toBe(0);
  });

  it('mixes valid + invalid + old + this-week correctly', () => {
    const startOfWeek = dayjs().startOf('week');
    expect(
      countThisWeek([
        rec({ id: 'a', createdAt: dayjs().toISOString() }),                        // this week
        rec({ id: 'b', createdAt: startOfWeek.subtract(1, 'day').toISOString() }), // last week
        rec({ id: 'c', createdAt: 'not-a-date' }),                                 // invalid
        rec({ id: 'd', createdAt: startOfWeek.add(2, 'hour').toISOString() }),     // this week
      ]),
    ).toBe(2);
  });
});
