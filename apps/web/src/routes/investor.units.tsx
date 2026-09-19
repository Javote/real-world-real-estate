import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { api } from '#/api/port'
import { INVESTOR_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { Loading } from '#/components/domain/Loading'
import { UnitCard } from '#/components/domain/UnitCard'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL_EMPTY } from '#/lib/cardShell'

// **M2-D5 fila 14 · `/investor/units`** — "Mis unidades".
// Endpoint: GET /investor/units. Test ID: INV-UNITS-LIST-001.
//
// **El avance que muestra cada card es del PROYECTO** (D-029): los stages son
// los mismos para todas las unidades hermanas porque un desarrollo tiene un
// solo trámite. La captura 55 muestra tres unidades del mismo proyecto en tres
// etapas distintas y casi nos hace modelar stages por unidad — son datos mock.
//
// **Aislamiento cross-rol**: el endpoint filtra por `investorId`, así que acá
// solo llegan las unidades de quien mira (M2-D1 §Cross-role data isolation).

export const Route = createFileRoute('/investor/units')({ component: InvestorUnits })

const TONO = {
  sold: 'verified',
  reserved: 'pending',
  available: 'neutral'
} as const

function InvestorUnits() {
  const { ready } = useRoleGuard(INVESTOR_ROLES)
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { data: unidades, isPending } = useQuery({
    queryKey: ['investor', 'units'],
    queryFn: api.listInvestorUnits,
    enabled: ready
  })

  if (!ready) return null

  return (
    <PanelLayout
      rol="investor"
      title={t('investor.units.title')}
      context={t('investor.units.context')}
    >
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
              progress={u.progress}
              status={{
                tone: TONO[u.status as keyof typeof TONO] ?? 'neutral',
                label: t(`unitStatus.${u.status}`) ?? u.status
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
