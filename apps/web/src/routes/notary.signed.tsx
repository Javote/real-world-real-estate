import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { api } from '#/api/port'
import { NOTARY_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { HashChip } from '#/components/domain/HashChip'
import { StatusPill } from '#/components/domain/StatusPill'
import { PanelLayout } from '#/components/PanelLayout'
import { formatDate } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'

// **M2-D5 fila 53 · `/notary/signed`** — captura 53-NOTARY-SIGNED.
// Componentes: HashChip (dossier hash + signature TXID), StatusPill.
// Endpoint: GET /notary/signatures?cursor=. Test ID: NOT-SIGNED-LIST-001.
// Patrón: P2.
//
// **Dos hashes por fila, y son cosas distintas.** El `masterHash` es lo que se
// firmó; el `signatureTxid` es la prueba de que se firmó. Mostrar uno solo
// dejaría al notario sin poder demostrar qué atestiguó exactamente.

export const Route = createFileRoute('/notary/signed')({ component: SignedDossiers })

function SignedDossiers() {
  const { ready } = useRoleGuard(NOTARY_ROLES)
  const { t, locale } = useTranslation()

  const { data } = useQuery({
    queryKey: ['notary', 'signatures'],
    queryFn: () => api.listSignatures(),
    enabled: ready
  })

  if (!ready) return null

  return (
    <PanelLayout rol="notary" title={t('notary.signed.title')} context={t('notary.signed.context')}>
      <section data-testid="NOT-SIGNED-LIST-001">
        {data?.items.length ? (
          <ul className="flex flex-col gap-s3">
            {data.items.map((f) => (
              <li
                key={f.dossierId}
                className="flex flex-col gap-s2 rounded-xl bg-card p-s4 shadow-e1"
              >
                <div className="flex items-start justify-between gap-s3">
                  <h2 className="text-body font-bold text-text-primary">
                    {f.projectName} · {f.unitReference}
                  </h2>
                  {/* Sin TXID el estado es "Pendiente" aunque el registro diga
                      firmado: la prueba puede no haber confirmado (regla 17). */}
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
          <p className="rounded-xl bg-card p-s4 text-body-sm text-text-muted shadow-e1">
            {t('notary.signed.empty')}
          </p>
        )}
      </section>
    </PanelLayout>
  )
}
