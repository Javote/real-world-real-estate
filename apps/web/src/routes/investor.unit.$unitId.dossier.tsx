import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Download, Share2 } from 'lucide-react'
import { useState } from 'react'
import { ApiError, api } from '#/api/port'
import { INVESTOR_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { HashChip } from '#/components/domain/HashChip'
import { PrimaryButton, SecondaryButton } from '#/components/domain/PrimaryButton'
import { ProgressBar } from '#/components/domain/ProgressBar'
import { ProgressTimeline } from '#/components/domain/ProgressTimeline'
import { ShareDossierModal } from '#/components/domain/ShareDossierModal'
import { VerificationBadge } from '#/components/domain/VerificationBadge'
import { PanelLayout } from '#/components/PanelLayout'
import { formatDate, formatMonthYear } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'
import { reintentarSiNoEsAusencia, unicosPorStageId } from '#/lib/investor'
import { bajarBlob, timelineDeStages } from '#/lib/stageProgress'

// **M2-D5 filas 26-29 y 28s · `/investor/unit/:unitId/dossier`**
// Test IDs: INV-DOSSIER-VIEW-001, INV-DOSSIER-EXPORT-002, INV-DOSSIER-SHARE-001.
// Patrón P8. El dossier incompleto no se bloquea: la barra lo refleja.
//
// **Dos dimensiones, dos componentes** (M2-D4 §6.1 — "patterns compose, never
// overlap"): `ProgressBar` de acá abajo es la de PRUEBA — qué fracción de los
// artefactos tiene TXID (regla 17). El `ProgressTimeline` que se agregó es la
// de OBRA — en qué etapa va la construcción, mismos datos que ya usa
// `/investor/unit/:unitId` vía `getInvestorUnit`. Son preguntas distintas y
// las capturas 26-29 muestran las dos.

export const Route = createFileRoute('/investor/unit/$unitId/dossier')({
  component: InvestorDossier
})

function InvestorDossier() {
  const { unitId } = Route.useParams()
  const { ready } = useRoleGuard(INVESTOR_ROLES)
  const { t, locale } = useTranslation()
  const navigate = useNavigate()
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  const { data: dossier, error } = useQuery({
    queryKey: ['investor', 'unit', unitId, 'dossier'],
    queryFn: () => api.getUnitDossier(unitId),
    enabled: ready,
    retry: reintentarSiNoEsAusencia
  })

  const { data: unidad } = useQuery({
    queryKey: ['investor', 'unit', unitId],
    queryFn: () => api.getInvestorUnit(unitId),
    enabled: ready,
    retry: reintentarSiNoEsAusencia
  })

  const { data: proyecto } = useQuery({
    queryKey: ['project', unidad?.projectId],
    queryFn: () => api.getProject(unidad!.projectId),
    enabled: ready && Boolean(unidad?.projectId),
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

  if (!ready) return null

  if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
    return (
      <PanelLayout rol="investor" title={t('investor.dossier.title')}>
        <p data-testid="INV-DOSSIER-VIEW-001">
          {error.status === 403 ? t('error.forbidden') : t('error.notFound')}
        </p>
      </PanelLayout>
    )
  }

  return (
    <PanelLayout
      rol="investor"
      title={t('investor.dossier.title')}
      {...(dossier ? { context: `${dossier.projectName} · ${dossier.unitReference}` } : {})}
      back={{
        label: t('investor.dossier.back'),
        onClick: () => void navigate({ to: '/investor/unit/$unitId', params: { unitId } })
      }}
    >
      <section className="flex flex-col gap-s4" data-testid="INV-DOSSIER-VIEW-001">
        <div className="flex gap-s3">
          <SecondaryButton onClick={() => compartir.mutate()} disabled={compartir.isPending}>
            <Share2 className="size-icon-sm" aria-hidden="true" />
            {t('investor.dossier.share')}
          </SecondaryButton>
          <PrimaryButton
            testId="INV-DOSSIER-EXPORT-002"
            onClick={() => exportar.mutate()}
            disabled={exportar.isPending}
          >
            <Download className="size-icon-sm" aria-hidden="true" />
            {exportar.isPending ? t('investor.dossier.exporting') : t('investor.dossier.export')}
          </PrimaryButton>
        </div>

        {dossier ? (
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
              <article className="flex flex-col gap-s3 rounded-xl bg-card p-s4 shadow-e1">
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

            <article className="flex flex-col gap-s3 rounded-xl bg-card p-s4 shadow-e1">
              <h2 className="text-body font-bold text-text-primary">
                {t('investor.dossier.completeness')}
              </h2>
              <div className="flex items-center justify-between text-body-sm">
                <span className="text-text-muted">{t('investor.dossier.progress')}</span>
                <span className="font-bold text-primary">{dossier.completeness}%</span>
              </div>
              <ProgressBar percent={dossier.completeness} />
            </article>

            <article className="flex flex-col gap-s3 rounded-xl bg-card p-s4 shadow-e1">
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

            <article className="flex flex-col gap-s3 rounded-xl bg-card p-s4 shadow-e1">
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
