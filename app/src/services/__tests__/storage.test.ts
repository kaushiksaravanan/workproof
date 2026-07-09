/**
 * Unit tests for services/storage.ts — AsyncStorage-backed record repo.
 *
 * The jest.setup.js file mocks @react-native-async-storage/async-storage
 * with an in-memory implementation, so these tests exercise real code paths
 * without touching disk.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WorkRecord } from '../../types';
import {
  saveRecord,
  getRecord,
  listRecords,
  updateRecord,
  deleteRecord,
  clearAll,
} from '../storage';

const RECORD_PREFIX = '@workproof/records/';
const INDEX_KEY = '@workproof/index';

function rec(over: Partial<WorkRecord> = {}): WorkRecord {
  return {
    id: 'r1',
    createdAt: '2026-01-01T00:00:00.000Z',
    workType: 'painting',
    amountReceived: 0,
    amountPending: 0,
    photoUri: '',
    transcript: '',
    hash: '0xdead',
    ...over,
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('saveRecord + getRecord + listRecords roundtrip', () => {
  it('saves a single record and reads it back', async () => {
    const r = rec({ id: 'a', workType: 'plumbing' });
    await saveRecord(r);
    const got = await getRecord('a');
    expect(got).toEqual(r);
  });

  it('returns null for a missing record', async () => {
    expect(await getRecord('nope')).toBeNull();
  });

  it('lists all saved records sorted newest-first', async () => {
    await saveRecord(rec({ id: 'a', createdAt: '2026-01-01T00:00:00.000Z' }));
    await saveRecord(rec({ id: 'b', createdAt: '2026-03-01T00:00:00.000Z' }));
    await saveRecord(rec({ id: 'c', createdAt: '2026-02-01T00:00:00.000Z' }));

    const all = await listRecords();
    expect(all.map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('lists records with unparseable createdAt at the end (Date.parse → 0)', async () => {
    await saveRecord(rec({ id: 'good', createdAt: '2026-05-01T00:00:00.000Z' }));
    await saveRecord(rec({ id: 'bad', createdAt: 'not-a-date' }));

    const all = await listRecords();
    expect(all.map((r) => r.id)).toEqual(['good', 'bad']);
  });

  it('saveRecord dedupes: pushing same id twice does not add duplicate index entries', async () => {
    const r = rec({ id: 'dupe' });
    await saveRecord(r);
    await saveRecord(r);

    const raw = await AsyncStorage.getItem(INDEX_KEY);
    const ids = JSON.parse(raw!) as string[];
    expect(ids.filter((x) => x === 'dupe')).toHaveLength(1);
  });
});

describe('updateRecord', () => {
  it('merges patch onto existing record and preserves id', async () => {
    await saveRecord(rec({ id: 'r1', notes: 'v1' }));
    const merged = await updateRecord('r1', { notes: 'v2', workerName: 'Alice' });
    expect(merged?.id).toBe('r1');
    expect(merged?.notes).toBe('v2');
    expect(merged?.workerName).toBe('Alice');

    const roundtrip = await getRecord('r1');
    expect(roundtrip?.notes).toBe('v2');
    expect(roundtrip?.workerName).toBe('Alice');
  });

  it('returns null when the target record does not exist', async () => {
    const merged = await updateRecord('ghost', { notes: 'nope' });
    expect(merged).toBeNull();
  });

  it('cannot overwrite the id (id field in patch is ignored)', async () => {
    await saveRecord(rec({ id: 'a' }));
    const merged = await updateRecord('a', { id: 'malicious' } as Partial<WorkRecord>);
    expect(merged?.id).toBe('a');
  });
});

describe('deleteRecord', () => {
  it('removes the record from storage and drops it from the index', async () => {
    await saveRecord(rec({ id: 'a' }));
    await saveRecord(rec({ id: 'b' }));
    await deleteRecord('a');

    expect(await getRecord('a')).toBeNull();
    expect(await getRecord('b')).not.toBeNull();

    const raw = await AsyncStorage.getItem(INDEX_KEY);
    const ids = JSON.parse(raw!) as string[];
    expect(ids).toEqual(['b']);
  });

  it('is a no-op on a missing id (index filter leaves siblings alone)', async () => {
    await saveRecord(rec({ id: 'a' }));
    await deleteRecord('does-not-exist');

    expect(await getRecord('a')).not.toBeNull();
  });
});

describe('clearAll', () => {
  it('removes every record + the index key', async () => {
    await saveRecord(rec({ id: 'a' }));
    await saveRecord(rec({ id: 'b' }));
    await saveRecord(rec({ id: 'c' }));

    await clearAll();

    // Assert the raw storage state BEFORE calling listRecords, because
    // listRecords transparently rebuilds an empty index if none exists.
    expect(await AsyncStorage.getItem(INDEX_KEY)).toBeNull();
    expect(await AsyncStorage.getItem(`${RECORD_PREFIX}a`)).toBeNull();
    expect(await AsyncStorage.getItem(`${RECORD_PREFIX}b`)).toBeNull();
    expect(await AsyncStorage.getItem(`${RECORD_PREFIX}c`)).toBeNull();
    expect(await listRecords()).toEqual([]);
  });

  it('is a no-op when storage is already empty', async () => {
    await expect(clearAll()).resolves.toBeUndefined();
  });

  it('preserves unrelated (non-workproof) AsyncStorage keys', async () => {
    await AsyncStorage.setItem('@other-app/config', '{}');
    await saveRecord(rec({ id: 'a' }));
    await clearAll();

    expect(await AsyncStorage.getItem('@other-app/config')).toBe('{}');
    expect(await getRecord('a')).toBeNull();
  });
});

describe('readIndex fallback / rebuild', () => {
  it('rebuilds the index from record keys when the index key is missing', async () => {
    await AsyncStorage.setItem(
      `${RECORD_PREFIX}orphan1`,
      JSON.stringify(rec({ id: 'orphan1' })),
    );
    await AsyncStorage.setItem(
      `${RECORD_PREFIX}orphan2`,
      JSON.stringify(rec({ id: 'orphan2', createdAt: '2026-04-01T00:00:00.000Z' })),
    );

    const list = await listRecords();
    expect(list.map((r) => r.id).sort()).toEqual(['orphan1', 'orphan2']);
  });

  it('rebuilds when the index is corrupted (non-array JSON)', async () => {
    await AsyncStorage.setItem(
      `${RECORD_PREFIX}a`,
      JSON.stringify(rec({ id: 'a' })),
    );
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify({ garbage: true }));

    const list = await listRecords();
    expect(list.map((r) => r.id)).toEqual(['a']);
  });

  it('rebuilds when index array contains non-string entries', async () => {
    await AsyncStorage.setItem(
      `${RECORD_PREFIX}a`,
      JSON.stringify(rec({ id: 'a' })),
    );
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(['a', 42, null]));

    const list = await listRecords();
    expect(list.map((r) => r.id)).toEqual(['a']);
  });

  it('rebuilds when the index JSON is malformed', async () => {
    await AsyncStorage.setItem(
      `${RECORD_PREFIX}a`,
      JSON.stringify(rec({ id: 'a' })),
    );
    await AsyncStorage.setItem(INDEX_KEY, 'not-valid-json{{{');

    const list = await listRecords();
    expect(list.map((r) => r.id)).toEqual(['a']);
  });
});

describe('listRecords corruption resilience', () => {
  it('skips corrupted record entries and returns the valid ones', async () => {
    await saveRecord(rec({ id: 'good' }));
    await AsyncStorage.setItem(`${RECORD_PREFIX}bad`, '{{{corrupt');
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(['good', 'bad']));

    const list = await listRecords();
    expect(list.map((r) => r.id)).toEqual(['good']);
  });
});

describe('AsyncStorage failure branches (defensive)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('readIndex → getAllKeys throwing returns []', async () => {
    // First readIndex tries getItem(INDEX_KEY) — mock that to return null so
    // it falls through to the getAllKeys rebuild branch, then make getAllKeys
    // throw. listRecords should degrade to an empty list, not crash.
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValueOnce(null);
    jest
      .spyOn(AsyncStorage, 'getAllKeys')
      .mockRejectedValueOnce(new Error('backend gone'));
    const list = await listRecords();
    expect(list).toEqual([]);
  });

  it('getRecord returns null when the stored JSON is corrupt', async () => {
    await AsyncStorage.setItem(`${RECORD_PREFIX}broken`, 'not-json-at-all');
    // getRecord catches JSON.parse and returns null (line 82).
    expect(await getRecord('broken')).toBeNull();
  });

  it('listRecords falls back to per-key getItem when multiGet throws', async () => {
    await saveRecord(rec({ id: 'a', workType: 'roofing' }));
    await saveRecord(rec({ id: 'b', workType: 'wiring' }));

    // multiGet fails once — the per-key fallback loop should still surface
    // both records.
    jest
      .spyOn(AsyncStorage, 'multiGet')
      .mockRejectedValueOnce(new Error('multiGet unavailable'));

    const list = await listRecords();
    const types = list.map((r) => r.workType).sort();
    expect(types).toEqual(['roofing', 'wiring']);
  });

  it('clearAll falls back to per-id removeItem when multiRemove throws', async () => {
    await saveRecord(rec({ id: 'a' }));
    await saveRecord(rec({ id: 'b' }));

    // The initial getAllKeys succeeds, but multiRemove blows up — clearAll
    // must fall back to iterating the index and calling removeItem per id.
    jest
      .spyOn(AsyncStorage, 'multiRemove')
      .mockRejectedValueOnce(new Error('multiRemove not supported'));

    await clearAll();

    expect(await getRecord('a')).toBeNull();
    expect(await getRecord('b')).toBeNull();
    expect(await AsyncStorage.getItem(INDEX_KEY)).toBeNull();
  });

  it("clearAll's fallback tolerates per-id removeItem failures (partial cleanup still succeeds)", async () => {
    await saveRecord(rec({ id: 'a' }));
    await saveRecord(rec({ id: 'b' }));
    await saveRecord(rec({ id: 'c' }));

    jest
      .spyOn(AsyncStorage, 'multiRemove')
      .mockRejectedValueOnce(new Error('boom'));
    // One removeItem call throws — the loop swallows the error and keeps going.
    const removeSpy = jest.spyOn(AsyncStorage, 'removeItem');
    // First removeItem call (for record 'a') fails, remaining calls succeed.
    removeSpy.mockRejectedValueOnce(new Error('transient'));

    await expect(clearAll()).resolves.toBeUndefined();
    // Records 'b' and 'c' should still be gone.
    expect(await getRecord('b')).toBeNull();
    expect(await getRecord('c')).toBeNull();
  });
});
