import type { UnitStatus } from '@plataforma/shared'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { api, projectCoverUrl } from '#/api/port'
import { Loading } from '#/components/domain/Loading'
import type { StatusTone } from '#/components/domain/StatusPill'
import { UnitCard } from '#/components/domain/UnitCard'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL_EMPTY } from '#/lib/cardShell'

export const Route = createFileRoute('/investor/units')({ component: InvestorUnits })

const TONO: Record<UnitStatus, StatusTone> = {
  sold: 'verified',
  delivered: 'verified',
  reserved: 'pending',
  available: 'neutral'
}

function InvestorUnits() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { data: unidades, isPending } = useQuery({
    queryKey: ['investor', 'units'],
    queryFn: api.listInvestorUnits
  })

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
              onOpen={() =>
                void navigate({
                  to: '/investor/unit/$unitId',
                  params: { unitId: u.id }
                })
              }
            />
          ))
        ) : (
          <p className={CARD_SHELL_EMPTY}>{t('investor.units.empty')}</p>
        )}
      </section>
    </PanelLayout>
  )
}
