import { HashChip } from './HashChip'

// **M2-D4 Pattern 5 · Merkle root — la prueba de integridad del bundle.**
//
// Se ancla **solo la raíz**, no cada archivo: anclar archivo por archivo es
// derrochar cadena y además conceptualmente equivocado, porque lo que importa
// es el bundle entero.
//
// **Por qué se muestran la raíz Y los hashes de archivo:** la raíz sola prueba
// la integridad del conjunto pero no dice cuál archivo es cuál. Los hashes por
// archivo le dan al revisor los valores que necesita para verificar uno
// específico caminando el árbol. Los dos son públicos y los dos van en la
// superficie — pero a profundidades distintas: raíz + TXID juntos acá, hashes
// por archivo un nivel más adentro (el modal de stage).

interface ArchivoDelBundle {
  id: string
  nombre: string
  sha256: string
}

interface MerkleRootProofProps {
  merkleRoot: string
  /** TXID del anclaje del bundle. `null` mientras no confirmó. */
  txid: string | null
  /** Un nivel más adentro: solo cuando la superficie es el modal de stage. */
  archivos?: ArchivoDelBundle[]
  onOpenTxid?: () => void
  labels: {
    rootLabel: string
    txidLabel: string
    filesLabel: string
    pending: string
    copy: string
    copied: string
  }
}

export function MerkleRootProof({
  merkleRoot,
  txid,
  archivos,
  onOpenTxid,
  labels
}: MerkleRootProofProps) {
  return (
    <section className="flex flex-col gap-s3">
      <div className="flex flex-col gap-s1">
        <span className="text-label font-bold uppercase text-text-muted">{labels.rootLabel}</span>
        <HashChip hash={merkleRoot} copyLabel={labels.copy} copiedLabel={labels.copied} />
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
          // Sin TXID no se muestra chip: un HashChip vacío insinuaría una
          // prueba que no existe (regla 17).
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
