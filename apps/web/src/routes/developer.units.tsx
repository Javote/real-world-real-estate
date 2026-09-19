import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Home } from 'lucide-react'
import { api } from '#/api/port'
import type { DeveloperUnit } from '#/api/types'
import { DEV_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { ProgressBar } from '#/components/domain/ProgressBar'
import { StatCard } from '#/components/domain/StatCard'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL, CARD_SHELL_EMPTY } from '#/lib/cardShell'
import { cn } from '#/lib/cn'

// **M2-D5 fila 44 · `/developer/units`** — el inventario cruzando proyectos.
// Endpoint: GET /developer/units. Test ID: DEV-UNITS-INVENTORY-001.
//
// **La captura no es una lista de unidades: es una lista de PROYECTOS** con
// Total / Vendidas / Disponibles y una barra de ocupación. Las filas sueltas
// de `UnitCard` (variante developer) viven en `/developer/project/:id/units`
// (captura 44b), que es otra superficie.
//
// **Sin foto en la card.** `DeveloperUnit` no trae imagen y `Project` tampoco
// tiene columna para una. La ubicación sí: sale de `GET /developer/projects`,
// que ya la tiene. El badge con ícono es lo que el resto de la app usa cuando
// hay una entidad y no hay foto.
//
// La ocupación es vendidas / total. Reservadas cuentan en el total y no en
// ninguno de los otros dos tiles — la captura 44 no tiene "Reservadas".

export const Route = createFileRoute('/developer/units')({ component: DeveloperUnits })

function DeveloperUnits() {
  const { ready } = useRoleGuard(DEV_ROLES)
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { data: unidades } = useQuery({
    queryKey: ['developer', 'units'],
    queryFn: api.listDeveloperUnits,
    enabled: ready
  })

  const { data: proyectos } = useQuery({
    queryKey: ['developer', 'projects'],
    queryFn: api.listDeveloperProjects,
    enabled: ready
  })

  if (!ready) return null

  const vendidas =
    unidades?.filter((u) => u.status === 'sold' || u.status === 'delivered').length ?? 0
  const disponibles = unidades?.filter((u) => u.status === 'available').length ?? 0
  const porProyecto = agrupar(unidades ?? [])

  return (
    <PanelLayout
      rol="developer"
      title={t('developer.units.title')}
      context={t('developer.units.context', {
        sold: String(vendidas),
        total: String(unidades?.length ?? 0)
      })}
      back={{
        label: t('nav.backToPanel'),
        onClick: () => void navigate({ to: '/developer' })
      }}
    >
      <section className="grid grid-cols-3 gap-s3">
        <StatCard
          value={String(unidades?.length ?? 0)}
          label={t('developer.projectUnits.countTotal')}
        />
        <StatCard value={String(vendidas)} label={t('developer.projectUnits.countSold')} />
        <StatCard value={String(disponibles)} label={t('developer.projectUnits.countAvailable')} />
      </section>

      <section className="flex flex-col gap-s3" data-testid="DEV-UNITS-INVENTORY-001">
        {porProyecto.length ? (
          porProyecto.map((grupo) => {
            const proyecto = proyectos?.find((p) => p.id === grupo.projectId)
            const ubicacion = [proyecto?.city, proyecto?.country].filter(Boolean).join(', ')
            const total = grupo.units.length
            const sold = grupo.units.filter(
              (u) => u.status === 'sold' || u.status === 'delivered'
            ).length
            const available = grupo.units.filter((u) => u.status === 'available').length
            const ocupacion = total > 0 ? Math.round((sold / total) * 100) : 0

            return (
              <article key={grupo.projectId} className={cn('flex flex-col gap-s3', CARD_SHELL)}>
                <div className="flex items-center gap-s3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-info text-white">
                    <Home className="size-icon-stat" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-body font-bold text-text-primary">
                      {grupo.projectName}
                    </h2>
                    {ubicacion ? (
                      <p className="truncate text-caption text-text-muted">{ubicacion}</p>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-s2">
                  <Conteo value={String(total)} label={t('developer.projectUnits.countTotal')} />
                  <Conteo value={String(sold)} label={t('developer.projectUnits.countSold')} />
                  <Conteo
                    value={String(available)}
                    label={t('developer.projectUnits.countAvailable')}
                  />
                </div>

                <div className="flex flex-col gap-s1">
                  <span className="text-body-sm text-text-muted">
                    {t('developer.units.occupancy')}
                  </span>
                  <ProgressBar percent={ocupacion} showValue />
                </div>
              </article>
            )
          })
        ) : (
          <p className={CARD_SHELL_EMPTY}>{t('developer.units.empty')}</p>
        )}
      </section>
    </PanelLayout>
  )
}

function agrupar(unidades: DeveloperUnit[]) {
  const mapa = new Map<string, { projectId: string; projectName: string; units: DeveloperUnit[] }>()
  for (const u of unidades) {
    const actual = mapa.get(u.projectId) ?? {
      projectId: u.projectId,
      projectName: u.projectName,
      units: []
    }
    actual.units.push(u)
    mapa.set(u.projectId, actual)
  }
  return [...mapa.values()]
}

/** Los tres conteos chicos DENTRO de la card. No es un StatCard: no lleva ícono. */
function Conteo({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-surface-alt p-s2">
      <span className="text-body font-bold text-text-primary">{value}</span>
      <span className="text-caption text-text-muted">{label}</span>
    </div>
  )
}
