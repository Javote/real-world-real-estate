import {
  type AdvanceThreadInput,
  type AnchorPort,
  type AnchorProof,
  type AnchorReceipt,
  AnchorRejectedError,
  type CommitmentAnchorInput,
  type LiveThread,
  type MetadataAnchorReceipt,
  type OpenThreadInput
} from "./port";

export const ANCHOR_DISABLED = "ANCHOR_DISABLED";

export class DisabledAnchorAdapter implements AnchorPort {
  readonly mode = "disabled" as const;
  readonly network = null;

  constructor(readonly reason: string) {}

  private rechazar(): never {
    throw new AnchorRejectedError(`El anclaje está inhabilitado: ${this.reason}`, ANCHOR_DISABLED);
  }

  async openThread(_input: OpenThreadInput): Promise<AnchorReceipt> {
    this.rechazar();
  }

  async advanceThread(_input: AdvanceThreadInput): Promise<AnchorReceipt> {
    this.rechazar();
  }

  async anchorCommitment(_input: CommitmentAnchorInput): Promise<MetadataAnchorReceipt> {
    this.rechazar();
  }

  async findLiveThread(_stageRef: string): Promise<LiveThread | null> {
    this.rechazar();
  }

  async verify(_txid: string): Promise<AnchorProof | null> {
    this.rechazar();
  }

  async awaitConfirmation(_txid: string): Promise<AnchorProof> {
    this.rechazar();
  }

  // Rechaza en vez de devolver `null`: `null` afirmaría que consultó y no confirmó.
  async confirmedAt(_txid: string): Promise<number | null> {
    this.rechazar();
  }
}
