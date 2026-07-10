export interface WorkRecord {
  id: string;
  createdAt: string;
  workerName?: string;
  /**
   * Ethereum address of the per-install wallet that will sign this
   * record's anchor tx (see services/identity.ts). Included in the
   * canonical hash so the verifier can match the on-chain
   * `Anchored(hash, worker, timestamp)` event's `worker` field to the
   * PDF and confirm the same wallet signed both. Optional only for
   * back-compat with records saved before the per-install-key change;
   * new records always populate it.
   */
  workerAddress?: string;
  workType: string;
  clientName?: string;
  location?: string;
  amountReceived: number;
  amountPending: number;
  notes?: string;
  photoUri: string;
  audioUri?: string;
  transcript: string;
  hash: string;
  anchorTxHash?: string;
  anchorChainId?: number;
}

export type ExtractedFields = Required<
  Pick<
    WorkRecord,
    "workType" | "clientName" | "location" | "amountReceived" | "amountPending" | "notes"
  >
>;

export interface ProofDocument {
  record: WorkRecord;
  pdfUri: string;
  generatedAt: string;
}

export interface AnchorResult {
  txHash: string;
  chainId: number;
  explorerUrl: string;
}

export type AnchorStatus = "pending" | "confirmed" | "failed" | "queued";
