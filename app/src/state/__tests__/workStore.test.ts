import type { WorkRecord } from '../../types';

/**
 * Mock the storage repo so tests don't touch AsyncStorage. Each test resets
 * the in-memory bank via beforeEach. This keeps the workStore behavior under
 * test (sort, dedupe, filter) instead of repo round-trips.
 */
jest.mock('../../services/storage', () => {
  const bank: Record<string, any> = {};
  return {
    listRecords: jest.fn(async () => Object.values(bank)),
    saveRecord: jest.fn(async (rec: any) => {
      bank[rec.id] = rec;
    }),
    updateRecord: jest.fn(async (id: string, patch: any) => {
      bank[id] = { ...bank[id], ...patch };
    }),
    deleteRecord: jest.fn(async (id: string) => {
      delete bank[id];
    }),
    __bank: bank,
    __reset: () => {
      for (const k of Object.keys(bank)) delete bank[k];
    },
  };
});

import { useWorkStore } from '../workStore';
import * as storage from '../../services/storage';

const baseRecord = (over: Partial<WorkRecord>): WorkRecord => ({
  id: 'r1',
  createdAt: '2026-01-01T00:00:00.000Z',
  workType: 'painting',
  amountReceived: 0,
  amountPending: 0,
  photoUri: 'file://photo.jpg',
  transcript: '',
  hash: 'h',
  ...over,
});

beforeEach(() => {
  // reset zustand state and repo bank between tests
  useWorkStore.setState({ records: [], loading: false, error: null, hasHydrated: false });
  // test-only helper attached in mock factory
  (storage as any).__reset();
  jest.clearAllMocks();
});

describe('workStore.refresh', () => {
  it('sorts records newest first by createdAt', async () => {
    const older = baseRecord({ id: 'a', createdAt: '2026-01-01T00:00:00.000Z' });
    const newest = baseRecord({ id: 'b', createdAt: '2026-03-01T00:00:00.000Z' });
    const middle = baseRecord({ id: 'c', createdAt: '2026-02-01T00:00:00.000Z' });
    // seed bank in non-sorted insertion order
    await (storage.saveRecord as jest.Mock)(older);
    await (storage.saveRecord as jest.Mock)(middle);
    await (storage.saveRecord as jest.Mock)(newest);

    await useWorkStore.getState().refresh();

    const ids = useWorkStore.getState().records.map((r) => r.id);
    expect(ids).toEqual(['b', 'c', 'a']);
    expect(useWorkStore.getState().hasHydrated).toBe(true);
    expect(useWorkStore.getState().loading).toBe(false);
  });

  it('treats unparseable createdAt as 0 without throwing', async () => {
    const bad = baseRecord({ id: 'bad', createdAt: 'not-a-date' });
    const good = baseRecord({ id: 'good', createdAt: '2026-05-01T00:00:00.000Z' });
    await (storage.saveRecord as jest.Mock)(bad);
    await (storage.saveRecord as jest.Mock)(good);

    await useWorkStore.getState().refresh();

    const ids = useWorkStore.getState().records.map((r) => r.id);
    // good has parseable date; bad falls back to 0 and sorts last
    expect(ids).toEqual(['good', 'bad']);
  });

  it('sets hasHydrated even on repo failure', async () => {
    (storage.listRecords as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    await useWorkStore.getState().refresh();
    expect(useWorkStore.getState().hasHydrated).toBe(true);
    expect(useWorkStore.getState().error).toBe('boom');
    expect(useWorkStore.getState().loading).toBe(false);
  });
});

describe('workStore.upsert', () => {
  it('dedupes by id when upserting an existing record (no duplicates)', async () => {
    const original = baseRecord({ id: 'r1', createdAt: '2026-01-01T00:00:00.000Z', notes: 'v1' });
    useWorkStore.setState({ records: [original] });

    const updated = baseRecord({ id: 'r1', createdAt: '2026-01-01T00:00:00.000Z', notes: 'v2' });
    await useWorkStore.getState().upsert(updated);

    const recs = useWorkStore.getState().records;
    expect(recs).toHaveLength(1);
    expect(recs[0].notes).toBe('v2');
    expect(storage.updateRecord).toHaveBeenCalledWith('r1', updated);
    expect(storage.saveRecord).not.toHaveBeenCalled();
  });

  it('inserts a new record via saveRecord when id not present', async () => {
    useWorkStore.setState({ records: [baseRecord({ id: 'a', createdAt: '2026-01-01T00:00:00.000Z' })] });
    const fresh = baseRecord({ id: 'b', createdAt: '2026-06-01T00:00:00.000Z' });
    await useWorkStore.getState().upsert(fresh);

    const ids = useWorkStore.getState().records.map((r) => r.id);
    // newest first: b > a
    expect(ids).toEqual(['b', 'a']);
    expect(storage.saveRecord).toHaveBeenCalledWith(fresh);
    expect(storage.updateRecord).not.toHaveBeenCalled();
  });
});

describe('workStore.remove', () => {
  it('filters out the matching id and leaves siblings untouched', async () => {
    const a = baseRecord({ id: 'a', createdAt: '2026-01-01T00:00:00.000Z' });
    const b = baseRecord({ id: 'b', createdAt: '2026-02-01T00:00:00.000Z' });
    const c = baseRecord({ id: 'c', createdAt: '2026-03-01T00:00:00.000Z' });
    useWorkStore.setState({ records: [c, b, a] });

    await useWorkStore.getState().remove('b');

    const ids = useWorkStore.getState().records.map((r) => r.id);
    expect(ids).toEqual(['c', 'a']);
    expect(storage.deleteRecord).toHaveBeenCalledWith('b');
  });

  it('is a no-op against state when id is not present (and surfaces no error)', async () => {
    const a = baseRecord({ id: 'a', createdAt: '2026-01-01T00:00:00.000Z' });
    useWorkStore.setState({ records: [a] });

    await useWorkStore.getState().remove('does-not-exist');
    expect(useWorkStore.getState().records).toEqual([a]);
    expect(useWorkStore.getState().error).toBeNull();
  });
});

describe('workStore.setAnchored', () => {
  it('persists txHash + chainId via repo.updateRecord and updates in-memory record', async () => {
    const r = baseRecord({ id: 'r1', createdAt: '2026-01-01T00:00:00.000Z' });
    // seed both repo bank and store so updateRecord has a target to merge into
    await (storage.saveRecord as jest.Mock)(r);
    useWorkStore.setState({ records: [r] });

    await useWorkStore.getState().setAnchored('r1', '0xdead', 11155111);

    expect(storage.updateRecord).toHaveBeenCalledWith('r1', {
      anchorTxHash: '0xdead',
      anchorChainId: 11155111,
    });
    const updated = useWorkStore.getState().records.find((x) => x.id === 'r1');
    expect(updated?.anchorTxHash).toBe('0xdead');
    expect(updated?.anchorChainId).toBe(11155111);
    expect(useWorkStore.getState().error).toBeNull();
  });

  it('throws and sets error when repo.updateRecord rejects, leaving record unchanged', async () => {
    const r = baseRecord({ id: 'r1', createdAt: '2026-01-01T00:00:00.000Z' });
    useWorkStore.setState({ records: [r] });
    (storage.updateRecord as jest.Mock).mockRejectedValueOnce(new Error('write failed'));

    await expect(
      useWorkStore.getState().setAnchored('r1', '0xfeed', 1)
    ).rejects.toThrow('write failed');

    expect(useWorkStore.getState().error).toBe('write failed');
    const same = useWorkStore.getState().records.find((x) => x.id === 'r1');
    // failure path must not optimistically mutate state
    expect(same?.anchorTxHash).toBeUndefined();
    expect(same?.anchorChainId).toBeUndefined();
  });
});

describe('workStore.clearError', () => {
  it('resets error back to null after a failed refresh', async () => {
    (storage.listRecords as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    await useWorkStore.getState().refresh();
    expect(useWorkStore.getState().error).toBe('disk full');
    expect(useWorkStore.getState().hasHydrated).toBe(true);

    useWorkStore.getState().clearError();
    expect(useWorkStore.getState().error).toBeNull();
    // clearError must NOT undo hydration — screens still need to know first load completed
    expect(useWorkStore.getState().hasHydrated).toBe(true);
  });
});
