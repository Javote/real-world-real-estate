import type { StageDatum } from "@plataforma/shared";

export const ANCHOR_MODES = ["simulated", "real"] as const;
export type AnchorMode = (typeof ANCHOR_MODES)[number];

export type PortMode = AnchorMode | "disabled";

export const ANCHOR_NETWORKS = ["Mainnet", "Preprod", "Preview", "Custom", "Simulated"] as const;
export type AnchorNetwork = (typeof ANCHOR_NETWORKS)[number];

export type OutputRef = string;

export type AnchorStatus = "Pending" | "Confirmed";

export interface AnchorReceipt {
  txid: string;
  outputRef: OutputRef;
  status: AnchorStatus;
}

export interface AnchorProof {
  txid: string;
  outputRef: OutputRef;
  blockTimestamp: number | null;
  datum: StageDatum;
}

export interface OpenThreadInput {
  datum: StageDatum;
}

export interface AdvanceThreadInput {
  outputRef: OutputRef;
  previous: StageDatum;
  next: StageDatum;
}

export interface LiveThread {
  outputRef: OutputRef;
  datum: StageDatum;
}

export interface CommitmentAnchorInput {
  sha256: string;
  reference: string;
}

export interface MetadataAnchorReceipt {
  txid: string;
  status: AnchorStatus;
}

export const EVIDENCE_METADATA_LABEL = 1904;

export interface AnchorPort {
  readonly mode: PortMode;
  readonly network: AnchorNetwork | null;
  openThread(input: OpenThreadInput): Promise<AnchorReceipt>;
  advanceThread(input: AdvanceThreadInput): Promise<AnchorReceipt>;
  findLiveThread(stageRef: string): Promise<LiveThread | null>;
  anchorCommitment(input: CommitmentAnchorInput): Promise<MetadataAnchorReceipt>;
  verify(txid: string): Promise<AnchorProof | null>;
  awaitConfirmation(txid: string): Promise<AnchorProof>;
  confirmedAt(txid: string): Promise<number | null>;
}

export class AnchorRejectedError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "AnchorRejectedError";
  }
}
