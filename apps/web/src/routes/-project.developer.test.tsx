import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '#/api/port'
import { dictionary } from '#/i18n/dictionary'
import { autenticarComo, INVESTOR_USER, montarRuta } from './-test-mount'
import { Route } from './project.$projectId.developer'

const t = dictionary['es-AR']

type Perfil = Awaited<ReturnType<typeof api.getProjectDeveloper>>

const BIO_CORTA = 'Constructora familiar.'
const BIO_LARGA = `${'Construimos desde 1990. '.repeat(10)}Fin de la bio.`

const organizacion = (bio: string | null, foundedYear: number | null = 1990) => ({
  id: 'o1',
  name: 'Grupo Alpine',
  slug: 'alpine',
  bio,
  foundedYear
})

const obra = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  name: `Obra ${id}`,
  city: 'Rosario',
  status: 'completed',
  progress: 100,
  priceFromMinorUnits: 19_500_000,
  priceCurrency: 'USD',
  sizeMinM2: 60,
  sizeMaxM2: 150,
  ...over
})

/** Perfil completo: bio, años, dos listados con datos. */
const perfil = (over: Record<string, unknown> = {}) =>
  ({
    organization: organizacion(BIO_CORTA),
    stats: { projectsDelivered: 4, unitsSold: 37, investors: 21, yearsInBusiness: 35 },
    previousProjects: [obra('a')],
    activeProjects: [obra('b', { status: 'in_progress', progress: 40 })],
    ...over
  }) as unknown as Perfil

const montar = () =>
  montarRuta(
    Route,
    '/project/$projectId/developer',
    ['/project/$projectId'],
    '/project/p1/developer'
  )

function mockear(datos: Perfil) {
  autenticarComo(INVESTOR_USER)
  vi.spyOn(api, 'getProjectDeveloper').mockResolvedValue(datos)
}

describe('/project/:projectId/developer (investor)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('mientras carga: spinner y título genérico, sin pantalla de error', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'getProjectDeveloper').mockReturnValue(new Promise(() => {}))
    montar()

    await screen.findByRole('status')
    expect(screen.getByRole('heading', { name: t['investor.developer.title'] })).toBeTruthy()
    expect(screen.queryByText(t['investor.developer.notFound'])).toBeNull()
  })

  it('INV-DEVELOPER-PROFILE-001: un error de la API muestra que la obra no tiene desarrollador', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'getProjectDeveloper').mockRejectedValue(new ApiError(404, 'no'))
    montar()

    const p = await screen.findByText(t['investor.developer.notFound'])
    expect(p.getAttribute('data-testid')).toBe('INV-DEVELOPER-PROFILE-001')
  })

  it('INV-DEVELOPER-PROFILE-001: sin organización también es la pantalla de error', async () => {
    mockear(perfil({ organization: null }))
    montar()

    const p = await screen.findByText(t['investor.developer.notFound'])
    expect(p.getAttribute('data-testid')).toBe('INV-DEVELOPER-PROFILE-001')
  })

  it('perfil completo: nombre, bio corta sin control, las cuatro métricas y las dos listas', async () => {
    mockear(perfil())
    montar()

    await screen.findByRole('heading', { name: 'Grupo Alpine' })
    const perfilEl = screen.getByTestId('INV-DEVELOPER-PROFILE-001')
    expect(perfilEl.textContent).toContain(BIO_CORTA)
    expect(screen.queryByRole('button', { name: t['investor.developer.seeMore'] })).toBeNull()
    expect(perfilEl.textContent).toContain(t['investor.developer.yearsInBusiness'])
    for (const n of ['4', '37', '21', '35']) expect(perfilEl.textContent).toContain(n)

    const previas = screen.getByTestId('INV-DEVELOPER-PREVIOUS-002')
    expect(previas.textContent).toContain(t['project.status.completed'])
    const activas = screen.getByTestId('INV-DEVELOPER-ACTIVE-003')
    expect(activas.textContent).toContain(t['project.status.in_progress'])
  })

  it('una obra muestra su precio "desde" con la moneda y el rango de metros', async () => {
    mockear(perfil())
    montar()

    const previas = await screen.findByTestId('INV-DEVELOPER-PREVIOUS-002')
    // `formatCurrency` recibe unidades mínimas: 19.500.000 centavos son US$ 195.000.
    expect(previas.textContent).toMatch(/195\.000/)
    expect(previas.textContent).toContain('60 m² – 150 m²')
  })

  it('una obra sin precio ni metros no dibuja esas líneas', async () => {
    mockear(
      perfil({
        previousProjects: [
          obra('a', {
            priceFromMinorUnits: null,
            priceCurrency: null,
            sizeMinM2: null,
            sizeMaxM2: null
          })
        ]
      })
    )
    montar()

    const previas = await screen.findByTestId('INV-DEVELOPER-PREVIOUS-002')
    await within(previas).findByText('Obra a')
    expect(previas.textContent).not.toMatch(/195\.000/)
    expect(previas.textContent).not.toContain('m²')
  })

  it('una obra con precio pero sin moneda tampoco muestra el "desde"', async () => {
    mockear(perfil({ previousProjects: [obra('a', { priceCurrency: null })] }))
    montar()

    const previas = await screen.findByTestId('INV-DEVELOPER-PREVIOUS-002')
    await within(previas).findByText('Obra a')
    expect(previas.textContent).not.toMatch(/195\.000/)
  })

  it('con solo uno de los dos extremos de metros, no hay rango', async () => {
    mockear(perfil({ previousProjects: [obra('a', { sizeMaxM2: null })] }))
    montar()

    const previas = await screen.findByTestId('INV-DEVELOPER-PREVIOUS-002')
    await within(previas).findByText('Rosario')
    expect(previas.textContent).not.toContain('m²')
  })

  it('sin años en el rubro no se dibuja ese tile, y sin bio no hay bloque de bio', async () => {
    mockear(
      perfil({
        organization: organizacion(null, null),
        stats: { projectsDelivered: 0, unitsSold: 0, investors: 0, yearsInBusiness: null }
      })
    )
    montar()

    await screen.findByRole('heading', { name: 'Grupo Alpine' })
    const perfilEl = screen.getByTestId('INV-DEVELOPER-PROFILE-001')
    expect(perfilEl.textContent).not.toContain(t['investor.developer.yearsInBusiness'])
    expect(perfilEl.textContent).toContain(t['investor.developer.unitsSold'])
    expect(perfilEl.textContent).not.toContain(BIO_CORTA)
  })

  it('listas vacías: cada una con su aviso', async () => {
    mockear(perfil({ previousProjects: [], activeProjects: [] }))
    montar()

    await screen.findByText(t['investor.developer.emptyPrevious'])
    expect(screen.getByText(t['investor.developer.emptyActive'])).toBeTruthy()
  })

  it('una bio larga arranca colapsada, "Ver más" la expande y "Ver menos" la vuelve a colapsar', async () => {
    mockear(perfil({ organization: organizacion(BIO_LARGA) }))
    montar()

    // `Bio` se declara dentro de la pantalla: cada render la remonta, así que
    // el párrafo se vuelve a buscar en vez de guardar la referencia.
    expect((await screen.findByText(BIO_LARGA)).className).toContain('line-clamp-3')

    await userEvent.click(screen.getByRole('button', { name: t['investor.developer.seeMore'] }))
    expect(screen.getByText(BIO_LARGA).className).not.toContain('line-clamp-3')

    await userEvent.click(screen.getByRole('button', { name: t['investor.developer.seeLess'] }))
    expect(screen.getByText(BIO_LARGA).className).toContain('line-clamp-3')
  })

  it('abrir una obra lleva a su detalle', async () => {
    mockear(perfil())
    montar()

    const previas = await screen.findByTestId('INV-DEVELOPER-PREVIOUS-002')
    await userEvent.click(within(previas).getByRole('button'))

    await screen.findByText('/project/$projectId')
  })

  it('volver lleva a la obra desde el perfil', async () => {
    mockear(perfil())
    montar()

    await userEvent.click(await screen.findByRole('button', { name: t['investor.developer.back'] }))

    await screen.findByText('/project/$projectId')
  })

  it('volver también funciona desde la pantalla de error', async () => {
    mockear(perfil({ organization: null }))
    montar()

    await userEvent.click(await screen.findByRole('button', { name: t['investor.developer.back'] }))

    await screen.findByText('/project/$projectId')
  })
})
