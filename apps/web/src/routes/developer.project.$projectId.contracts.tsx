import type { UnitStatus } from '@plataforma/shared'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { FileSignature, ShieldCheck, Wallet } from 'lucide-react'
import { api } from '#/api/port'
import { DEV_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { HashChip } from '#/components/domain/HashChip'
import { Loading } from '#/components/domain/Loading'
import { StatCard } from '#/components/domain/StatCard'
import { StatusPill, type StatusTone } from '#/components/domain/StatusPill'
import { VerificationBadge } from '#/components/domain/VerificationBadge'
import { PanelLayout } from '#/components/PanelLayout'
import { formatCurrency, formatCurrencyCompact, formatDate } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL, CARD_SHELL_EMPTY } from '#/lib/cardShell'
import { cn } from '#/lib/cn'

export const Route = createFileRoute('/developer/project/$projectId/contracts')({
  component: ProjectContracts
})

const TONO: Record<UnitStatus, StatusTone> = {
  sold: 'verified',
  delivered: 'verified',
  reserved: 'pending',
  available: 'neutral'
}

function ProjectContracts() {
  const { projectId } = Route.useParams()
  const { ready } = useRoleGuard(DEV_ROLES)
  const { t, locale } = useTranslation()
  const navigate = useNavigate()

  const { data: proyecto } = useQuery({
    queryKey: ['developer', 'project', projectId],
    queryFn: () => api.getDeveloperProject(projectId),
    enabled: ready
  })

  const { data: contratos, isPending } = useQuery({
    queryKey: ['developer', 'project', projectId, 'contracts'],
    queryFn: () => api.listProjectContracts(projectId),
    enabled: ready
  })

  if (!ready) return null

  const lista = contratos ?? []
  const total = lista.reduce((acc, c) => acc + c.totalMinorUnits, 0)
  const anclados = lista.filter((c) => c.txid !== null).length
  const moneda = lista[0]?.currency ?? 'USD'

  return (
    <PanelLayout
      rol="developer"
      title={t('developer.contracts.title')}
      {...(proyecto ? { context: proyecto.name } : {})}
      back={{
        label: t('nav.back'),
        onClick: () =>
          void navigate({
            to: '/developer/project/$projectId',
            params: { projectId }
          })
      }}
    >
      <section className="grid grid-cols-3 gap-s3">
        <StatCard
          value={String(lista.length)}
          label={t('developer.contracts.count')}
          icon={FileSignature}
          tone="entity"
        />
        <StatCard
          value={formatCurrencyCompact(total, moneda, locale)}
          label={t('developer.contracts.total')}
          icon={Wallet}
          tone="financial"
        />
        <StatCard
          value={String(anclados)}
          label={t('developer.contracts.anchored')}
          icon={ShieldCheck}
          tone="verification"
        />
      </section>

      <section className="flex flex-col gap-s3" data-testid="DEV-CONTRACTS-LIST-001">
        {isPending ? (
          <Loading />
        ) : lista.length ? (
          lista.map((c) => (
            <article key={c.id} className={cn('flex flex-col gap-s2', CARD_SHELL)}>
              <div className="flex items-start justify-between gap-s2">
                <div className="flex min-w-0 flex-col">
                  <h2 className="truncate text-h2 font-bold text-text-primary">{c.investorName}</h2>
                  <p className="truncate text-body-sm text-text-muted">
                    {t('developer.contracts.unitLine', {
                      unit: c.unitReference,
                      amount: formatCurrency(c.totalMinorUnits, c.currency, locale)
                    })}
                  </p>
                </div>
                <StatusPill tone={TONO[c.unitStatus]}>{t(`unitStatus.${c.unitStatus}`)}</StatusPill>
              </div>

              <p className="text-caption text-text-muted">
                {c.signedAt
                  ? t('developer.contracts.signedOn', { date: formatDate(c.signedAt, locale) })
                  : t('developer.contracts.unsigned')}
              </p>

              <div className="flex flex-wrap items-center gap-s2">
                <VerificationBadge
                  txid={c.txid}
                  verifiedLabel={t('developer.contracts.anchoredBadge')}
                  pendingLabel={t('developer.contracts.pendingBadge')}
                />
                {c.txid ? (
                  <HashChip
                    hash={c.txid}
                    label={t('developer.contracts.txidLabel')}
                    copyLabel={t('hash.copy')}
                    copiedLabel={t('hash.copied')}
                  />
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <p className={CARD_SHELL_EMPTY}>{t('developer.contracts.empty')}</p>
        )}
      </section>
    </PanelLayout>
  )
}
