import { useMutation, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Download, Share2 } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { api } from '#/api/port'
import { dossierQueries, proyectoQueries, unidadQueries } from '#/api/queries'
import { DossierArtifacts } from '#/components/DossierArtifacts'
import { HashChip } from '#/components/domain/HashChip'
import { PrimaryButton, SecondaryButton } from '#/components/domain/PrimaryButton'
import { ProgressBar } from '#/components/domain/ProgressBar'
import { ProgressTimeline } from '#/components/domain/ProgressTimeline'
import { ShareDossierModal } from '#/components/domain/ShareDossierModal'
import { VerificationBadge } from '#/components/domain/VerificationBadge'
import { RutaCargando, RutaConError, RutaNoEncontrada } from '#/components/EstadosDeRuta'
import { PanelLayout } from '#/components/PanelLayout'
import { formatDate, formatMonthYear } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL } from '#/lib/cardShell'
import { oNoEncontrado, PENDING_MS } from '#/lib/cargaDeRuta'
import { cn } from '#/lib/cn'
import { unicosPorStageId } from '#/lib/investor'
import { bajarBlob, timelineDeStages } from '#/lib/stageProgress'

function Marco({ children, context = null }: { children: ReactNode; context?: string | null }) {
  const { unitId } = Route.useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <PanelLayout
      title={t('investor.dossier.title')}
      context={context}
      back={{
        label: t('investor.dossier.back'),
        onClick: () => void navigate({ to: '/investor/unit/$unitId', params: { unitId } })
      }}
    >
      {children}
    </PanelLayout>
  )
}

export const Route = createFileRoute('/investor/unit/$unitId/dossier')({
  loader: async ({ context: { queryClient }, params: { unitId } }) => {
    const [dossier] = await Promise.all([
      oNoEncontrado(queryClient.ensureQueryData(dossierQueries.deUnidad(unitId))),
      queryClient.ensureQueryData(unidadQueries.detalle(unitId))
    ])
    await queryClient.ensureQueryData(proyectoQueries.detalle(dossier.projectId))
  },
  pendingMs: PENDING_MS,
  pendingComponent: () => <RutaCargando Marco={Marco} testId="INV-DOSSIER-VIEW-001" />,
  errorComponent: ({ error }) => (
    <RutaConError Marco={Marco} testId="INV-DOSSIER-VIEW-001" error={error} />
  ),
  notFoundComponent: () => <RutaNoEncontrada Marco={Marco} testId="INV-DOSSIER-VIEW-001" />,
  component: InvestorDossier
})

function InvestorDossier() {
  const { unitId } = Route.useParams()
  const { t, locale } = useTranslation()
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  const { data: dossier } = useSuspenseQuery(dossierQueries.deUnidad(unitId))
  const { data: unidad } = useSuspenseQuery(unidadQueries.detalle(unitId))
  const { data: proyecto } = useSuspenseQuery(proyectoQueries.detalle(dossier.projectId))

  const stages = unicosPorStageId(unidad.stages)
  const timeline = timelineDeStages(stages)

  const exportar = useMutation({
    mutationFn: () => api.exportUnitDossier(unitId),
    onSuccess: (blob) => bajarBlob(blob, `dossier-${unitId}.pdf`)
  })

  const compartir = useMutation({
    mutationFn: () => api.shareUnitDossier(unitId),
    onSuccess: (share) => {
      setShareUrl(`${window.location.origin}/public/dossier/${share.shareToken}`)
    }
  })

  return (
    <Marco context={`${dossier.projectName} · ${dossier.unitReference}`}>
      <section className="flex flex-col gap-s4" data-testid="INV-DOSSIER-VIEW-001">
        <div className="flex gap-s3">
          <SecondaryButton onClick={() => compartir.mutate()} disabled={compartir.isPending}>
            <Share2 className="size-icon-inline" aria-hidden="true" />
            {t('investor.dossier.share')}
          </SecondaryButton>
          <PrimaryButton
            testId="INV-DOSSIER-EXPORT-002"
            onClick={() => exportar.mutate()}
            disabled={exportar.isPending}
          >
            <Download className="size-icon-inline" aria-hidden="true" />
            {exportar.isPending ? t('investor.dossier.exporting') : t('investor.dossier.export')}
          </PrimaryButton>
        </div>

        <article className="flex flex-col gap-s3 rounded-xl bg-verified-light p-s4">
          <h2 className="text-body font-bold text-verified">
            {t('investor.dossier.certification')}
          </h2>
          <p className="text-body-sm text-text-secondary">
            {t('investor.dossier.certificationBody')}
          </p>
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
        </article>

        {timeline.length > 0 ? (
          <article className={cn('flex flex-col gap-s3', CARD_SHELL)}>
            <h2 className="text-body font-bold text-text-primary">{t('investor.unit.progress')}</h2>
            <ProgressTimeline
              stages={timeline}
              ariaLabel={t('investor.project.timelineAria')}
              finalizationLabel={
                proyecto.estimatedDelivery
                  ? t('investor.project.delivery', {
                      date: formatMonthYear(String(proyecto.estimatedDelivery), locale)
                    })
                  : undefined
              }
            />
          </article>
        ) : null}

        <article className={cn('flex flex-col gap-s3', CARD_SHELL)}>
          <h2 className="text-body font-bold text-text-primary">
            {t('investor.dossier.completeness')}
          </h2>
          <div className="flex items-center justify-between text-body-sm">
            <span className="text-text-muted">{t('investor.dossier.progress')}</span>
            <span className="font-bold text-primary">{dossier.completeness}%</span>
          </div>
          <ProgressBar percent={dossier.completeness} label={t('investor.dossier.progress')} />
        </article>

        <article className={cn('flex flex-col gap-s3', CARD_SHELL)}>
          <h2 className="text-body font-bold text-text-primary">{t('investor.dossier.summary')}</h2>
          <dl className="flex flex-col gap-s2 text-body-sm">
            <div className="flex justify-between gap-s2">
              <dt className="text-text-muted">{t('investor.unit.project')}</dt>
              <dd className="font-bold text-text-primary">{dossier.projectName}</dd>
            </div>
            <div className="flex justify-between gap-s2">
              <dt className="text-text-muted">{t('investor.unit.unit')}</dt>
              <dd className="font-bold text-text-primary">{dossier.unitReference}</dd>
            </div>
            <div className="flex justify-between gap-s2">
              <dt className="text-text-muted">{t('investor.dossier.compiledAt')}</dt>
              <dd className="text-text-primary">{formatDate(dossier.compiledAt, locale)}</dd>
            </div>
          </dl>
        </article>

        <DossierArtifacts artifacts={dossier.artifacts} title={t('investor.dossier.artifacts')} />
      </section>

      <ShareDossierModal
        open={Boolean(shareUrl)}
        onClose={() => setShareUrl(null)}
        shareUrl={shareUrl ?? ''}
        testId="INV-DOSSIER-SHARE-001"
        labels={{
          title: t('investor.dossier.shareTitle'),
          helper: t('investor.dossier.shareHelper'),
          urlLabel: t('investor.dossier.shareUrl'),
          copy: t('hash.copy'),
          copied: t('hash.copied'),
          close: t('common.close'),
          openView: t('investor.dossier.openView')
        }}
      />
    </Marco>
  )
}
