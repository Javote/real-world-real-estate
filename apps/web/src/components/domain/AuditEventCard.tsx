import { cn } from '#/lib/cn'
import { HashChip } from './HashChip'

// M2-D3 §Cards · AuditEventCard — **patrón P6 de M2-D4**, la fila del audit log
// del developer (captura 49).
//
// **Append-only**: los eventos no se editan ni se borran. Por eso el componente
// no tiene ninguna acción de edición y su único gesto es abrir el `TxidModal`.
//
// **Las dos pills tienen paleta propia y cerrada.** M2-D3 pide que el color de
// la categoría acompañe al del rol "for visual scanning". Los datos de la
// captura no siguen ese emparejamiento —son mock, no diseño— así que lo que se
// transcribe es la ESTRUCTURA (posición y forma de cada pill) y el color sale
// de la matriz semántica, que sí es normativa.
//
// **Sin TXID no se dibuja el chip.** Un evento anclado que todavía no confirmó
// no puede mostrar una prueba que no existe (regla 17).

/** Las cinco categorías del audit log. Las mismas que las notificaciones. */
export type AuditCategory = 'etapa' | 'certificador' | 'firma' | 'liberacion' | 'documento'

/** Los cuatro roles que producen eventos. */
export type ActorRole = 'developer' | 'certifier' | 'notary' | 'investor'

const CATEGORIA: Record<AuditCategory, string> = {
  etapa: 'bg-primary-light text-primary',
  certificador: 'bg-pending-light text-pending',
  firma: 'bg-verified-light text-verified',
  liberacion: 'bg-verified-light text-verified',
  documento: 'bg-info-light text-info'
}

const ROL: Record<ActorRole, string> = {
  developer: 'bg-primary-light text-primary',
  certifier: 'bg-pending-light text-pending',
  notary: 'bg-verified-light text-verified',
  investor: 'bg-people-light text-people'
}

interface AuditEventCardProps {
  /** Ya formateado con `Intl` (regla 14). */
  timestampLabel: string
  /** Título de la acción, ya traducido desde su clave (regla 15). */
  title: string
  category: { key: AuditCategory; label: string }
  actor: { role: ActorRole; roleLabel: string; name: string }
  /** `null` mientras el anclaje no confirmó. */
  txid: string | null
  labels: { copy: string; copied: string }
  /** Abre el TxidModal (P3). */
  onOpenProof?: () => void
  className?: string
}

export function AuditEventCard({
  timestampLabel,
  title,
  category,
  actor,
  txid,
  labels,
  onOpenProof,
  className
}: AuditEventCardProps) {
  return (
    <article className={cn('flex flex-col gap-s2 rounded-lg bg-card p-s3 shadow-e1', className)}>
      <div className="flex items-start justify-between gap-s2">
        <span className="text-caption text-text-muted">{timestampLabel}</span>
        <span
          className={cn(
            'shrink-0 rounded-full px-s2 py-s1 text-caption font-medium',
            CATEGORIA[category.key]
          )}
        >
          {category.label}
        </span>
      </div>

      <h3 className="text-body font-bold text-text-primary">{title}</h3>

      <div className="flex flex-wrap items-center justify-between gap-s2">
        <span className="flex items-center gap-s2">
          <span
            className={cn('rounded-full px-s2 py-s1 text-caption font-medium', ROL[actor.role])}
          >
            {actor.roleLabel}
          </span>
          <span className="text-body-sm text-text-muted">{actor.name}</span>
        </span>

        {txid ? (
          <HashChip
            hash={txid}
            onOpenDetail={onOpenProof}
            copyLabel={labels.copy}
            copiedLabel={labels.copied}
          />
        ) : null}
      </div>
    </article>
  )
}
