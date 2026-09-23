import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '#/api/port'
import type { Project } from '#/api/types'
import { dictionary } from '#/i18n/dictionary'
import { autenticarComo, INVESTOR_USER, montarRuta } from './-test-mount'
import { Route } from './investor.favorites'

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

describe('/investor/favorites', () => {
  afterEach(() => vi.restoreAllMocks())

  it('mientras carga muestra el estado de carga', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'listFavorites').mockReturnValue(new Promise(() => {}))
    montarRuta(Route, '/investor/favorites')

    const lista = await screen.findByTestId('INV-FAV-LIST-001')
    expect(within(lista).getByRole('status')).toBeTruthy()
  })

  it('sin favoritos muestra el vacío', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'listFavorites').mockResolvedValue([])
    montarRuta(Route, '/investor/favorites')

    await screen.findByText(t('investor.favorites.empty'))
  })

  it('INV-FAV-TOGGLE-002 va solo en el primer favorito, y quitar llama a removeFavorite con su id', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'listFavorites').mockResolvedValue([
      proyecto({ id: 'p1', name: 'Torre A' }),
      proyecto({ id: 'p2', name: 'Torre B', city: null, country: null })
    ])
    const quitar = vi.spyOn(api, 'removeFavorite').mockResolvedValue(undefined as never)
    montarRuta(Route, '/investor/favorites')

    await screen.findByText('Torre B')
    const botones = screen.getAllByRole('button', { name: t('investor.favorites.unsave') })
    expect(botones).toHaveLength(2)
    expect(screen.getAllByTestId('INV-FAV-TOGGLE-002')).toHaveLength(1)
    expect(botones[0]?.getAttribute('data-testid')).toBe('INV-FAV-TOGGLE-002')

    await userEvent.click(botones[1] as HTMLElement)
    expect(quitar).toHaveBeenCalledWith('p2')
  })

  it('abrir un favorito navega a su proyecto', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'listFavorites').mockResolvedValue([proyecto({ id: 'p1' })])
    const router = montarRuta(Route, '/investor/favorites', ['/project/$projectId'])

    await userEvent.click(await screen.findByText('Torre A'))

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/project/p1'))
  })
})
