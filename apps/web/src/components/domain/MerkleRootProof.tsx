import { HashChip } from './HashChip'

interface ArchivoDelBundle {
  id: string
  nombre: string
  sha256: string
}

interface MerkleRootProofProps {
  merkleRoot: string
  txid: string | null
  archivos?: ArchivoDelBundle[]
  onOpenTxid?: () => void
  onOpenArchivo?: (archivo: ArchivoDelBundle) => void
  testId?: string
  labels: {
    rootLabel: string
    txidLabel: string
    filesLabel: string
    pending: string
    pendingRoot?: string
    copy: string
    copied: string
  }
}

export function MerkleRootProof({
  merkleRoot,
  txid,
  archivos,
  onOpenTxid,
  onOpenArchivo,
  testId,
  labels
}: MerkleRootProofProps) {
  return (
    <section className="flex flex-col gap-s3" data-testid={testId}>
      <div className="flex flex-col gap-s1">
        <span className="text-label font-bold uppercase text-text-muted">{labels.rootLabel}</span>
        {merkleRoot ? (
          <HashChip hash={merkleRoot} copyLabel={labels.copy} copiedLabel={labels.copied} />
        ) : (
          <span className="text-body-sm text-pending">{labels.pendingRoot ?? labels.pending}</span>
        )}
      </div>

      <div className="flex flex-col gap-s1">
        <span className="text-label font-bold uppercase text-text-muted">{labels.txidLabel}</span>
        {txid ? (
          <HashChip
            hash={txid}
            {...(onOpenTxid ? { onOpenDetail: onOpenTxid } : {})}
            copyLabel={labels.copy}
            copiedLabel={labels.copied}
          />
        ) : (
          <span className="text-body-sm text-pending">{labels.pending}</span>
        )}
      </div>

      {archivos?.length ? (
        <div className="flex flex-col gap-s2">
          <span className="text-label font-bold uppercase text-text-muted">
            {labels.filesLabel}
          </span>
          <ul className="flex flex-col gap-s2">
            {archivos.map((archivo) => (
              <li key={archivo.id} className="flex items-center justify-between gap-s2">
                <span className="truncate text-body-sm text-text-secondary">{archivo.nombre}</span>
                <HashChip
                  hash={archivo.sha256}
                  {...(onOpenArchivo ? { onOpenDetail: () => onOpenArchivo(archivo) } : {})}
                  copyLabel={labels.copy}
                  copiedLabel={labels.copied}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
