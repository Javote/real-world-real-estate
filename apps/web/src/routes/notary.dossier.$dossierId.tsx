import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AlertCircle, ShieldCheck } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { api } from '#/api/port'
import { dossierQueries, invalidaciones, invalidar } from '#/api/queries'
import { DossierArtifacts } from '#/components/DossierArtifacts'
import { HashChip } from '#/components/domain/HashChip'
import { ObserveStageModal } from '#/components/domain/ObserveStageModal'
import { PrimaryButton, SecondaryButton } from '#/components/domain/PrimaryButton'
import { ProgressBar } from '#/components/domain/ProgressBar'
import { StatusPill } from '#/components/domain/StatusPill'
import { RutaCargando, RutaConError, RutaNoEncontrada } from '#/components/EstadosDeRuta'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL } from '#/lib/cardShell'
import { oNoEncontrado, PENDING_MS } from '#/lib/cargaDeRuta'
import { cn } from '#/lib/cn'

function Marco({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return <PanelLayout title={t('notary.dossier.title')}>{children}</PanelLayout>
}

export const Route = createFileRoute('/notary/dossier/$dossierId')({
  loader: async ({ context: { queryClient }, params: { dossierId } }) => {
    await oNoEncontrado(queryClient.ensureQueryData(dossierQueries.detalle(dossierId)))
  },
  pendingMs: PENDING_MS,
  pendingComponent: () => <RutaCargando Marco={Marco} testId="NOT-DOSSIER-VIEW-001" />,
  errorComponent: ({ error }) => (
    <RutaConError Marco={Marco} testId="NOT-DOSSIER-VIEW-001" error={error} />
  ),
  notFoundComponent: () => <RutaNoEncontrada Marco={Marco} testId="NOT-DOSSIER-VIEW-001" />,
  component: DossierReview
})

function DossierReview() {
  const { dossierId } = Route.useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [rechazando, setRechazando] = useState(false)

  const { data: dossier } = useSuspenseQuery(dossierQueries.detalle(dossierId))

  const alTerminar = () => {
    invalidar(queryClient, invalidaciones.dossierResuelto())
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

  const firmado = dossier.status === 'signed'
  const enRevision = dossier.status === 'compiled'

  return (
    <PanelLayout
      title={t('notary.dossier.title')}
      context={`${dossier.projectName} · ${dossier.unitReference}`}
    >
      <section className="flex flex-col gap-s4" data-testid="NOT-DOSSIER-VIEW-001">
        <article className={cn('flex flex-col gap-s3', CARD_SHELL)}>
          <div className="flex items-start justify-between gap-s3">
            <h2 className="text-h2 font-bold text-text-primary">{dossier.unitReference}</h2>
            <StatusPill tone={firmado ? 'verified' : 'pending'}>
              {firmado ? t('status.signed') : t('status.pending')}
            </StatusPill>
          </div>

          <ProgressBar
            percent={dossier.completeness}
            label={t('investor.dossier.completeness')}
            showValue
          />

          <div className="flex items-center justify-between gap-s3">
            <span className="text-body-sm text-text-muted">{t('notary.dossier.masterHash')}</span>
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

        <DossierArtifacts artifacts={dossier.artifacts} title={t('notary.dossier.artifacts')} />

        <p className="text-caption text-text-muted">{t('notary.dossier.disclaimer')}</p>
      </section>

      {enRevision ? (
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
