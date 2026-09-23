import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '#/api/port'
import { dictionary } from '#/i18n/dictionary'
import { autenticarComo, DEVELOPER_USER, montarRuta } from './-test-mount'
import { Route } from './developer.project.$projectId.units'

const t = dictionary['es-AR']

type Unidad = Awaited<ReturnType<typeof api.listProjectUnits>>[number]

const unidad = (id: string, over: Partial<Record<keyof Unidad, unknown>> = {}): Unidad =>
  ({
    id,
    unitReference: `Unidad ${id}`,
    status: 'available',
    floor: null,
    sizeM2: null,
    priceMinorUnits: null,
    currency: null,
    investorId: null,
    ...over
  }) as unknown as Unidad

const UNIDADES = [
  // completa: piso, superficie, precio e investor
  unidad('a', {
    status: 'sold',
    floor: 3,
    sizeM2: 65,
    priceMinorUnits: 12_000_000,
    currency: 'USD',
    investorId: 'i1'
  }),
  // solo piso
  unidad('b', { status: 'reserved', floor: 5, investorId: 'i2' }),
  // solo superficie, precio sin moneda (no se muestra)
  unidad('c', { sizeM2: 40, priceMinorUnits: 5_000_000 }),
  // mínima
  unidad('d')
]

const montar = () =>
  montarRuta(
    Route.options.component as () => React.ReactElement,
    '/developer/project/$projectId/units',
    ['/developer/project/$projectId'],
    '/developer/project/p1/units'
  )

function preparar(unidades: Unidad[] | 'cargando' = UNIDADES) {
  autenticarComo(DEVELOPER_USER)
  vi.spyOn(api, 'getDeveloperProject').mockResolvedValue({
    name: 'Torre Alpine'
  } as unknown as Awaited<ReturnType<typeof api.getDeveloperProject>>)
  vi.spyOn(api, 'listProjectUnits').mockImplementation(() =>
    unidades === 'cargando' ? new Promise(() => {}) : Promise.resolve(unidades)
  )
}

const referencia = () => screen.getByLabelText(new RegExp(t['developer.projectUnits.reference']))
const piso = () => screen.getByLabelText(t['developer.projectUnits.floor']) as HTMLInputElement
const superficie = () => screen.getByLabelText(t['developer.projectUnits.size']) as HTMLInputElement
const guardar = (nombre: string) =>
  screen.getByRole('button', { name: nombre }) as HTMLButtonElement
const escribir = (el: HTMLElement, valor: string) =>
  fireEvent.change(el, { target: { value: valor } })

async function abrirEdicion(id: string) {
  const lista = await screen.findByTestId('DEV-UNITS-LIST-001')
  fireEvent.click(await within(lista).findByRole('button', { name: new RegExp(`Unidad ${id}`) }))
  await screen.findByText(t['developer.projectUnits.editTitle'].replace('{unit}', `Unidad ${id}`))
}

describe('/developer/project/$projectId/units', () => {
  afterEach(() => vi.restoreAllMocks())

  it('cargando: sin lista ni vacío definitivo, contadores en cero y formulario de alta', async () => {
    preparar('cargando')
    montar()

    const lista = await screen.findByTestId('DEV-UNITS-LIST-001')
    expect(within(lista).queryByRole('button')).toBeNull()
    expect(screen.queryByText(t['developer.units.empty'])).toBeNull()
    expect(screen.getByTestId('DEV-UNIT-CREATE-002')).toBeTruthy()
    expect(screen.getByText(t['developer.projectUnits.addTitle'])).toBeTruthy()
  })

  it('sin unidades muestra el vacío', async () => {
    preparar([])
    montar()

    await screen.findByText(t['developer.units.empty'])
  })

  it('DEV-UNITS-LIST-001: lista las unidades con su detalle, asignación y precio (solo si hay moneda)', async () => {
    preparar()
    montar()

    const lista = await screen.findByTestId('DEV-UNITS-LIST-001')
    await waitFor(() => expect(lista.textContent).toContain('Unidad a'))
    expect(lista.textContent).toContain(
      `${t['developer.projectUnits.floorValue'].replace('{floor}', '3')} · ${t['developer.projectUnits.sizeValue'].replace('{size}', '65')}`
    )
    expect(lista.textContent).toContain('120.000')
    expect(lista.textContent).not.toContain('50.000')
    expect(lista.textContent).toContain(t['developer.units.assigned'])
    expect(lista.textContent).toContain(t['developer.units.unassigned'])
    expect(lista.textContent).toContain(t['unitStatus.sold'])
    expect(lista.textContent).toContain(t['unitStatus.reserved'])
    expect(lista.textContent).toContain(t['unitStatus.available'])
  })

  it('el título muestra el nombre del proyecto y el botón de volver lleva al detalle', async () => {
    preparar([])
    const router = montar()

    await screen.findByText('Torre Alpine')
    fireEvent.click(screen.getByRole('button', { name: t['nav.back'] }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/developer/project/p1'))
  })

  describe('alta', () => {
    it('sin referencia el botón está deshabilitado; con solo espacios también', async () => {
      preparar([])
      montar()
      await screen.findByText(t['developer.units.empty'])

      expect(guardar(t['developer.projectUnits.add']).disabled).toBe(true)
      escribir(referencia(), '   ')
      expect(guardar(t['developer.projectUnits.add']).disabled).toBe(true)
    })

    it('enviar el formulario sin referencia no llama a la API', async () => {
      preparar([])
      const crear = vi.spyOn(api, 'createProjectUnit')
      montar()
      await screen.findByText(t['developer.units.empty'])

      fireEvent.submit(screen.getByTestId('DEV-UNIT-CREATE-002'))

      expect(crear).not.toHaveBeenCalled()
    })

    it('solo con referencia: manda solo la referencia y limpia el formulario', async () => {
      preparar([])
      const crear = vi
        .spyOn(api, 'createProjectUnit')
        .mockResolvedValue({} as Awaited<ReturnType<typeof api.createProjectUnit>>)
      montar()
      await screen.findByText(t['developer.units.empty'])

      escribir(referencia(), '  5A ')
      fireEvent.click(guardar(t['developer.projectUnits.add']))

      await waitFor(() => expect(crear).toHaveBeenCalledWith('p1', { unitReference: '5A' }))
      await waitFor(() => expect((referencia() as HTMLInputElement).value).toBe(''))
    })

    it('con piso y superficie: los manda junto con la referencia', async () => {
      preparar([])
      const crear = vi
        .spyOn(api, 'createProjectUnit')
        .mockResolvedValue({} as Awaited<ReturnType<typeof api.createProjectUnit>>)
      montar()
      await screen.findByText(t['developer.units.empty'])

      escribir(referencia(), '5A')
      escribir(piso(), '5')
      escribir(superficie(), '72')
      fireEvent.click(guardar(t['developer.projectUnits.add']))

      await waitFor(() =>
        expect(crear).toHaveBeenCalledWith('p1', { unitReference: '5A', floor: 5, sizeM2: 72 })
      )
    })

    it('mientras se crea, el botón queda deshabilitado', async () => {
      preparar([])
      const crear = vi.spyOn(api, 'createProjectUnit').mockReturnValue(new Promise(() => {}))
      montar()
      await screen.findByText(t['developer.units.empty'])

      escribir(referencia(), '5A')
      fireEvent.click(guardar(t['developer.projectUnits.add']))

      await waitFor(() => expect(crear).toHaveBeenCalledTimes(1))
      await waitFor(() => expect(guardar(t['developer.projectUnits.add']).disabled).toBe(true))
    })

    it('si crear falla muestra el error y conserva lo tipeado', async () => {
      preparar([])
      vi.spyOn(api, 'createProjectUnit').mockRejectedValue(new ApiError(409, 'duplicada'))
      montar()
      await screen.findByText(t['developer.units.empty'])

      escribir(referencia(), '5A')
      fireEvent.click(guardar(t['developer.projectUnits.add']))

      await screen.findByText(t['developer.projectUnits.error'])
      expect((referencia() as HTMLInputElement).value).toBe('5A')
    })
  })

  describe('edición', () => {
    it('tocar una unidad cambia el formulario a modo edición: sin referencia y con sus valores', async () => {
      preparar()
      montar()

      await abrirEdicion('a')

      expect(screen.getByTestId('DEV-UNIT-UPDATE-003')).toBeTruthy()
      expect(screen.queryByLabelText(new RegExp(t['developer.projectUnits.reference']))).toBeNull()
      expect(piso().value).toBe('3')
      expect(superficie().value).toBe('65')
      expect(guardar(t['developer.projectUnits.save'])).toBeTruthy()
    })

    it('cancelar vuelve al modo alta y vacía los campos', async () => {
      preparar()
      montar()
      await abrirEdicion('a')

      fireEvent.click(screen.getByRole('button', { name: t['developer.projectUnits.cancel'] }))

      await screen.findByText(t['developer.projectUnits.addTitle'])
      expect(screen.getByTestId('DEV-UNIT-CREATE-002')).toBeTruthy()
      expect(piso().value).toBe('')
      expect(superficie().value).toBe('')
    })

    it('una unidad sin piso ni superficie no se puede guardar hasta cargar alguno', async () => {
      preparar()
      montar()
      await abrirEdicion('d')

      expect(guardar(t['developer.projectUnits.save']).disabled).toBe(true)
      escribir(superficie(), '30')
      await waitFor(() => expect(guardar(t['developer.projectUnits.save']).disabled).toBe(false))
    })

    it('enviar el formulario en edición sin datos no llama a la API', async () => {
      preparar()
      const actualizar = vi.spyOn(api, 'updateUnit')
      montar()
      await abrirEdicion('d')

      fireEvent.submit(screen.getByTestId('DEV-UNIT-UPDATE-003'))

      expect(actualizar).not.toHaveBeenCalled()
    })

    it('editar solo el piso manda solo el piso', async () => {
      preparar()
      const actualizar = vi
        .spyOn(api, 'updateUnit')
        .mockResolvedValue({} as Awaited<ReturnType<typeof api.updateUnit>>)
      montar()
      await abrirEdicion('b')

      escribir(piso(), '6')
      fireEvent.click(guardar(t['developer.projectUnits.save']))

      await waitFor(() => expect(actualizar).toHaveBeenCalledWith('b', { floor: 6 }))
      await screen.findByText(t['developer.projectUnits.addTitle'])
    })

    it('editar solo la superficie manda solo la superficie', async () => {
      preparar()
      const actualizar = vi
        .spyOn(api, 'updateUnit')
        .mockResolvedValue({} as Awaited<ReturnType<typeof api.updateUnit>>)
      montar()
      await abrirEdicion('c')

      escribir(superficie(), '45')
      fireEvent.click(guardar(t['developer.projectUnits.save']))

      await waitFor(() => expect(actualizar).toHaveBeenCalledWith('c', { sizeM2: 45 }))
    })

    it('editar los dos manda piso y superficie', async () => {
      preparar()
      const actualizar = vi
        .spyOn(api, 'updateUnit')
        .mockResolvedValue({} as Awaited<ReturnType<typeof api.updateUnit>>)
      montar()
      await abrirEdicion('a')

      escribir(piso(), '4')
      fireEvent.click(guardar(t['developer.projectUnits.save']))

      await waitFor(() => expect(actualizar).toHaveBeenCalledWith('a', { floor: 4, sizeM2: 65 }))
    })

    it('mientras se guarda, el botón queda deshabilitado', async () => {
      preparar()
      const actualizar = vi.spyOn(api, 'updateUnit').mockReturnValue(new Promise(() => {}))
      montar()
      await abrirEdicion('a')

      fireEvent.click(guardar(t['developer.projectUnits.save']))

      await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1))
      await waitFor(() => expect(guardar(t['developer.projectUnits.save']).disabled).toBe(true))
    })

    it('si guardar falla muestra el error y sigue en modo edición', async () => {
      preparar()
      vi.spyOn(api, 'updateUnit').mockRejectedValue(new ApiError(500, 'boom'))
      montar()
      await abrirEdicion('a')

      fireEvent.click(guardar(t['developer.projectUnits.save']))

      await screen.findByText(t['developer.projectUnits.error'])
      expect(screen.getByTestId('DEV-UNIT-UPDATE-003')).toBeTruthy()
    })
  })
})
