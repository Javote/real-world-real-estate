import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { api } from '#/api/port'
import { DEV_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { UnitCard } from '#/components/domain/UnitCard'
import { PanelLayout } from '#/components/PanelLayout'
import { formatCurrency } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'

// **M2-D5 fila 44 · `/developer/units`** — el inventario cruzando proyectos.
// Endpoint: GET /developer/units. Test ID: DEV-UNITS-INVENTORY-001.
//
// **Las filas del developer NO llevan avance** (M2-D3 §UnitCard): el avance es
// del proyecto (D-029) y repetir el mismo número en cuarenta filas no informa
// nada. Por eso la variante `developer` del componente no lo tiene.
//
// El estado comercial —vendida, reservada, disponible— es justamente lo que la
// plataforma sí puede afirmar sobre una unidad (D-070).

export const Route = createFileRoute('/developer/units')({ component: DeveloperUnits })

const TONO = {
  sold: 'verified',
  reserved: 'pending',
  available: 'neutral'
} as const

function DeveloperUnits() {
  const { ready } = useRoleGuard(DEV_ROLES)
  const { t, locale } = useTranslation()

  const { data: unidades } = useQuery({
    queryKey: ['developer', 'units'],
    queryFn: api.listDeveloperUnits,
    enabled: ready
  })

  if (!ready) return null

  const vendidas = unidades?.filter((u) => u.status === 'sold').length ?? 0

  return (
    <PanelLayout
      rol="developer"
      title={t('developer.units.title')}
      context={t('developer.units.context', {
        sold: String(vendidas),
        total: String(unidades?.length ?? 0)
      })}
    >
      <section className="flex flex-col gap-s2" data-testid="DEV-UNITS-INVENTORY-001">
        {unidades?.length ? (
          unidades.map((u) => (
            <UnitCard
              key={u.id}
              variant="developer"
              unitReference={`${u.projectName} · ${u.unitReference}`}
              detailLine={t(`unitStatus.${u.status}` as never) ?? u.status}
              investorLabel={
                u.investorId ? t('developer.units.assigned') : t('developer.units.unassigned')
              }
              {...(u.priceMinorUnits !== null && u.currency
                ? { priceLabel: formatCurrency(u.priceMinorUnits, u.currency, locale) }
                : {})}
              status={{
                tone: TONO[u.status as keyof typeof TONO] ?? 'neutral',
                label: t(`unitStatus.${u.status}` as never) ?? u.status
              }}
            />
          ))
        ) : (
          <p className="rounded-xl bg-card p-s4 text-body-sm text-text-muted shadow-e1">
            {t('developer.units.empty')}
          </p>
        )}
      </section>
    </PanelLayout>
  )
}
