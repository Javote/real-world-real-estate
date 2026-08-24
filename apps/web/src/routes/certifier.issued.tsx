import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { api } from '#/api/port'
import { CERTIFIER_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { HashChip } from '#/components/domain/HashChip'
import { StatusPill } from '#/components/domain/StatusPill'
import { PanelLayout } from '#/components/PanelLayout'
import { formatDate } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'

// **M2-D5 fila 58 · `/certifier/issued`** — captura 58-CERTIFIER-ISSUED.
// Componentes: HashChip (certificate hash + TXID), StatusPill (Certified).
// Endpoint: GET /certifier/certificates?cursor=. Test ID: CER-ISSUED-LIST-001.
// Patrón: P2.
//
// **El estado sale del TXID, no de `certifiedAt`.** Un stage puede estar
// certificado en el registro y su anclaje todavía sin confirmar: ahí el pill
// dice "Pendiente" (regla 17). La captura muestra "Certified" porque su dato
// mock ya tiene TXID.

export const Route = createFileRoute('/certifier/issued')({ component: IssuedCertificates })

function IssuedCertificates() {
  const { ready } = useRoleGuard(CERTIFIER_ROLES)
  const { t, locale } = useTranslation()

  const { data } = useQuery({
    queryKey: ['certifier', 'certificates'],
    queryFn: () => api.listCertificates(),
    enabled: ready
  })

  if (!ready) return null

  return (
    <PanelLayout
      rol="certifier"
      title={t('certifier.issued.title')}
      context={t('certifier.issued.context')}
    >
      <section data-testid="CER-ISSUED-LIST-001">
        {data?.items.length ? (
          <ul className="flex flex-col gap-s3">
            {data.items.map((c) => {
              const anclado = c.txid !== null
              return (
                <li
                  key={c.stageId}
                  className="flex flex-col gap-s2 rounded-xl bg-card p-s4 shadow-e1"
                >
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

                    {/* El hash del bundle certificado y su TXID, los dos
                        completos (regla 16): HashChip trunca al mostrar. */}
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
          <p className="rounded-xl bg-card p-s4 text-body-sm text-text-muted shadow-e1">
            {t('certifier.issued.empty')}
          </p>
        )}
      </section>
    </PanelLayout>
  )
}
