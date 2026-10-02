import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { api } from '#/api/port'
import { HashChip } from '#/components/domain/HashChip'
import { Loading } from '#/components/domain/Loading'
import { StatusPill } from '#/components/domain/StatusPill'
import { PanelLayout } from '#/components/PanelLayout'
import { formatDate } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL, CARD_SHELL_EMPTY } from '#/lib/cardShell'
import { cn } from '#/lib/cn'

export const Route = createFileRoute('/certifier/issued')({ component: IssuedCertificates })

function IssuedCertificates() {
  const { t, locale } = useTranslation()

  const { data, isPending } = useQuery({
    queryKey: ['certifier', 'certificates'],
    queryFn: () => api.listCertificates()
  })

  return (
    <PanelLayout title={t('certifier.issued.title')} context={t('certifier.issued.context')}>
      <section data-testid="CER-ISSUED-LIST-001">
        {isPending ? (
          <Loading />
        ) : data?.items.length ? (
          <ul className="flex flex-col gap-s3">
            {data.items.map((c) => {
              const anclado = c.txid !== null
              return (
                <li key={c.stageId} className={cn('flex flex-col gap-s2', CARD_SHELL)}>
                  <div className="flex items-start justify-between gap-s3">
                    <h2 className="text-body font-bold text-text-primary">{c.projectName}</h2>
                    <StatusPill tone={anclado ? 'verified' : 'pending'}>
                      {anclado ? t('status.certified') : t('status.pending')}
                    </StatusPill>
                  </div>

                  <p className="text-body-sm text-text-muted">{c.stageName}</p>

                  <div className="flex flex-wrap items-center gap-s2">
                    {c.certifiedAt ? (
                      <span className="text-caption text-text-muted">
                        {formatDate(String(c.certifiedAt), locale)}
                      </span>
                    ) : null}

                    {c.commitmentHash ? (
                      <HashChip
                        hash={c.commitmentHash}
                        label={t('hash.label')}
                        copyLabel={t('hash.copy')}
                        copiedLabel={t('hash.copied')}
                      />
                    ) : null}

                    {c.txid ? (
                      <HashChip
                        hash={c.txid}
                        label={t('hash.txidLabel')}
                        copyLabel={t('hash.copy')}
                        copiedLabel={t('hash.copied')}
                      />
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className={CARD_SHELL_EMPTY}>{t('certifier.issued.empty')}</p>
        )}
      </section>
    </PanelLayout>
  )
}
