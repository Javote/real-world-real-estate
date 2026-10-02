import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '#/api/port'
import type { ProjectCreated } from '#/api/types'
import { esAR, type TranslationKey } from '#/i18n/dictionary'
import * as L from '#/test/leaflet-falso'
import { autenticarComo, DEVELOPER_USER, montarRuta } from './-test-mount'
import { Route } from './developer.project.new'

vi.mock('leaflet', () => import('#/test/leaflet-falso'))
vi.mock('leaflet/dist/leaflet.css', () => ({}))

const t = (clave: TranslationKey) => esAR[clave]

const creado = { id: 'p-nuevo' } as ProjectCreated
const LIBERTADOR = { latitude: -34.547, longitude: -58.46, label: 'Av. del Libertador 7200, CABA' }

const montar = () =>
  montarRuta(Route, '/developer/project/new', [
    '/developer/project/$projectId',
    '/developer/projects'
  ])

const boton = () => screen.getByRole('button', { name: t('developer.newProject.submit') })
const nombre = () => screen.findByLabelText(t('developer.newProject.name'))
const direccion = () => screen.getByLabelText(t('developer.newProject.location'))

async function marcarLote(lat = -34.5470001234, lng = -58.4600009876) {
  await waitFor(() => expect(L.map).toHaveBeenCalled())
  act(() => L.dispararClick(lat, lng))
}

const render = () =>
  new File(
    [Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'fachada'],
    'render.png',
    { type: 'image/png' }
  )
const inputDePortada = () =>
  document.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement
const elegirPortada = (...archivos: File[]) =>
  fireEvent.change(inputDePortada(), { target: { files: archivos } })

const conMargen = { timeout: 3000 }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0)
    return 0
  })
})

describe('/developer/project/new', () => {
  afterEach(() => vi.restoreAllMocks())

  it('sin nombre no se puede crear, y mostrar el formulario no llama a la API', async () => {
    autenticarComo(DEVELOPER_USER)
    const crear = vi.spyOn(api, 'createProject').mockResolvedValue(creado)
    const buscar = vi.spyOn(api, 'geocodeAddress')
    montar()

    await screen.findByTestId('DEV-PROJECT-CREATE-001')
    expect((boton() as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(t('developer.newProject.mapHint'))).toBeTruthy()
    expect(crear).not.toHaveBeenCalled()
    expect(buscar).not.toHaveBeenCalled()
  })

  it('un nombre que no deja nada al normalizarlo tampoco alcanza, y enviar el formulario a la fuerza no crea', async () => {
    autenticarComo(DEVELOPER_USER)
    const crear = vi.spyOn(api, 'createProject').mockResolvedValue(creado)
    montar()

    const formulario = await screen.findByTestId('DEV-PROJECT-CREATE-001')
    await userEvent.type(await nombre(), '  !!!  ')
    await marcarLote()

    expect((boton() as HTMLButtonElement).disabled).toBe(true)
    fireEvent.submit(formulario)
    expect(crear).not.toHaveBeenCalled()
  })

  it('con nombre pero sin lote marcado no se puede crear (D-097)', async () => {
    autenticarComo(DEVELOPER_USER)
    const crear = vi.spyOn(api, 'createProject').mockResolvedValue(creado)
    montar()

    await userEvent.type(await nombre(), 'Torre X')
    expect((boton() as HTMLButtonElement).disabled).toBe(true)
    fireEvent.submit(screen.getByTestId('DEV-PROJECT-CREATE-001'))
    expect(crear).not.toHaveBeenCalled()
  })

  it('con nombre y el lote marcado en el mapa crea con el punto redondeado, sin dirección, unidades ni entrega', async () => {
    autenticarComo(DEVELOPER_USER)
    const crear = vi.spyOn(api, 'createProject').mockResolvedValue(creado)
    const buscar = vi.spyOn(api, 'geocodeAddress')
    montar()

    await userEvent.type(await nombre(), 'Torres del Palermo')
    await userEvent.type(direccion(), '   ')
    await marcarLote()
    expect(await screen.findByText('Lote marcado: -34,54700, -58,46000')).toBeTruthy()
    await userEvent.click(boton())

    await vi.waitFor(() =>
      expect(crear).toHaveBeenCalledWith({
        name: 'Torres del Palermo',
        slug: 'torres-del-palermo',
        latitude: -34.547,
        longitude: -58.460001
      })
    )
    expect(buscar).not.toHaveBeenCalled()
  })

  it('escribir la dirección la busca, pone el pin ahí, y crea con dirección, unidades y entrega', async () => {
    autenticarComo(DEVELOPER_USER)
    const crear = vi.spyOn(api, 'createProject').mockResolvedValue(creado)
    const buscar = vi.spyOn(api, 'geocodeAddress').mockResolvedValue({ match: LIBERTADOR })
    montar()

    await userEvent.type(await nombre(), ' Torre Ñ ')
    await userEvent.type(direccion(), ' Av. del Libertador 7200 ')
    await screen.findByText('Lote marcado: -34,54700, -58,46000', {}, conMargen)
    expect(buscar).toHaveBeenCalledTimes(1)
    expect(buscar).toHaveBeenCalledWith('Av. del Libertador 7200')
    await waitFor(() =>
      expect(L.marker).toHaveBeenCalledWith([-34.547, -58.46], { draggable: true })
    )

    await userEvent.click(screen.getByRole('button', { name: t('developer.newProject.stepUp') }))
    await userEvent.click(screen.getByRole('button', { name: t('developer.newProject.stepUp') }))
    fireEvent.change(screen.getByLabelText(t('developer.newProject.delivery')), {
      target: { value: '2027-12-01' }
    })
    await userEvent.click(boton())

    await vi.waitFor(() =>
      expect(crear).toHaveBeenCalledWith({
        name: 'Torre Ñ',
        slug: 'torre-n',
        latitude: -34.547,
        longitude: -58.46,
        address: 'Av. del Libertador 7200',
        totalUnits: 2,
        estimatedDelivery: '2027-12-01'
      })
    )
  })

  it('una dirección corta no se busca', async () => {
    autenticarComo(DEVELOPER_USER)
    const buscar = vi.spyOn(api, 'geocodeAddress')
    montar()

    await userEvent.type(await nombre(), 'Torre X')
    await userEvent.type(direccion(), 'Av 1')
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1100))
    })
    expect(buscar).not.toHaveBeenCalled()
  })

  it('mientras busca lo dice; si no la encuentra pide marcarla en el mapa', async () => {
    autenticarComo(DEVELOPER_USER)
    let responder: (r: { match: null }) => void = () => {}
    vi.spyOn(api, 'geocodeAddress').mockReturnValue(
      new Promise((r) => {
        responder = r
      })
    )
    montar()

    await userEvent.type(await nombre(), 'Torre X')
    await userEvent.type(direccion(), 'Calle Inventada 99999')
    await screen.findByText(t('developer.newProject.mapSearching'), {}, conMargen)
    act(() => responder({ match: null }))
    await screen.findByText(t('developer.newProject.mapNotFound'))
    expect((boton() as HTMLButtonElement).disabled).toBe(true)
  })

  it('si la búsqueda falla pide marcarla en el mapa, y marcarla habilita crear', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'geocodeAddress').mockRejectedValue(new ApiError(503, 'GEOCODER_UNAVAILABLE'))
    montar()

    await userEvent.type(await nombre(), 'Torre X')
    await userEvent.type(direccion(), 'Florida 100, CABA')
    await screen.findByText(t('developer.newProject.mapUnavailable'), {}, conMargen)
    await marcarLote()
    await screen.findByText('Lote marcado: -34,54700, -58,46000')
    expect((boton() as HTMLButtonElement).disabled).toBe(false)
  })

  it('una respuesta que llega después de cambiar la dirección se descarta, acierte o falle', async () => {
    autenticarComo(DEVELOPER_USER)
    type Respuesta = Awaited<ReturnType<typeof api.geocodeAddress>>
    const pendientes: Array<{ ok: (r: Respuesta) => void; mal: (e: unknown) => void }> = []
    vi.spyOn(api, 'geocodeAddress').mockImplementation(
      () =>
        new Promise<Respuesta>((ok, mal) => {
          pendientes.push({ ok, mal })
        })
    )
    montar()

    await userEvent.type(await nombre(), 'Torre X')
    await userEvent.type(direccion(), 'Florida 100')
    await waitFor(() => expect(pendientes).toHaveLength(1), conMargen)
    await userEvent.type(direccion(), '0')
    await waitFor(() => expect(pendientes).toHaveLength(2), conMargen)
    await userEvent.type(direccion(), '0')
    await waitFor(() => expect(pendientes).toHaveLength(3), conMargen)

    await act(async () => {
      pendientes[0]?.ok({ match: LIBERTADOR })
      pendientes[1]?.mal(new Error('tarde'))
    })
    expect(screen.getByText(t('developer.newProject.mapSearching'))).toBeTruthy()
    expect(screen.queryByText(t('developer.newProject.mapUnavailable'))).toBeNull()

    await act(async () => pendientes[2]?.ok({ match: null }))
    await screen.findByText(t('developer.newProject.mapNotFound'))
  })

  it('al crear con éxito navega al proyecto nuevo', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'createProject').mockResolvedValue(creado)
    const router = montar()

    await userEvent.type(await nombre(), 'Torre X')
    await marcarLote()
    await userEvent.click(boton())

    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe('/developer/project/p-nuevo')
    )
  })

  it('mientras se crea, el botón queda deshabilitado y no se puede enviar dos veces', async () => {
    autenticarComo(DEVELOPER_USER)
    const crear = vi.spyOn(api, 'createProject').mockReturnValue(new Promise(() => {}))
    montar()

    await userEvent.type(await nombre(), 'Torre X')
    await marcarLote()
    await userEvent.click(boton())

    await vi.waitFor(() => expect((boton() as HTMLButtonElement).disabled).toBe(true))
    fireEvent.submit(screen.getByTestId('DEV-PROJECT-CREATE-001'))
    expect(crear).toHaveBeenCalledTimes(1)
  })

  it('si la API rechaza la creación muestra el error y deja reintentar', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'createProject').mockRejectedValue(new ApiError(400, 'invalid'))
    montar()

    await userEvent.type(await nombre(), 'Torre X')
    await marcarLote()
    expect(screen.queryByText(t('developer.newProject.error'))).toBeNull()
    await userEvent.click(boton())

    await screen.findByText(t('developer.newProject.error'))
    expect((boton() as HTMLButtonElement).disabled).toBe(false)
  })

  it('la portada (D-099) es opcional, una sola imagen, JPG o PNG: el selector no ofrece PDF ni varios', async () => {
    autenticarComo(DEVELOPER_USER)
    const subir = vi.spyOn(api, 'uploadProjectCover')
    vi.spyOn(api, 'createProject').mockResolvedValue(creado)
    const router = montar()

    await screen.findByText(t('developer.newProject.cover'))
    expect(inputDePortada().accept).toBe('image/jpeg,image/png')
    expect(inputDePortada().multiple).toBe(false)

    await userEvent.type(await nombre(), 'Torre X')
    await marcarLote()
    await userEvent.click(boton())
    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe('/developer/project/p-nuevo')
    )
    expect(subir).not.toHaveBeenCalled()
  })

  it('un PDF no entra como portada: se avisa y no queda elegido', async () => {
    autenticarComo(DEVELOPER_USER)
    montar()

    await screen.findByText(t('developer.newProject.cover'))
    elegirPortada(
      new File([Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d]), 'x'], 'plano.pdf', {
        type: 'application/pdf'
      })
    )

    await screen.findByText('plano.pdf no es un JPG o PNG válido.')
  })

  it('con portada crea el proyecto, le sube la imagen a su id y recién ahí navega', async () => {
    autenticarComo(DEVELOPER_USER)
    const crear = vi.spyOn(api, 'createProject').mockResolvedValue(creado)
    const subir = vi
      .spyOn(api, 'uploadProjectCover')
      .mockResolvedValue({ coverUpdatedAt: '2026-09-30T12:00:00.000Z' })
    const router = montar()

    await userEvent.type(await nombre(), 'Torre X')
    await marcarLote()
    const imagen = render()
    elegirPortada(imagen)
    await screen.findByText('render.png')
    await userEvent.click(boton())

    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe('/developer/project/p-nuevo')
    )
    expect(crear).toHaveBeenCalledTimes(1)
    expect(subir).toHaveBeenCalledWith('p-nuevo', imagen)
  })

  it('si la portada falla, el proyecto ya existe: lo dice, y reintentar sube solo la portada', async () => {
    autenticarComo(DEVELOPER_USER)
    const crear = vi.spyOn(api, 'createProject').mockResolvedValue(creado)
    const subir = vi
      .spyOn(api, 'uploadProjectCover')
      .mockRejectedValueOnce(new ApiError(500, 'R2'))
      .mockResolvedValueOnce({ coverUpdatedAt: '2026-09-30T12:00:00.000Z' })
    const router = montar()

    await userEvent.type(await nombre(), 'Torre X')
    await marcarLote()
    elegirPortada(render())
    await screen.findByText('render.png')
    await userEvent.click(boton())

    await screen.findByText(t('developer.newProject.coverError'))
    expect(screen.queryByText(t('developer.newProject.error'))).toBeNull()
    expect(router.state.location.pathname).toBe('/developer/project/new')

    await userEvent.click(boton())

    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe('/developer/project/p-nuevo')
    )
    expect(crear).toHaveBeenCalledTimes(1)
    expect(subir).toHaveBeenCalledTimes(2)
  })

  it('lista las diez etapas de la plantilla', async () => {
    autenticarComo(DEVELOPER_USER)
    montar()

    await screen.findByTestId('DEV-PROJECT-CREATE-001')
    expect(screen.getByText(`1. ${t('developer.newProject.stageTemplate.stage1')}`)).toBeTruthy()
    expect(screen.getByText(`10. ${t('developer.newProject.stageTemplate.stage10')}`)).toBeTruthy()
  })

  it('la plantilla es una sola: el selector no cambia de valor aunque se intente', async () => {
    autenticarComo(DEVELOPER_USER)
    montar()

    const selector = (await screen.findByLabelText(
      t('developer.newProject.stageTemplate.label')
    )) as HTMLSelectElement
    fireEvent.change(selector, { target: { value: 'otra' } })

    expect(selector.value).toBe('standard')
  })

  it('la flecha de volver lleva a la lista de proyectos', async () => {
    autenticarComo(DEVELOPER_USER)
    const router = montar()

    await userEvent.click(await screen.findByRole('button', { name: t('nav.back') }))

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/developer/projects'))
  })
})
