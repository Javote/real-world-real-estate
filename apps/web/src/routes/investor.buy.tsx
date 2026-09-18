import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { MapPin, Search, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '#/api/port'
import type { Project } from '#/api/types'
import { INVESTOR_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { FilterPill } from '#/components/domain/Chips'
import { LocationMapModal } from '#/components/domain/LocationMapModal'
import { ProjectCard } from '#/components/domain/ProjectCard'
import { SelectDropdown } from '#/components/domain/SelectDropdown'
import { TextInput } from '#/components/domain/TextInput'
import { PanelLayout } from '#/components/PanelLayout'
import { Dialog, DialogContent, DialogTitle } from '#/components/ui/dialog'
import { useTranslation } from '#/i18n/useTranslation'
import { avanceDeStages, TONO_PROYECTO } from '#/lib/stageProgress'

// **M2-D5 filas 02-05 · `/investor/buy`** — capturas 2-5.
// Test IDs: INV-BUY-LIST-001, INV-BUY-MAP-001, INV-BUY-SEARCH-001, INV-BUY-FILTER-001.
//
// Las filas 03-05 SON modos de la fila 02: `?view=map|search|filter`. No son
// pantallas aparte. El listado no pre-procesa `%` ni `_`: la API ya escapa.
//
// Un proyecto sin coordenadas no entra al mapa. No se le inventa un punto.

export type BuyView = 'map' | 'search' | 'filter'

export type BuySearch = {
  view?: BuyView
  q?: string
  status?: 'planning' | 'in_progress' | 'delayed' | 'completed'
  sort?: 'recent' | 'name' | 'delivery'
  city?: string
}

function parseBuySearch(raw: Record<string, unknown>): BuySearch {
  const view = raw.view
  const status = raw.status
  const sort = raw.sort
  return {
    ...(view === 'map' || view === 'search' || view === 'filter' ? { view } : {}),
    ...(typeof raw.q === 'string' && raw.q.length > 0 ? { q: raw.q } : {}),
    ...(status === 'planning' ||
    status === 'in_progress' ||
    status === 'delayed' ||
    status === 'completed'
      ? { status }
      : {}),
    ...(sort === 'recent' || sort === 'name' || sort === 'delivery' ? { sort } : {}),
    ...(typeof raw.city === 'string' && raw.city.length > 0 ? { city: raw.city } : {})
  }
}

export const Route = createFileRoute('/investor/buy')({
  validateSearch: (raw: Record<string, unknown>) => parseBuySearch(raw),
  component: InvestorBuy
})

function InvestorBuy() {
  const { ready } = useRoleGuard(INVESTOR_ROLES)
  const { t } = useTranslation()
  const navigate = useNavigate({ from: '/investor/buy' })
  const search = Route.useSearch()
  const queryClient = useQueryClient()
  const [qLocal, setQLocal] = useState(search.q ?? '')
  const [bbox, setBbox] = useState<string | undefined>()
  const [pinSeleccionado, setPinSeleccionado] = useState<string | null>(null)

  useEffect(() => {
    setQLocal(search.q ?? '')
  }, [search.q])

  useEffect(() => {
    const id = window.setTimeout(() => {
      const siguiente = qLocal.trim()
      const actual = search.q ?? ''
      if (siguiente === actual) return
      void navigate({
        search: (prev) => ({ ...prev, q: siguiente || undefined })
      })
    }, 300)
    return () => window.clearTimeout(id)
  }, [qLocal, navigate, search.q])

  const params = {
    ...(search.status ? { status: search.status } : {}),
    ...(search.q ? { q: search.q } : {}),
    ...(search.sort ? { sort: search.sort } : {}),
    ...(search.city ? { city: search.city } : {}),
    ...(search.view === 'map' && bbox ? { bbox } : {})
  }

  const { data: proyectos } = useQuery({
    queryKey: ['projects', params],
    queryFn: () => api.listProjects(params),
    enabled: ready
  })

  const { data: favoritos } = useQuery({
    queryKey: ['investor', 'favorites'],
    queryFn: api.listFavorites,
    enabled: ready
  })

  const idsFavoritos = new Set((favoritos ?? []).map((p) => p.id))

  const toggleFavorito = useMutation({
    mutationFn: (proyecto: Project) =>
      idsFavoritos.has(proyecto.id)
        ? api.removeFavorite(proyecto.id)
        : api.addFavorite(proyecto.id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['investor', 'favorites'] })
  })

  const setView = (view: BuyView | undefined) => {
    void navigate({
      search: (prev) => ({ ...prev, view })
    })
  }

  if (!ready) return null

  // Sin `label`: la captura 3 rotula el pin con el "desde", que `GET /projects`
  // no agrega. Deuda ya declarada en `ProjectCard.priceLabel` — el pin va sin
  // etiqueta antes que con un número inventado. Pasar `name` acá no hacía nada:
  // `MapMarker` no tiene ese campo y se descartaba en silencio.
  const pines = (proyectos ?? []).flatMap((p) =>
    p.latitude != null && p.longitude != null
      ? [{ id: p.id, latitude: p.latitude, longitude: p.longitude }]
      : []
  )

  const seleccionado = proyectos?.find((p) => p.id === pinSeleccionado)

  const etiquetasCard = { from: t('project.from') }

  const cardDe = (proyecto: Project) => {
    const ubicacion = [proyecto.city, proyecto.country].filter(Boolean).join(', ')
    return (
      <ProjectCard
        key={proyecto.id}
        name={proyecto.name}
        location={ubicacion || null}
        status={{
          label: t(`project.status.${proyecto.status}` as never),
          tone: TONO_PROYECTO[proyecto.status] ?? 'neutral'
        }}
        progress={avanceDeStages(proyecto.stages ?? [])}
        onOpen={() =>
          void navigate({
            to: '/project/$projectId',
            params: { projectId: proyecto.id }
          })
        }
        labels={etiquetasCard}
        favorited={idsFavoritos.has(proyecto.id)}
        onToggleFavorite={() => toggleFavorito.mutate(proyecto)}
        favoriteAriaLabel={
          idsFavoritos.has(proyecto.id)
            ? t('investor.favorites.unsave')
            : t('investor.favorites.save')
        }
        // Sin `favoriteTestId`: INV-FAV-TOGGLE-002 es de la fila 13
        // (`/investor/favorites`). El corazón acá es la misma acción, no el
        // mismo ID — repetirlo lo vuelve inutilizable como selector.
      />
    )
  }

  const toolbar = (
    <div className="flex gap-s2">
      <FilterPill
        selected={search.view === 'map'}
        onSelect={() => setView(search.view === 'map' ? undefined : 'map')}
      >
        <MapPin className="mr-s1 size-icon-inline" aria-hidden="true" />
        {t('buy.map')}
      </FilterPill>
      <FilterPill
        selected={search.view === 'search'}
        onSelect={() => setView(search.view === 'search' ? undefined : 'search')}
      >
        <Search className="mr-s1 size-icon-inline" aria-hidden="true" />
        {t('buy.search')}
      </FilterPill>
      <FilterPill
        selected={search.view === 'filter'}
        onSelect={() => setView(search.view === 'filter' ? undefined : 'filter')}
      >
        <SlidersHorizontal className="mr-s1 size-icon-inline" aria-hidden="true" />
        {t('buy.filters')}
      </FilterPill>
    </div>
  )

  const chipsActivos =
    search.q || search.status ? (
      <div className="flex flex-wrap gap-s2">
        {search.q ? (
          <button
            type="button"
            onClick={() => {
              setQLocal('')
              void navigate({ search: (prev) => ({ ...prev, q: undefined }) })
            }}
            className="inline-flex items-center gap-s1 rounded-full bg-primary-light px-s3 py-s1 text-caption font-medium text-primary"
          >
            {search.q}
            <X className="size-icon-inline" aria-hidden="true" />
          </button>
        ) : null}
        {search.status ? (
          <button
            type="button"
            onClick={() => void navigate({ search: (prev) => ({ ...prev, status: undefined }) })}
            className="inline-flex items-center gap-s1 rounded-full bg-primary-light px-s3 py-s1 text-caption font-medium text-primary"
          >
            {t(`project.status.${search.status}` as never)}
            <X className="size-icon-inline" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    ) : null

  const listado = (
    <section className="flex flex-col gap-s4" data-testid="INV-BUY-LIST-001">
      {proyectos?.length ? (
        proyectos.map((p) => cardDe(p))
      ) : (
        <p className="text-body-sm text-text-muted">
          {search.q ? t('buy.noResults') : t('panel.investor.empty')}
        </p>
      )}
    </section>
  )

  return (
    <PanelLayout rol="investor" title={t('panel.investor.title')}>
      {toolbar}
      {chipsActivos}

      {search.view === 'search' ? (
        <div className="flex flex-col gap-s2" data-testid="INV-BUY-SEARCH-001">
          <TextInput
            label={t('buy.searchLabel')}
            value={qLocal}
            onChange={setQLocal}
            placeholder={t('buy.searchPlaceholder')}
            adornment={<Search className="size-icon-inline" aria-hidden="true" />}
          />
          {qLocal && proyectos?.length ? (
            <ul className="rounded-lg bg-card p-s2 shadow-e1">
              {proyectos.slice(0, 5).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="w-full rounded-md px-s3 py-s2 text-left text-body text-text-primary hover:bg-surface-alt"
                    onClick={() =>
                      void navigate({
                        to: '/project/$projectId',
                        params: { projectId: p.id }
                      })
                    }
                  >
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {search.view === 'map' ? (
        <div className="relative flex flex-col gap-s3" data-testid="INV-BUY-MAP-001">
          <label className="sr-only" htmlFor="buy-zone">
            {t('buy.searchZone')}
          </label>
          <input
            id="buy-zone"
            value={qLocal}
            onChange={(e) => setQLocal(e.target.value)}
            placeholder={t('buy.searchZone')}
            className="w-full rounded-full border border-border bg-card px-s4 py-s3 text-body shadow-e1 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <LocationMapModal
            open
            variant="browse"
            onClose={() => setView(undefined)}
            markers={pines}
            onSelectMarker={setPinSeleccionado}
            onBoundsChange={setBbox}
            labels={{
              title: t('buy.map'),
              close: t('buy.close'),
              marker: t('buy.mapMarker')
            }}
          />
          {seleccionado ? (
            <div className="absolute inset-x-s4 top-s12 z-[500]">
              <button
                type="button"
                aria-label={t('buy.close')}
                onClick={() => setPinSeleccionado(null)}
                className="absolute top-s2 right-s2 z-10 rounded-full bg-card/90 p-s2 text-text-primary shadow-e1"
              >
                <X className="size-icon-inline" aria-hidden="true" />
              </button>
              {cardDe(seleccionado)}
            </div>
          ) : null}
        </div>
      ) : (
        listado
      )}

      <Dialog
        open={search.view === 'filter'}
        onOpenChange={(abierto) => {
          if (!abierto) setView(undefined)
        }}
      >
        <DialogContent data-testid="INV-BUY-FILTER-001" className="bg-card">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-h2 font-bold text-text-primary">
              {t('buy.filterTitle')}
            </DialogTitle>
          </div>

          <div className="flex flex-col gap-s2">
            <p className="text-body font-bold text-text-primary">{t('buy.filterStatus')}</p>
            <div className="flex flex-wrap gap-s2">
              <FilterPill
                selected={!search.status}
                onSelect={() =>
                  void navigate({ search: (prev) => ({ ...prev, status: undefined }) })
                }
              >
                {t('buy.filterStatusAll')}
              </FilterPill>
              {(['planning', 'in_progress', 'completed'] as const).map((s) => (
                <FilterPill
                  key={s}
                  selected={search.status === s}
                  onSelect={() => void navigate({ search: (prev) => ({ ...prev, status: s }) })}
                >
                  {t(`project.status.${s}` as never)}
                </FilterPill>
              ))}
            </div>
          </div>

          <SelectDropdown
            id="buy-sort"
            label={t('buy.sortBy')}
            value={search.sort ?? 'recent'}
            onChange={(valor) =>
              void navigate({
                search: (prev) => ({
                  ...prev,
                  sort: valor as 'recent' | 'name' | 'delivery'
                })
              })
            }
            options={[
              { value: 'recent', label: t('buy.sort.recent') },
              { value: 'name', label: t('buy.sort.name') },
              { value: 'delivery', label: t('buy.sort.delivery') }
            ]}
          />

          <button
            type="button"
            onClick={() =>
              void navigate({
                search: { view: 'filter' }
              })
            }
            className="self-start text-body-sm font-medium text-primary"
          >
            {t('buy.clearFilters')}
          </button>
        </DialogContent>
      </Dialog>
    </PanelLayout>
  )
}
