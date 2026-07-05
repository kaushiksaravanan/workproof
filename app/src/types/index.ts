export interface WorkRecord {
  id: string;
  createdAt: string;
  workerName?: string;
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
