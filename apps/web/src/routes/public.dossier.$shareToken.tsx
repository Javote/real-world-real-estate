import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { dossierQueries } from '#/api/queries'
import { GradientHeader } from '#/components/domain/GradientHeader'
import { HashChip } from '#/components/domain/HashChip'
import { LanguageToggle } from '#/components/domain/LanguageToggle'
import { ProgressBar } from '#/components/domain/ProgressBar'
import { VerificationBadge } from '#/components/domain/VerificationBadge'
import { estadosDeRuta, oNoEncontrado } from '#/components/EstadosDeRuta'
import { formatDate } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL, CARD_SHELL_DENSE } from '#/lib/cardShell'
import { cn } from '#/lib/cn'

function Marco({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="min-h-dvh bg-app-bg">
      <GradientHeader title={t('investor.dossier.publicTitle')} right={<LanguageToggle />} />

      <main
        className="mx-auto flex max-w-lg flex-col gap-s4 p-s4"
        data-testid="INV-DOSSIER-PUBLIC-002"
      >
        {children}
      </main>
    </div>
  )
}

export const Route = createFileRoute('/public/dossier/$shareToken')({
  loader: async ({ context: { queryClient }, params: { shareToken } }) => {
    await oNoEncontrado(queryClient.ensureQueryData(dossierQueries.publico(shareToken)))
  },
  ...estadosDeRuta(Marco, { noEncontrado: 'investor.public.notFound' }),
  component: PublicDossierPage
})

function PublicDossierPage() {
  const { shareToken } = Route.useParams()
  const { t, locale } = useTranslation()

  const { data: dossier } = useSuspenseQuery(dossierQueries.publico(shareToken))

  return (
    <Marco>
      <p className="text-body-sm text-text-muted">
        {dossier.projectName} · {dossier.unitReference}
      </p>
      <article className={cn('flex flex-col gap-s3', CARD_SHELL)}>
        <div className="flex items-center justify-between gap-s2">
          <span className="text-caption text-text-muted">{t('investor.dossier.masterHash')}</span>
          <HashChip
            hash={dossier.masterHash}
            copyLabel={t('hash.copy')}
            copiedLabel={t('hash.copied')}
          />
        </div>
        <VerificationBadge
          txid={dossier.signatureTxid}
          verifiedLabel={t('status.signed')}
          pendingLabel={t('status.pending')}
        />
        <ProgressBar
          percent={dossier.completeness}
          label={t('investor.dossier.completeness')}
          showValue
        />
        <p className="text-caption text-text-muted">{formatDate(dossier.compiledAt, locale)}</p>
      </article>
      <ul className="flex flex-col gap-s2">
        {dossier.artifacts.map((a) => (
          <li
            key={`${a.kind}-${a.referenceId}`}
            className={cn('flex items-center gap-s2', CARD_SHELL_DENSE)}
          >
            <span className="min-w-0 flex-1 truncate text-body-sm text-text-secondary">
              {a.label}
            </span>
            {a.sha256 ? (
              <HashChip hash={a.sha256} copyLabel={t('hash.copy')} copiedLabel={t('hash.copied')} />
            ) : null}
          </li>
        ))}
      </ul>
      <p className="text-caption text-text-muted">{t('investor.dossier.certificationBody')}</p>
    </Marco>
  )
}
