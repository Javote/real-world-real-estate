import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { api } from '#/api/port'
import { DEV_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { InvestorCard } from '#/components/domain/InvestorCard'
import { PanelLayout } from '#/components/PanelLayout'
import { formatCurrency } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'

// **M2-D5 fila 48 · `/developer/investors`** — captura 48-DEVELOPER-INVESTORS.
// Endpoint: GET /developer/investors. Test ID: DEV-INVESTORS-LIST-001.
//
// **Sin pill de estado ni fila de stats, y es deuda, no diseño.** La captura y
// M2-D1 §5.2 piden ambas cosas, y M2-D3 §InvestorCard pone el pill en la
// anatomía del componente. Pero `investorDirectoryEntrySchema` no expone
// `status` y el endpoint hace `innerJoin Contract`, así que ni el dato existe
// ni los invitados sin contrato llegan a la lista. Ver el comentario de
// `InvestorCard` sobre por qué el prop quedó opcional en vez de inventarse un
// estado (regla 17: ninguna señal sin sustento).
//
// El resto de la fila sí está entero: la respuesta agrega por investor, así que
// una card resume TODAS sus unidades y proyectos en vez de repetirlo por
// contrato. Es la forma que el endpoint ya tenía y la que el directorio pide.
// La card parte Inversión / Unidad en dos columnas (captura 48); el valor de
// Unidad es el CONTEO que el contrato da, no una referencia tipo "Depto 4B"
// — esa no viaja.

export const Route = createFileRoute('/developer/investors')({ component: DeveloperInvestors })

function DeveloperInvestors() {
  const { ready } = useRoleGuard(DEV_ROLES)
  const { t, locale } = useTranslation()
  const navigate = useNavigate()

  const { data: investors } = useQuery({
    queryKey: ['developer', 'investors'],
    queryFn: api.listInvestors,
    enabled: ready
  })

  if (!ready) return null

  return (
    <PanelLayout
      rol="developer"
      title={t('developer.investors.title')}
      context={t('developer.investors.context', { count: String(investors?.length ?? 0) })}
      back={{
        label: t('nav.backToPanel'),
        onClick: () => void navigate({ to: '/developer' })
      }}
      hideBrand
    >
      <section className="flex flex-col gap-s2" data-testid="DEV-INVESTORS-LIST-001">
        {investors?.length ? (
          investors.map((inv) => (
            <InvestorCard
              key={inv.id}
              fullName={inv.fullName}
              email={inv.email}
              investedLabel={
                inv.currency
                  ? formatCurrency(inv.investedMinorUnits, inv.currency, locale)
                  : t('developer.investors.noAmount')
              }
              unitLabel={t('developer.investors.units', { count: String(inv.units) })}
              projectName={inv.projects.join(' · ')}
              investmentHeading={t('developer.investors.investment')}
              unitHeading={t('developer.investors.unit')}
            />
          ))
        ) : (
          <p className="rounded-xl bg-card p-s4 text-body-sm text-text-muted shadow-e1">
            {t('developer.investors.empty')}
          </p>
        )}
      </section>
    </PanelLayout>
  )
}
