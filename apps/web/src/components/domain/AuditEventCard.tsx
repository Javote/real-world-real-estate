import { CARD_SHELL_DENSE } from '#/lib/cardShell'
import { cn } from '#/lib/cn'
import { HashChip } from './HashChip'

export type AuditCategory = 'etapa' | 'certificador' | 'firma' | 'liberacion' | 'documento'

export type ActorRole = 'developer' | 'certifier' | 'notary' | 'investor'

const CATEGORIA: Record<AuditCategory, string> = {
  etapa: 'bg-primary-light text-primary-dark',
  certificador: 'bg-pending-light text-pending',
  firma: 'bg-verified-light text-verified',
  liberacion: 'bg-verified-light text-verified',
  documento: 'bg-info-light text-info'
}

const ROL: Record<ActorRole, string> = {
  developer: 'bg-primary-light text-primary-dark',
  certifier: 'bg-pending-light text-pending',
  notary: 'bg-verified-light text-verified',
  investor: 'bg-people-light text-people'
}

interface AuditEventCardProps {
  timestampLabel: string
  title: string
  category: { key: AuditCategory; label: string }
  actor: { role: ActorRole; roleLabel: string; name: string }
  txid: string | null
  labels: { copy: string; copied: string }
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
    <article className={cn('flex flex-col gap-s2', CARD_SHELL_DENSE, className)}>
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
