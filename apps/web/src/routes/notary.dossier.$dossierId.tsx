import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AlertCircle, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { api } from '#/api/port'
import { NOTARY_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { HashChip } from '#/components/domain/HashChip'
import { ObserveStageModal } from '#/components/domain/ObserveStageModal'
import { PrimaryButton, SecondaryButton } from '#/components/domain/PrimaryButton'
import { ProgressBar } from '#/components/domain/ProgressBar'
import { StatusPill } from '#/components/domain/StatusPill'
import { VerificationBadge } from '#/components/domain/VerificationBadge'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'

// **M2-D5 filas 52v, 52s y 52r** — captura 52-NOTARY-DOSSIER-A.
// Test IDs: NOT-DOSSIER-VIEW-001, NOT-DOSSIER-SIGN-001, NOT-DOSSIER-REJECT-001.
// Patrones: P1, P2, P8.
//
// **Lo único que la firma afirma** (D-026): que esta persona atestiguó haber
// revisado estos hashes en este momento. No dice que los documentos sean
// auténticos, ni que la obra esté bien, ni que la operación sea válida. El copy
// de esta pantalla tiene que sostener exactamente eso y nada más.
//
// **Firmar es terminal.** Una vez firmado, el `masterHash` se congela del lado
// del servidor y el rechazo devuelve 409: por eso acá las acciones desaparecen
// en vez de quedar deshabilitadas — una acción que no va a poder ejecutarse
// nunca no es una acción.

export const Route = createFileRoute('/notary/dossier/$dossierId')({
  component: DossierReview
})

function DossierReview() {
  const { dossierId } = Route.useParams()
  const { ready } = useRoleGuard(NOTARY_ROLES)
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [rechazando, setRechazando] = useState(false)

  const { data: dossier } = useQuery({
    queryKey: ['notary', 'dossier', dossierId],
    queryFn: () => api.getDossier(dossierId),
    enabled: ready
  })

  const alTerminar = () => {
    void queryClient.invalidateQueries({ queryKey: ['notary'] })
    void navigate({ to: '/notary' })
  }

  const firmar = useMutation({
    mutationFn: () => api.signDossier(dossierId),
    onSuccess: alTerminar
  })
  const rechazar = useMutation({
    mutationFn: (note: string) => api.rejectDossier(dossierId, note),
    onSuccess: () => {
      setRechazando(false)
      alTerminar()
    }
  })

  if (!ready) return null

  const firmado = dossier?.status === 'signed'

  return (
    <PanelLayout
      rol="notary"
      title={t('notary.dossier.title')}
      {...(dossier ? { context: `${dossier.projectName} · ${dossier.unitReference}` } : {})}
    >
      <section className="flex flex-col gap-s4" data-testid="NOT-DOSSIER-VIEW-001">
        {dossier ? (
          <>
            <article className="flex flex-col gap-s3 rounded-xl bg-card p-s4 shadow-e1">
              <div className="flex items-start justify-between gap-s3">
                <h2 className="text-h2 font-bold text-text-primary">{dossier.unitReference}</h2>
                <StatusPill tone={firmado ? 'verified' : 'pending'}>
                  {firmado ? t('status.signed') : t('status.pending')}
                </StatusPill>
              </div>

              {/* Completitud: **qué fracción de la prueba está sustanciada**, no
                  "cuán listo está el dossier" (regla 17). */}
              <ProgressBar percent={dossier.completeness} showValue />

              <div className="flex items-center justify-between gap-s3">
                <span className="text-body-sm text-text-muted">
                  {t('notary.dossier.masterHash')}
                </span>
                <HashChip
                  hash={dossier.masterHash}
                  copyLabel={t('hash.copy')}
                  copiedLabel={t('hash.copied')}
                />
              </div>

              {dossier.signatureTxid ? (
                <div className="flex items-center justify-between gap-s3">
                  <span className="text-body-sm text-text-muted">
                    {t('notary.dossier.signatureTxid')}
                  </span>
                  <HashChip
                    hash={dossier.signatureTxid}
                    label={t('hash.txidLabel')}
                    copyLabel={t('hash.copy')}
                    copiedLabel={t('hash.copied')}
                  />
                </div>
              ) : null}
            </article>

            {/* Los checklists por sección de la captura. M2-D3 §Accessibility:
                "status colour is never the sole carrier of meaning" — el color
                del ícono solo no alcanza; VerificationBadge trae el label de
                texto que la regla pide. */}
            <article className="flex flex-col gap-s3 rounded-xl bg-card p-s4 shadow-e1">
              <h3 className="text-body font-bold text-text-primary">
                {t('notary.dossier.artifacts')}
              </h3>

              {dossier.artifacts.length === 0 ? (
                <p className="text-body-sm text-text-muted">{t('notary.dossier.noArtifacts')}</p>
              ) : (
                <ul className="flex flex-col gap-s2">
                  {dossier.artifacts.map((a) => (
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

            <p className="text-caption text-text-muted">{t('notary.dossier.disclaimer')}</p>
          </>
        ) : null}
      </section>

      {!firmado ? (
        <div className="flex gap-s3">
          <SecondaryButton
            className="flex-1"
            testId="NOT-DOSSIER-REJECT-001"
            onClick={() => setRechazando(true)}
            disabled={firmar.isPending || rechazar.isPending}
          >
            <AlertCircle className="size-icon-inline" aria-hidden="true" />
            {t('notary.dossier.reject')}
          </SecondaryButton>

          <PrimaryButton
            className="flex-1"
            testId="NOT-DOSSIER-SIGN-001"
            onClick={() => firmar.mutate()}
            disabled={firmar.isPending}
          >
            <ShieldCheck className="size-icon-inline" aria-hidden="true" />
            {firmar.isPending ? t('notary.dossier.signing') : t('notary.dossier.sign')}
          </PrimaryButton>
        </div>
      ) : null}

      {/* El modal de observación es el mismo componente que usa el certifier:
          capturar texto para devolver trabajo, con el naranja correctivo. */}
      <ObserveStageModal
        open={rechazando}
        onClose={() => setRechazando(false)}
        onSubmit={(note) => rechazar.mutate(note)}
        submitting={rechazar.isPending}
        labels={{
          title: t('notary.reject.title'),
          helper: t('notary.reject.helper'),
          noteLabel: t('notary.reject.noteLabel'),
          notePlaceholder: t('notary.reject.notePlaceholder'),
          cancel: t('common.cancel'),
          send: t('notary.reject.send'),
          sending: t('notary.reject.sending')
        }}
      />
    </PanelLayout>
  )
}
