import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '#/api/port'
import type { Project } from '#/api/types'
import { dictionary } from '#/i18n/dictionary'
import { dispararMoveend, marker } from '#/test/leaflet-falso'
import { autenticarComo, INVESTOR_USER, montarRuta } from './-test-mount'
import { Route } from './investor.buy'

vi.mock('leaflet', () => import('#/test/leaflet-falso'))

const t = (clave: keyof (typeof dictionary)['es-AR']) => dictionary['es-AR'][clave]

const proyecto = (sobre: Partial<Project>): Project => ({
  id: 'p1',
  name: 'Torre A',
  slug: 'torre-a',
  address: null,
  city: 'Rosario',
  country: 'Argentina',
  latitude: null,
  longitude: null,
  totalUnits: 10,
  estimatedDelivery: null,
  status: 'in_progress',
  organizationId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  stages: [],
  ...sobre
})

const TORRE_A = proyecto({ id: 'p1', name: 'Torre A' })
const TORRE_B = proyecto({
  id: 'p2',
  name: 'Torre B',
  city: null,
  country: null,
  status: 'planning'
})

const RUTA = '/investor/buy'
const EXTRAS = ['/project/$projectId']

function montar(entrada = RUTA) {
  return montarRuta(Route, RUTA, EXTRAS, entrada)
}

/** Lo que `validateSearch` dejó en la ruta (`location.search` es la URL cruda). */
const busqueda = (router: ReturnType<typeof montar>) => router.state.matches.at(-1)?.search

function preparar(proyectos: Project[] = [TORRE_A, TORRE_B], favoritos: Project[] = []) {
  autenticarComo(INVESTOR_USER)
  const listar = vi.spyOn(api, 'listProjects').mockResolvedValue(proyectos)
  vi.spyOn(api, 'listFavorites').mockResolvedValue(favoritos)
  return listar
}

describe('/investor/buy', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.restoreAllMocks())

  describe('el listado', () => {
    it('mientras carga muestra el estado de carga', async () => {
      autenticarComo(INVESTOR_USER)
      vi.spyOn(api, 'listProjects').mockReturnValue(new Promise(() => {}))
      vi.spyOn(api, 'listFavorites').mockResolvedValue([])
      montar()

      const lista = await screen.findByTestId('INV-BUY-LIST-001')
      expect(within(lista).getByRole('status')).toBeTruthy()
    })

    it('INV-BUY-LIST-001: muestra una card por proyecto, con su ubicación cuando la tiene', async () => {
      preparar()
      montar()

      const lista = await screen.findByTestId('INV-BUY-LIST-001')
      await within(lista).findByText('Torre B')
      expect(within(lista).getAllByRole('article')).toHaveLength(2)
      expect(within(lista).getByText('Rosario, Argentina')).toBeTruthy()
      expect(within(lista).getByText(t('project.status.planning'))).toBeTruthy()
    })

    it('sin proyectos y sin búsqueda muestra el vacío del panel', async () => {
      preparar([])
      montar()

      await screen.findByText(t('panel.investor.empty'))
    })

    it('sin resultados con una búsqueda activa muestra "ningún desarrollo coincide"', async () => {
      preparar([])
      montar(`${RUTA}?q=zzz`)

      await screen.findByText(t('buy.noResults'))
      expect(screen.queryByText(t('panel.investor.empty'))).toBeNull()
    })

    it('abrir una card navega al proyecto', async () => {
      preparar()
      const router = montar()

      await userEvent.click(await screen.findByText('Torre A'))

      await waitFor(() => expect(router.state.location.pathname).toBe('/project/p1'))
    })
  })

  describe('favoritos', () => {
    it('un proyecto guardado ofrece sacarlo, y uno que no lo está, guardarlo', async () => {
      preparar([TORRE_A, TORRE_B], [TORRE_A])
      montar()

      await screen.findByText('Torre B')
      await waitFor(() =>
        expect(
          screen.getAllByRole('button', { name: t('investor.favorites.unsave') })
        ).toHaveLength(1)
      )
      expect(screen.getAllByRole('button', { name: t('investor.favorites.save') })).toHaveLength(1)
    })

    it('guardar llama a addFavorite y sacar llama a removeFavorite, cada uno con su id', async () => {
      preparar([TORRE_A, TORRE_B], [TORRE_A])
      const agregar = vi.spyOn(api, 'addFavorite').mockResolvedValue(undefined as never)
      const quitar = vi.spyOn(api, 'removeFavorite').mockResolvedValue(undefined as never)
      montar()

      await screen.findByText('Torre B')
      await userEvent.click(
        await screen.findByRole('button', { name: t('investor.favorites.save') })
      )
      expect(agregar).toHaveBeenCalledWith('p2')

      await userEvent.click(screen.getByRole('button', { name: t('investor.favorites.unsave') }))
      expect(quitar).toHaveBeenCalledWith('p1')
    })

    it('el corazón del listado no lleva el test ID de la pantalla de favoritos', async () => {
      preparar()
      montar()

      await screen.findByText('Torre A')
      expect(screen.queryByTestId('INV-FAV-TOGGLE-002')).toBeNull()
    })
  })

  describe('parámetros de la URL (validateSearch)', () => {
    const validar = (raw: Record<string, unknown>) =>
      (Route.options.validateSearch as (raw: Record<string, unknown>) => unknown)(raw)

    it('el parser descarta vista, estado y orden inválidos y `q`/`city` vacíos', () => {
      expect(validar({ view: 'otra', status: 'otro', sort: 'otro', q: '', city: '' })).toEqual({})
      expect(validar({ q: 5, city: 5 })).toEqual({})
    })

    it('el parser conserva los valores válidos', () => {
      expect(
        validar({ view: 'filter', status: 'planning', sort: 'delivery', q: 'x', city: 'Rosario' })
      ).toEqual({ view: 'filter', status: 'planning', sort: 'delivery', q: 'x', city: 'Rosario' })
      expect(validar({ view: 'map', status: 'in_progress', sort: 'recent' })).toEqual({
        view: 'map',
        status: 'in_progress',
        sort: 'recent'
      })
      expect(validar({ view: 'search', status: 'completed' })).toEqual({
        view: 'search',
        status: 'completed'
      })
    })

    // El router mezcla `{...searchCrudoDelPadre, ...validado}` y la raíz no valida:
    // el parser devuelve cada clave (`undefined` si es inválida) para pisar el crudo.
    it('un estado inválido en la URL no llega al pedido de proyectos', async () => {
      const listar = preparar()
      montar(`${RUTA}?status=otro&sort=otro`)

      await screen.findByText('Torre A')
      expect(listar).toHaveBeenCalledWith({})
    })

    it('los valores válidos llegan a la pantalla y al pedido de proyectos', async () => {
      const listar = preparar()
      const router = montar(`${RUTA}?q=torre&status=delayed&sort=name&city=Rosario`)

      await screen.findByText('Torre A')
      expect(busqueda(router)).toEqual({
        q: 'torre',
        status: 'delayed',
        sort: 'name',
        city: 'Rosario'
      })
      expect(listar).toHaveBeenCalledWith({
        status: 'delayed',
        q: 'torre',
        sort: 'name',
        city: 'Rosario'
      })
    })

    it.each(['planning', 'in_progress', 'completed'] as const)(
      'el estado `%s` es válido',
      async (estado) => {
        preparar()
        const router = montar(`${RUTA}?status=${estado}`)

        await screen.findByText('Torre A')
        expect(busqueda(router)).toEqual({ status: estado })
      }
    )

    it.each(['recent', 'delivery'] as const)('el orden `%s` es válido', async (orden) => {
      preparar()
      const router = montar(`${RUTA}?sort=${orden}`)

      await screen.findByText('Torre A')
      expect(busqueda(router)).toEqual({ sort: orden })
    })
  })

  describe('las tres vistas de la barra', () => {
    it('Buscar abre INV-BUY-SEARCH-001 y volver a tocarlo lo cierra', async () => {
      preparar()
      const router = montar()
      await screen.findByText('Torre A')
      expect(screen.queryByTestId('INV-BUY-SEARCH-001')).toBeNull()

      await userEvent.click(screen.getByRole('button', { name: t('buy.search') }))
      await screen.findByTestId('INV-BUY-SEARCH-001')
      expect(busqueda(router)).toEqual({ view: 'search' })

      await userEvent.click(screen.getByRole('button', { name: t('buy.search') }))
      await waitFor(() => expect(screen.queryByTestId('INV-BUY-SEARCH-001')).toBeNull())
    })

    it('Mapa abre INV-BUY-MAP-001 (sin el listado) y volver a tocarlo lo cierra', async () => {
      preparar()
      const router = montar()
      await screen.findByText('Torre A')

      await userEvent.click(screen.getByRole('button', { name: t('buy.map') }))
      await screen.findByTestId('INV-BUY-MAP-001')
      expect(busqueda(router)).toEqual({ view: 'map' })
      expect(screen.queryByTestId('INV-BUY-LIST-001')).toBeNull()

      await userEvent.click(screen.getByRole('button', { name: t('buy.map') }))
      await screen.findByTestId('INV-BUY-LIST-001')
      expect(screen.queryByTestId('INV-BUY-MAP-001')).toBeNull()
    })

    it('Filtros abre INV-BUY-FILTER-001 y Escape lo cierra', async () => {
      preparar()
      const router = montar()
      await screen.findByText('Torre A')

      await userEvent.click(screen.getByRole('button', { name: t('buy.filters') }))
      await screen.findByTestId('INV-BUY-FILTER-001')
      expect(busqueda(router)).toEqual({ view: 'filter' })

      await userEvent.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByTestId('INV-BUY-FILTER-001')).toBeNull())
      expect(busqueda(router)).toEqual({})
    })

    it('con el diálogo abierto la pill Filtros está seleccionada y tocarla lo cierra', async () => {
      preparar()
      const router = montar(`${RUTA}?view=filter`)

      await screen.findByTestId('INV-BUY-FILTER-001')
      expect(busqueda(router)).toEqual({ view: 'filter' })
      // El overlay del diálogo tapa la barra: se busca la pill aunque esté aria-hidden.
      const pill = screen
        .getAllByRole('button', { name: t('buy.filters'), hidden: true })
        .find((p) => p.getAttribute('aria-pressed') === 'true') as HTMLElement
      expect(pill).toBeTruthy()

      fireEvent.click(pill)

      await waitFor(() => expect(screen.queryByTestId('INV-BUY-FILTER-001')).toBeNull())
      expect(busqueda(router)).toEqual({})
    })
  })

  describe('el diálogo de filtros', () => {
    it('elegir un estado lo aplica y "Todos" lo quita', async () => {
      const listar = preparar()
      const router = montar(`${RUTA}?view=filter`)
      const dialogo = await screen.findByTestId('INV-BUY-FILTER-001')

      await userEvent.click(
        within(dialogo).getByRole('button', { name: t('project.status.in_progress') })
      )
      await waitFor(() =>
        expect(busqueda(router)).toEqual({ view: 'filter', status: 'in_progress' })
      )
      await waitFor(() => expect(listar).toHaveBeenCalledWith({ status: 'in_progress' }))

      await userEvent.click(within(dialogo).getByRole('button', { name: t('buy.filterStatusAll') }))
      await waitFor(() => expect(busqueda(router)).toEqual({ view: 'filter' }))
    })

    it('cambiar el orden lo aplica y sin orden elegido el selector marca "más recientes"', async () => {
      const listar = preparar()
      const router = montar(`${RUTA}?view=filter`)
      const selector = await screen.findByLabelText(t('buy.sortBy'))
      expect((selector as HTMLSelectElement).value).toBe('recent')

      await userEvent.selectOptions(selector, 'delivery')

      await waitFor(() => expect(busqueda(router)).toEqual({ view: 'filter', sort: 'delivery' }))
      await waitFor(() => expect(listar).toHaveBeenCalledWith({ sort: 'delivery' }))
    })

    it('"Limpiar filtros" deja solo la vista de filtros abierta', async () => {
      preparar()
      const router = montar(`${RUTA}?view=filter&status=planning&sort=name&q=torre`)
      await screen.findByTestId('INV-BUY-FILTER-001')

      await userEvent.click(screen.getByRole('button', { name: t('buy.clearFilters') }))

      await waitFor(() => expect(busqueda(router)).toEqual({ view: 'filter' }))
    })
  })

  describe('chips de filtro activo', () => {
    it('sin búsqueda ni estado no hay chips', async () => {
      preparar()
      montar()

      await screen.findByText('Torre A')
      expect(screen.queryByRole('button', { name: t('project.status.delayed') })).toBeNull()
    })

    it('el chip de la búsqueda la quita; el del estado quita el estado', async () => {
      preparar()
      const router = montar(`${RUTA}?q=torre&status=delayed`)

      await userEvent.click(await screen.findByRole('button', { name: 'torre' }))
      await waitFor(() => expect(busqueda(router)).toEqual({ status: 'delayed' }))

      await userEvent.click(screen.getByRole('button', { name: t('project.status.delayed') }))
      await waitFor(() => expect(busqueda(router)).toEqual({}))
    })

    it('solo con estado, hay un único chip', async () => {
      preparar()
      montar(`${RUTA}?status=completed`)

      await screen.findByRole('button', { name: t('project.status.completed') })
    })
  })

  describe('vista de búsqueda', () => {
    it('tipear sincroniza `q` en la URL tras la espera, y vaciarlo la quita', async () => {
      const listar = preparar()
      const router = montar(`${RUTA}?view=search`)
      const campo = await screen.findByLabelText(t('buy.searchLabel'))

      await userEvent.type(campo, 'Tor')
      await waitFor(() => expect(busqueda(router)).toEqual({ view: 'search', q: 'Tor' }))
      await waitFor(() => expect(listar).toHaveBeenCalledWith({ q: 'Tor' }))

      await userEvent.clear(campo)
      await waitFor(() => expect(busqueda(router)).toEqual({ view: 'search' }))
    })

    it('el campo arranca con la `q` de la URL y muestra hasta cinco sugerencias', async () => {
      const muchos = Array.from({ length: 7 }, (_, i) =>
        proyecto({ id: `x${i}`, name: `Desarrollo ${i}` })
      )
      preparar(muchos)
      montar(`${RUTA}?view=search&q=Des`)

      const campo = (await screen.findByLabelText(t('buy.searchLabel'))) as HTMLInputElement
      expect(campo.value).toBe('Des')
      const zona = screen.getByTestId('INV-BUY-SEARCH-001')
      await within(zona).findByText('Desarrollo 0')
      expect(within(zona).getAllByRole('button')).toHaveLength(5)
    })

    it('sin texto no hay sugerencias, y elegir una navega al proyecto', async () => {
      preparar()
      const router = montar(`${RUTA}?view=search`)
      const zona = await screen.findByTestId('INV-BUY-SEARCH-001')
      await screen.findByText('Torre A')
      expect(within(zona).queryByRole('button')).toBeNull()

      await userEvent.type(within(zona).getByLabelText(t('buy.searchLabel')), 'T')
      // El debounce del campo navega a `?q=T`: esperarlo antes de elegir evita que,
      // bajo carga (cobertura), pise la navegación al proyecto y la deje en /investor/buy.
      await waitFor(() => expect(busqueda(router)).toEqual({ view: 'search', q: 'T' }))
      await userEvent.click(await within(zona).findByRole('button', { name: 'Torre B' }))

      await waitFor(() => expect(router.state.location.pathname).toBe('/project/p2'))
    })
  })

  describe('vista de mapa (Leaflet falso)', () => {
    it('pide los proyectos con el `bbox` del viewport y solo dibuja pines de los que tienen coordenadas', async () => {
      const listar = preparar([
        proyecto({ id: 'p1', name: 'Torre A', latitude: -34.6, longitude: -58.4 }),
        proyecto({ id: 'p2', name: 'Torre B', latitude: null, longitude: null }),
        proyecto({ id: 'p3', name: 'Torre C', latitude: -34.61, longitude: null })
      ])
      montar(`${RUTA}?view=map`)

      await screen.findByTestId('INV-BUY-MAP-001')
      await waitFor(() => expect(listar).toHaveBeenCalledWith({ bbox: '-58.4,-34.7,-58.3,-34.5' }))
      await waitFor(() => expect(marker).toHaveBeenCalledTimes(1))
      expect(marker).toHaveBeenCalledWith([-34.6, -58.4])

      // Mover el mapa vuelve a emitir el mismo viewport: no rompe nada.
      dispararMoveend()
      expect(listar).toHaveBeenLastCalledWith({ bbox: '-58.4,-34.7,-58.3,-34.5' })
    })

    it('tocar un pin abre la card del proyecto y cerrarla la quita', async () => {
      preparar([proyecto({ id: 'p1', name: 'Torre A', latitude: -34.6, longitude: -58.4 })])
      montar(`${RUTA}?view=map`)
      const zona = await screen.findByTestId('INV-BUY-MAP-001')
      await waitFor(() => expect(marker).toHaveBeenCalledTimes(1))
      expect(within(zona).queryByRole('article')).toBeNull()

      const pin = (
        marker as unknown as { mock: { results: { value: { on: ReturnType<typeof vi.fn> } }[] } }
      ).mock.results[0]?.value
      const alTocar = pin?.on.mock.calls.find(([evento]) => evento === 'click')?.[1] as () => void
      alTocar()

      await within(zona).findByRole('article')
      expect(within(zona).getByText('Torre A')).toBeTruthy()

      await userEvent.click(within(zona).getByRole('button', { name: t('buy.close') }))
      await waitFor(() => expect(within(zona).queryByRole('article')).toBeNull())
    })

    it('el campo de zona sincroniza `q`', async () => {
      preparar()
      const router = montar(`${RUTA}?view=map`)

      await userEvent.type(await screen.findByLabelText(t('buy.searchZone')), 'Pal')

      await waitFor(() => expect(busqueda(router)).toEqual({ view: 'map', q: 'Pal' }))
    })
  })
})
