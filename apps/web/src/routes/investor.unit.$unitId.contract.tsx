import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { ApiError, api } from '#/api/port'
import { INVESTOR_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { Loading } from '#/components/domain/Loading'
import type { ReleaseRecord } from '#/components/domain/ReleaseProofList'
import { ReleaseProofList } from '#/components/domain/ReleaseProofList'
import { TxidModal } from '#/components/domain/TxidModal'
import { PanelLayout } from '#/components/PanelLayout'
import { formatCurrency, formatDate, formatDateTime } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL } from '#/lib/cardShell'
import { cn } from '#/lib/cn'
import { reintentarSiNoEsAusencia } from '#/lib/investor'

// **M2-D5 filas 23-24 y 25v · `/investor/unit/:unitId/contract`** — capturas 23-25.
// Test IDs: INV-CONTRACT-VIEW-001, INV-RELEASES-LIST-002, INV-TXID-MODAL-001.
// Patrones: P2, P3, P10.
//
// El GET del contrato no trae TXID ni commitment: no se dibuja un hash de
// contrato. "Paid" no se usa: el estado sale del TXID de cada release (D-021).

export const Route = createFileRoute('/investor/unit/$unitId/contract')({
  component: InvestorContract
})

function InvestorContract() {
  const { unitId } = Route.useParams()
  const { ready } = useRoleGuard(INVESTOR_ROLES)
  const { t, locale } = useTranslation()
  const navigate = useNavigate()
  const [txid, setTxid] = useState<ReleaseRecord | null>(null)

  const { data: unidad } = useQuery({
    queryKey: ['investor', 'unit', unitId],
    queryFn: () => api.getInvestorUnit(unitId),
    enabled: ready,
    retry: reintentarSiNoEsAusencia
  })

  const { data: contrato, error } = useQuery({
    queryKey: ['investor', 'contract', unitId],
    queryFn: () => api.getInvestorContract(unitId),
    enabled: ready,
    retry: reintentarSiNoEsAusencia
  })

  const { data: releases, isPending: releasesPending } = useQuery({
    queryKey: ['contract', contrato?.id, 'releases'],
    queryFn: () => api.listContractReleases(contrato!.id),
    enabled: ready && Boolean(contrato?.id)
  })

  if (!ready) return null

  if (error instanceof ApiError && error.status === 404) {
    return (
      <PanelLayout
        rol="investor"
        title={t('investor.contract.title')}
        back={{
          label: t('nav.back'),
          onClick: () => void navigate({ to: '/investor/unit/$unitId', params: { unitId } })
        }}
      >
        <p className="text-body text-text-muted" data-testid="INV-CONTRACT-VIEW-001">
          {t('investor.contract.missing')}
        </p>
      </PanelLayout>
    )
  }

  if (error instanceof ApiError && error.status === 403) {
    return (
      <PanelLayout rol="investor" title={t('investor.contract.title')}>
        <p data-testid="INV-CONTRACT-VIEW-001">{t('error.forbidden')}</p>
      </PanelLayout>
    )
  }

  // Los releases solo se piden con el contrato cargado: sin contrato no hay filas.
  const filas: ReleaseRecord[] = contrato
    ? (releases ?? []).map((r) => ({
        stageNumber: r.stageNumber,
        amountMinorUnits: r.amountMinorUnits,
        currency: contrato.currency,
        releasedAt: String(r.releasedAt),
        txid: r.txid
      }))
    : []

  return (
    <PanelLayout
      rol="investor"
      title={t('investor.contract.title')}
      {...(unidad ? { context: unidad.unitReference } : {})}
      back={{
        label: t('nav.back'),
        onClick: () => void navigate({ to: '/investor/unit/$unitId', params: { unitId } })
      }}
    >
      <section className="flex flex-col gap-s4" data-testid="INV-CONTRACT-VIEW-001">
        {contrato ? (
          <article className={cn('flex flex-col gap-s3', CARD_SHELL)}>
            <h2 className="text-label font-bold uppercase text-text-muted">
              {t('investor.contract.summary')}
            </h2>
            <dl className="flex flex-col gap-s3">
              <div className="flex justify-between gap-s2">
                <dt className="text-body-sm text-text-muted">{t('investor.contract.total')}</dt>
                <dd className="font-bold text-text-primary">
                  {formatCurrency(contrato.totalMinorUnits, contrato.currency, locale)}
                </dd>
              </div>
              <div className="flex justify-between gap-s2">
                <dt className="text-body-sm text-text-muted">{t('investor.contract.signedAt')}</dt>
                <dd className="text-text-primary">
                  {contrato.signedAt
                    ? formatDate(String(contrato.signedAt), locale)
                    : t('investor.contract.unsigned')}
                </dd>
              </div>
            </dl>
          </article>
        ) : null}

        <article className="flex flex-col gap-s3" data-testid="INV-RELEASES-LIST-002">
          <h2 className="text-label font-bold uppercase text-text-muted">
            {t('investor.contract.schedule')}
          </h2>
          {releasesPending ? (
            <Loading />
          ) : filas.length ? (
            <ReleaseProofList
              releases={filas}
              onOpenTxid={(release) => setTxid(release)}
              formatCurrency={(minor, currency) => formatCurrency(minor, currency, locale)}
              formatDate={(iso) => formatDate(iso, locale)}
              labels={{
                stage: t('investor.contract.stage'),
                pending: t('status.pending'),
                copy: t('hash.copy'),
                copied: t('hash.copied')
              }}
            />
          ) : (
            <p className="text-body-sm text-text-muted">{t('investor.contract.emptyReleases')}</p>
          )}
        </article>
      </section>

      {txid?.txid ? (
        <TxidModal
          open
          testId="INV-TXID-MODAL-001"
          onClose={() => setTxid(null)}
          label={`${t('investor.contract.stage')} ${txid.stageNumber}`}
          anchoredAt={txid.releasedAt}
          txid={txid.txid}
          formatDateTime={(iso) => formatDateTime(iso, locale)}
          labels={{
            title: t('txidModal.title'),
            anchoredAtLabel: t('txidModal.anchoredAt'),
            txidLabel: t('hash.txidLabel'),
            openExplorer: t('txidModal.openExplorer'),
            copy: t('hash.copy'),
            copied: t('hash.copied')
          }}
        />
      ) : null}
    </PanelLayout>
  )
}
