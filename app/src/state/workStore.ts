import { create } from "zustand";
import * as repo from "../services/storage";
import type { WorkRecord } from "../types";

interface WorkStoreState {
  records: WorkRecord[];
  loading: boolean;
  error: string | null;
  /**
   * Flips true after the first refresh() completes (success OR failure), so
   * screens can distinguish "no records yet" from "records still loading from
   * disk". Without this flag History flashes its empty state on every cold
   * launch before AsyncStorage hydrates.
   */
  hasHydrated: boolean;
  refresh: () => Promise<void>;
  upsert: (rec: WorkRecord) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setAnchored: (id: string, txHash: string, chainId: number) => Promise<void>;
  clearError: () => void;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

function sortNewestFirst(records: WorkRecord[]): WorkRecord[] {
  return [...records].sort((a, b) => {
    const ta = Date.parse(a.createdAt) || 0;
    const tb = Date.parse(b.createdAt) || 0;
    return tb - ta;
  });
}

export const useWorkStore = create<WorkStoreState>((set, get) => ({
  records: [],
  loading: false,
  error: null,
  hasHydrated: false,

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const records = await repo.listRecords();
      set({ records: sortNewestFirst(records), loading: false, hasHydrated: true });
    } catch (err) {
      set({ loading: false, error: errorMessage(err), hasHydrated: true });
    }
  },

  upsert: async (rec: WorkRecord) => {
    set({ error: null });
    try {
      const existing = get().records.find((r) => r.id === rec.id);
      if (existing) {
        await repo.updateRecord(rec.id, rec);
      } else {
        await repo.saveRecord(rec);
      }
      const others = get().records.filter((r) => r.id !== rec.id);
      set({ records: sortNewestFirst([rec, ...others]) });
    } catch (err) {
      set({ error: errorMessage(err) });
      throw err;
    }
  },

  remove: async (id: string) => {
    set({ error: null });
    try {
      await repo.deleteRecord(id);
      set({ records: get().records.filter((r) => r.id !== id) });
    } catch (err) {
      set({ error: errorMessage(err) });
      throw err;
    }
  },

  setAnchored: async (id: string, txHash: string, chainId: number) => {
    set({ error: null });
    try {
      await repo.updateRecord(id, {
        anchorTxHash: txHash,
        anchorChainId: chainId,
      });
      set({
        records: get().records.map((r) =>
          r.id === id
            ? { ...r, anchorTxHash: txHash, anchorChainId: chainId }
            : r
        ),
      });
    } catch (err) {
      set({ error: errorMessage(err) });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
