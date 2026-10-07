import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { dossierQueries } from '#/api/queries'
import { HashChip } from '#/components/domain/HashChip'
import { Loading } from '#/components/domain/Loading'
import { StatusPill } from '#/components/domain/StatusPill'
import { PanelLayout } from '#/components/PanelLayout'
import { formatDate } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL, CARD_SHELL_EMPTY } from '#/lib/cardShell'
import { cn } from '#/lib/cn'

export const Route = createFileRoute('/notary/signed')({
  loader: ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(dossierQueries.firmas())
  },
  component: SignedDossiers
})

function SignedDossiers() {
  const { t, locale } = useTranslation()

  const { data, isPending } = useQuery(dossierQueries.firmas())

  return (
    <PanelLayout title={t('notary.signed.title')} context={t('notary.signed.context')}>
      <section data-testid="NOT-SIGNED-LIST-001">
        {isPending ? (
          <Loading />
        ) : data?.items.length ? (
          <ul className="flex flex-col gap-s3">
            {data.items.map((f) => (
              <li key={f.dossierId} className={cn('flex flex-col gap-s2', CARD_SHELL)}>
                <div className="flex items-start justify-between gap-s3">
                  <h2 className="text-body font-bold text-text-primary">
                    {f.projectName} · {f.unitReference}
                  </h2>
                  <StatusPill tone={f.signatureTxid ? 'verified' : 'pending'}>
                    {f.signatureTxid ? t('status.signed') : t('status.pending')}
                  </StatusPill>
                </div>

                <div className="flex flex-wrap items-center gap-s2">
                  {f.signedAt ? (
                    <span className="text-caption text-text-muted">
                      {formatDate(String(f.signedAt), locale)}
                    </span>
                  ) : null}

                  <HashChip
                    hash={f.masterHash}
                    label={t('hash.label')}
                    copyLabel={t('hash.copy')}
                    copiedLabel={t('hash.copied')}
                  />

                  {f.signatureTxid ? (
                    <HashChip
                      hash={f.signatureTxid}
                      label={t('hash.txidLabel')}
                      copyLabel={t('hash.copy')}
                      copiedLabel={t('hash.copied')}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className={CARD_SHELL_EMPTY}>{t('notary.signed.empty')}</p>
        )}
      </section>
    </PanelLayout>
  )
}
