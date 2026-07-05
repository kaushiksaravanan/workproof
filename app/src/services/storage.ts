import AsyncStorage from "@react-native-async-storage/async-storage";
import type { WorkRecord } from "../types";

const RECORD_PREFIX = "@workproof/records/";
const INDEX_KEY = "@workproof/index";

function recordKey(id: string): string {
  return `${RECORD_PREFIX}${id}`;
}

// ---------------------------------------------------------------------------
// Async mutex over index mutations. Without this, two parallel saveRecord
// calls both readIndex(['x']), each pushes its own id, and last-write-wins
// silently drops one record from the index (the file on disk survives but
// listRecords ignores it).
// ---------------------------------------------------------------------------

let indexLock: Promise<unknown> = Promise.resolve();

function withIndexLock<T>(work: () => Promise<T>): Promise<T> {
  const next = indexLock.then(work, work);
  // Don't poison the chain on rejection.
  indexLock = next.catch(() => undefined);
  return next;
}

async function readIndex(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    if (!raw) return await rebuildIndex();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === "string")) {
      return await rebuildIndex();
    }
    return parsed;
  } catch {
    return await rebuildIndex();
  }
}

async function writeIndex(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(ids));
}

/**
 * Recover the index by scanning every key in AsyncStorage that starts with
 * the record prefix. Used when the index is missing or corrupted.
 */
async function rebuildIndex(): Promise<string[]> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const ids: string[] = [];
    for (const k of allKeys) {
      if (k.startsWith(RECORD_PREFIX)) {
        ids.push(k.slice(RECORD_PREFIX.length));
      }
    }
    await writeIndex(ids);
    return ids;
  } catch {
    return [];
  }
}

export async function saveRecord(record: WorkRecord): Promise<void> {
  await AsyncStorage.setItem(recordKey(record.id), JSON.stringify(record));
  await withIndexLock(async () => {
    const ids = await readIndex();
    if (!ids.includes(record.id)) {
      ids.push(record.id);
      await writeIndex(ids);
    }
  });
}

export async function getRecord(id: string): Promise<WorkRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(recordKey(id));
    if (!raw) return null;
    return JSON.parse(raw) as WorkRecord;
  } catch {
    return null;
  }
}

export async function listRecords(): Promise<WorkRecord[]> {
  const ids = await readIndex();
  const keys = ids.map(recordKey);
  let pairs: readonly [string, string | null][] = [];
  try {
    pairs = await AsyncStorage.multiGet(keys);
  } catch {
    pairs = [];
    for (const k of keys) {
      try {
        const v = await AsyncStorage.getItem(k);
        pairs = [...pairs, [k, v] as const];
      } catch {
        // skip
      }
    }
  }

  const records: WorkRecord[] = [];
  for (const [, raw] of pairs) {
    if (!raw) continue;
    try {
      records.push(JSON.parse(raw) as WorkRecord);
    } catch {
      // skip corrupted entry
    }
  }

  records.sort((a, b) => {
    const ta = Date.parse(a.createdAt) || 0;
    const tb = Date.parse(b.createdAt) || 0;
    return tb - ta;
  });
  return records;
}

export async function updateRecord(
  id: string,
  patch: Partial<WorkRecord>
): Promise<WorkRecord | null> {
  const existing = await getRecord(id);
  if (!existing) return null;
  const merged: WorkRecord = { ...existing, ...patch, id: existing.id };
  await AsyncStorage.setItem(recordKey(id), JSON.stringify(merged));
  return merged;
}

export async function deleteRecord(id: string): Promise<void> {
  await AsyncStorage.removeItem(recordKey(id));
  await withIndexLock(async () => {
    const ids = await readIndex();
    const next = ids.filter((x) => x !== id);
    await writeIndex(next);
  });
}

export async function clearAll(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const toRemove = allKeys.filter(
      (k) => k.startsWith(RECORD_PREFIX) || k === INDEX_KEY
    );
    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove);
    }
  } catch {
    const ids = await readIndex();
    for (const id of ids) {
      try {
        await AsyncStorage.removeItem(recordKey(id));
      } catch {
        // ignore per-id failure; keep going so we maximize cleanup
      }
    }
    try {
      await AsyncStorage.removeItem(INDEX_KEY);
    } catch {
      // ignore — clearAll stays total even if the final removeItem fails
    }
  }
}
