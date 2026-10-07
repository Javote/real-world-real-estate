import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Download, Share2 } from 'lucide-react'
import { useState } from 'react'
import { ApiError, api } from '#/api/port'
import { dossierQueries, proyectoQueries, unidadQueries } from '#/api/queries'
import { HashChip } from '#/components/domain/HashChip'
import { Loading } from '#/components/domain/Loading'
import { PrimaryButton, SecondaryButton } from '#/components/domain/PrimaryButton'
import { ProgressBar } from '#/components/domain/ProgressBar'
import { ProgressTimeline } from '#/components/domain/ProgressTimeline'
import { ShareDossierModal } from '#/components/domain/ShareDossierModal'
import { VerificationBadge } from '#/components/domain/VerificationBadge'
import { PanelLayout } from '#/components/PanelLayout'
import { formatDate, formatMonthYear } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL } from '#/lib/cardShell'
import { cn } from '#/lib/cn'
import { reintentarSiNoEsAusencia, unicosPorStageId } from '#/lib/investor'
import { bajarBlob, timelineDeStages } from '#/lib/stageProgress'

export const Route = createFileRoute('/investor/unit/$unitId/dossier')({
  component: InvestorDossier
})

function InvestorDossier() {
  const { unitId } = Route.useParams()
  const { t, locale } = useTranslation()
  const navigate = useNavigate()
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  const {
    data: dossier,
    error,
    isPending
  } = useQuery({
    ...dossierQueries.deUnidad(unitId),
    retry: reintentarSiNoEsAusencia
  })

  const { data: unidad } = useQuery({
    ...unidadQueries.detalle(unitId),
    retry: reintentarSiNoEsAusencia
  })

  const { data: proyecto } = useQuery({
    ...proyectoQueries.detalle(unidad?.projectId ?? ''),
    enabled: Boolean(unidad?.projectId),
    retry: reintentarSiNoEsAusencia
  })

  const stages = unicosPorStageId(unidad?.stages ?? [])
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

  if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
    return (
      <PanelLayout title={t('investor.dossier.title')}>
        <p data-testid="INV-DOSSIER-VIEW-001">
          {error.status === 403 ? t('error.forbidden') : t('error.notFound')}
        </p>
      </PanelLayout>
    )
  }

  return (
    <PanelLayout
      title={t('investor.dossier.title')}
      context={dossier ? `${dossier.projectName} · ${dossier.unitReference}` : null}
      back={{
        label: t('investor.dossier.back'),
        onClick: () => void navigate({ to: '/investor/unit/$unitId', params: { unitId } })
      }}
    >
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

        {isPending ? (
          <Loading />
        ) : dossier ? (
          <>
            <article className="flex flex-col gap-s3 rounded-xl bg-verified-light p-s4">
              <h2 className="text-body font-bold text-verified">
                {t('investor.dossier.certification')}
              </h2>
              <p className="text-body-sm text-text-secondary">
                {t('investor.dossier.certificationBody')}
              </p>
              <div className="flex items-center justify-between gap-s2">
                <span className="text-caption text-text-muted">
                  {t('investor.dossier.masterHash')}
                </span>
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
                <h2 className="text-body font-bold text-text-primary">
                  {t('investor.unit.progress')}
                </h2>
                <ProgressTimeline
                  stages={timeline}
                  ariaLabel={t('investor.project.timelineAria')}
                  finalizationLabel={
                    proyecto?.estimatedDelivery
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
              <h2 className="text-body font-bold text-text-primary">
                {t('investor.dossier.summary')}
              </h2>
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
                  <dd className="text-text-primary">
                    {formatDate(String(dossier.compiledAt), locale)}
                  </dd>
                </div>
              </dl>
            </article>

            <article className={cn('flex flex-col gap-s3', CARD_SHELL)}>
              <h2 className="text-body font-bold text-text-primary">
                {t('investor.dossier.artifacts')}
              </h2>
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
            </article>
          </>
        ) : null}
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
    </PanelLayout>
  )
}
