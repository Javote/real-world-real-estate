import { HashChip } from './HashChip'

// **M2-D4 Pattern 10 · prueba financiera por liberación.**
//
// **Por qué por release y no por contrato**, textual: el contrato es una entidad
// lógica pero **no es el artefacto on-chain** en este modelo — cada liberación
// sí lo es. Mostrar el TXID a nivel release refleja la cardinalidad real de los
// eventos en la cadena.
//
// Y recordar D-021: "release" significa **anclar el evento de liberación**, no
// ejecutar el pago. El monto es cronograma registrado, no plata que se mueva.

export interface ReleaseRecord {
  stageNumber: number
  /** En unidades mínimas enteras (regla 1). Lo formatea quien lo monta. */
  amountMinorUnits: number
  currency: string
  /** ISO. */
  releasedAt: string
  /** TXID del anclaje de la liberación. `null` si todavía no confirmó. */
  txid: string | null
}

interface ReleaseProofListProps {
  releases: readonly ReleaseRecord[]
  onOpenTxid?: (release: ReleaseRecord) => void
  formatCurrency: (minorUnits: number, currency: string) => string
  formatDate: (iso: string) => string
  labels: { stage: string; pending: string; copy: string; copied: string }
}

export function ReleaseProofList({
  releases,
  onOpenTxid,
  formatCurrency,
  formatDate,
  labels
}: ReleaseProofListProps) {
  return (
    <ul className="flex flex-col gap-s3">
      {releases.map((release) => (
        <li
          key={release.stageNumber}
          className="flex items-center justify-between gap-s3 rounded-lg bg-card p-s3 shadow-e1"
        >
          <div className="flex flex-col">
            <span className="text-body font-bold text-text-primary">
              {labels.stage} {release.stageNumber}
            </span>
            <span className="text-body-sm text-text-muted">{formatDate(release.releasedAt)}</span>
          </div>

          <div className="flex flex-col items-end gap-s1">
            <span className="text-body font-bold text-text-primary">
              {formatCurrency(release.amountMinorUnits, release.currency)}
            </span>
            {release.txid ? (
              <HashChip
                hash={release.txid}
                {...(onOpenTxid ? { onOpenDetail: () => onOpenTxid(release) } : {})}
                copyLabel={labels.copy}
                copiedLabel={labels.copied}
              />
            ) : (
              <span className="text-body-sm text-pending">{labels.pending}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
