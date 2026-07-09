/**
 * Unit tests for reconcileAnchoredHashes — the pure helper factored out of
 * App.tsx's drainQueueAndReconcile closure. Verifies the record-matching
 * rules and per-record error tolerance without needing to mount App or
 * touch the Zustand store.
 */

import { reconcileAnchoredHashes } from '../reconcile';
import type { WorkRecord, AnchorResult } from '../../types';

const rec = (over: Partial<WorkRecord>): WorkRecord => ({
  id: 'r',
  createdAt: '2026-01-01T00:00:00.000Z',
  workType: 'painting',
  amountReceived: 0,
  amountPending: 0,
  photoUri: '',
  transcript: '',
  hash: '',
  ...over,
});

const ok = (txHash: string): AnchorResult => ({
  txHash,
  chainId: 80002,
  explorerUrl: `https://amoy.polygonscan.com/tx/${txHash}`,
});

describe('reconcileAnchoredHashes', () => {
  it('marks a single matching record as anchored', async () => {
    const setAnchored = jest.fn(async () => undefined);
    const records = [
      rec({ id: 'r1', hash: 'aaaa', anchorTxHash: 'queued:aaaa' }),
    ];
    await reconcileAnchoredHashes(
      [{ hashHex: 'aaaa', result: ok('0xtx1') }],
      records,
      setAnchored,
    );
    expect(setAnchored).toHaveBeenCalledTimes(1);
    expect(setAnchored).toHaveBeenCalledWith('r1', '0xtx1', 80002);
  });

  it('ignores records whose hash matches but were never queued', async () => {
    const setAnchored = jest.fn(async () => undefined);
    const records = [
      rec({ id: 'r1', hash: 'aaaa', anchorTxHash: undefined }),
      rec({ id: 'r2', hash: 'aaaa', anchorTxHash: '0xrealtx' }),
    ];
    await reconcileAnchoredHashes(
      [{ hashHex: 'aaaa', result: ok('0xtx1') }],
      records,
      setAnchored,
    );
    expect(setAnchored).not.toHaveBeenCalled();
  });

  it('ignores records queued for a DIFFERENT hash', async () => {
    const setAnchored = jest.fn(async () => undefined);
    const records = [
      rec({ id: 'r1', hash: 'aaaa', anchorTxHash: 'queued:bbbb' }),
    ];
    await reconcileAnchoredHashes(
      [{ hashHex: 'aaaa', result: ok('0xtx1') }],
      records,
      setAnchored,
    );
    expect(setAnchored).not.toHaveBeenCalled();
  });

  it('fans out setAnchored across all records queued under the same hash', async () => {
    const setAnchored = jest.fn(async () => undefined);
    const records = [
      rec({ id: 'r1', hash: 'aaaa', anchorTxHash: 'queued:aaaa' }),
      rec({ id: 'r2', hash: 'aaaa', anchorTxHash: 'queued:aaaa' }),
      rec({ id: 'r3', hash: 'bbbb', anchorTxHash: 'queued:bbbb' }),
    ];
    await reconcileAnchoredHashes(
      [
        { hashHex: 'aaaa', result: ok('0xtxA') },
        { hashHex: 'bbbb', result: ok('0xtxB') },
      ],
      records,
      setAnchored,
    );
    expect(setAnchored).toHaveBeenCalledTimes(3);
    expect(setAnchored).toHaveBeenCalledWith('r1', '0xtxA', 80002);
    expect(setAnchored).toHaveBeenCalledWith('r2', '0xtxA', 80002);
    expect(setAnchored).toHaveBeenCalledWith('r3', '0xtxB', 80002);
  });

  it('swallows a per-record setAnchored failure and continues with the next', async () => {
    const setAnchored = jest
      .fn(async () => undefined)
      .mockImplementationOnce(async () => {
        throw new Error('write failed');
      });
    const records = [
      rec({ id: 'bad', hash: 'aaaa', anchorTxHash: 'queued:aaaa' }),
      rec({ id: 'good', hash: 'aaaa', anchorTxHash: 'queued:aaaa' }),
    ];
    await reconcileAnchoredHashes(
      [{ hashHex: 'aaaa', result: ok('0xtx') }],
      records,
      setAnchored,
    );
    // The failure MUST NOT abort the loop.
    expect(setAnchored).toHaveBeenCalledTimes(2);
  });

  it('is a no-op when results is empty', async () => {
    const setAnchored = jest.fn(async () => undefined);
    await reconcileAnchoredHashes([], [rec({ hash: 'x' })], setAnchored);
    expect(setAnchored).not.toHaveBeenCalled();
  });

  it('is a no-op when records is empty', async () => {
    const setAnchored = jest.fn(async () => undefined);
    await reconcileAnchoredHashes(
      [{ hashHex: 'aaaa', result: ok('0xtx') }],
      [],
      setAnchored,
    );
    expect(setAnchored).not.toHaveBeenCalled();
  });

  it('passes the chainId from the result unchanged', async () => {
    const setAnchored = jest.fn(async () => undefined);
    const records = [
      rec({ id: 'r1', hash: 'aa', anchorTxHash: 'queued:aa' }),
    ];
    const alt: AnchorResult = {
      txHash: '0xany',
      chainId: 1,
      explorerUrl: 'https://etherscan.io/tx/0xany',
    };
    await reconcileAnchoredHashes(
      [{ hashHex: 'aa', result: alt }],
      records,
      setAnchored,
    );
    expect(setAnchored).toHaveBeenCalledWith('r1', '0xany', 1);
  });
});
