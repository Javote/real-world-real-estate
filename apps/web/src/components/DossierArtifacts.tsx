import type { DossierArtifact } from '@plataforma/shared'
import { HashChip } from '#/components/domain/HashChip'
import { VerificationBadge } from '#/components/domain/VerificationBadge'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL } from '#/lib/cardShell'
import { cn } from '#/lib/cn'

/** Los artefactos de un dossier, cada uno con su hash y su anclaje: la misma vista para investor y notary. */
export function DossierArtifacts({
  artifacts,
  title
}: {
  artifacts: readonly DossierArtifact[]
  title: string
}) {
  const { t } = useTranslation()

  return (
    <article className={cn('flex flex-col gap-s3', CARD_SHELL)}>
      <h2 className="text-body font-bold text-text-primary">{title}</h2>

      {artifacts.length === 0 ? (
        <p className="text-body-sm text-text-muted">{t('dossier.noArtifacts')}</p>
      ) : (
        <ul className="flex flex-col gap-s2">
          {artifacts.map((a) => (
            <li
              key={`${a.kind}-${a.referenceId}`}
              className="flex items-center gap-s2 rounded-lg bg-surface-alt p-s2"
            >
              <span className="min-w-0 flex-1 truncate text-body-sm text-text-secondary">
                {a.label}
              </span>
              {a.sha256 ? (
                <HashChip
                  hash={a.sha256}
                  copyLabel={t('hash.copy')}
                  copiedLabel={t('hash.copied')}
                />
              ) : null}
              <VerificationBadge
                txid={a.txid}
                verifiedLabel={t('status.verified')}
                pendingLabel={t('status.pending')}
              />
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
