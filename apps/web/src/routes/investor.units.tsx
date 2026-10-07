import type { UnitStatus } from '@plataforma/shared'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { projectCoverUrl } from '#/api/port'
import { unidadQueries } from '#/api/queries'
import { Loading } from '#/components/domain/Loading'
import type { StatusTone } from '#/components/domain/StatusPill'
import { UnitCard } from '#/components/domain/UnitCard'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL_EMPTY } from '#/lib/cardShell'
import { useAbrirConPrecarga } from '#/lib/intencion'

export const Route = createFileRoute('/investor/units')({
  loader: ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(unidadQueries.delInvestor())
  },
  component: InvestorUnits
})

const TONO: Record<UnitStatus, StatusTone> = {
  sold: 'verified',
  delivered: 'verified',
  reserved: 'pending',
  available: 'neutral'
}

function InvestorUnits() {
  const { t } = useTranslation()
  const abrir = useAbrirConPrecarga()

  const { data: unidades, isPending } = useQuery(unidadQueries.delInvestor())

  return (
    <PanelLayout title={t('investor.units.title')} context={t('investor.units.context')}>
      <section className="flex flex-col gap-s3" data-testid="INV-UNITS-LIST-001">
        {isPending ? (
          <Loading />
        ) : unidades?.length ? (
          unidades.map((u) => (
            <UnitCard
              key={u.id}
              variant="investor"
              unitReference={u.unitReference}
              projectName={[u.projectName, u.city].filter(Boolean).join(' · ')}
              imageUrl={projectCoverUrl(u.projectId, u.coverUpdatedAt) ?? undefined}
              progress={u.progress}
              status={{
                tone: TONO[u.status],
                label: t(`unitStatus.${u.status}`)
              }}
              {...abrir({ to: '/investor/unit/$unitId', params: { unitId: u.id } })}
            />
          ))
        ) : (
          <p className={CARD_SHELL_EMPTY}>{t('investor.units.empty')}</p>
        )}
      </section>
    </PanelLayout>
  )
}
