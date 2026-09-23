import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '#/api/port'
import { dictionary } from '#/i18n/dictionary'
import { autenticarComo, DEVELOPER_USER, montarRuta } from './-test-mount'
import { Route } from './developer.project.$projectId.invite'

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
  unidad('u1', { priceMinorUnits: 28_500_000, currency: 'EUR' }),
  unidad('u2'),
  unidad('u3', { status: 'sold' }),
  unidad('u4', { priceMinorUnits: 0 })
]

const montar = () =>
  montarRuta(
    Route.options.component as () => React.ReactElement,
    '/developer/project/$projectId/invite',
    ['/developer/project/$projectId', '/developer/project/$projectId/units'],
    '/developer/project/p1/invite'
  )

function preparar(unidades: Unidad[] = UNIDADES) {
  autenticarComo(DEVELOPER_USER)
  vi.spyOn(api, 'listProjectUnits').mockResolvedValue(unidades)
  return vi.spyOn(api, 'createInvitation')
}

/** Espera a que las unidades lleguen al select y devuelve los controles. */
async function controles() {
  await screen.findByRole('option', { name: 'Unidad u1' })
  return {
    email: screen.getByLabelText(t['developer.invite.email']) as HTMLInputElement,
    unidad: screen.getByLabelText(t['developer.invite.unit']) as HTMLSelectElement,
    monto: screen.getByRole('spinbutton') as HTMLInputElement,
    enviar: screen.getByRole('button', { name: t['developer.invite.submit'] }) as HTMLButtonElement
  }
}

const escribir = (el: HTMLElement, valor: string) =>
  fireEvent.change(el, { target: { value: valor } })

describe('/developer/project/$projectId/invite', () => {
  afterEach(() => vi.restoreAllMocks())

  it('DEV-INVITE-CREATE-001: arranca vacío y con el botón deshabilitado', async () => {
    preparar()
    montar()

    const { enviar, unidad, monto } = await controles()
    expect(screen.getByTestId('DEV-INVITE-CREATE-001')).toBeTruthy()
    expect(enviar.disabled).toBe(true)
    expect(unidad.value).toBe('')
    expect(monto.value).toBe('')
    expect(screen.getByLabelText(t['developer.invite.amount'].replace('{currency}', 'USD'))).toBe(
      monto
    )
  })

  it('las unidades que no están disponibles se ven pero no se eligen', async () => {
    preparar()
    montar()

    await controles()
    expect((screen.getByRole('option', { name: 'Unidad u3' }) as HTMLOptionElement).disabled).toBe(
      true
    )
    expect((screen.getByRole('option', { name: 'Unidad u1' }) as HTMLOptionElement).disabled).toBe(
      false
    )
  })

  it('sin unidades cargadas el select queda solo con el placeholder', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listProjectUnits').mockReturnValue(new Promise(() => {}))
    montar()

    const select = (await screen.findByLabelText(t['developer.invite.unit'])) as HTMLSelectElement
    expect(select.options).toHaveLength(1)
  })

  it('elegir una unidad con precio precarga el monto y toma su moneda', async () => {
    preparar()
    montar()

    const c = await controles()
    escribir(c.unidad, 'u1')

    await waitFor(() => expect(c.monto.value).toBe('285000'))
    expect(screen.getByLabelText(t['developer.invite.amount'].replace('{currency}', 'EUR'))).toBe(
      c.monto
    )
  })

  it('elegir una unidad sin precio no toca el monto', async () => {
    preparar()
    montar()

    const c = await controles()
    escribir(c.unidad, 'u2')

    await waitFor(() => expect(c.unidad.value).toBe('u2'))
    expect(c.monto.value).toBe('')
  })

  it('el precio de la unidad no pisa un monto que ya se tipeó', async () => {
    preparar()
    montar()

    const c = await controles()
    escribir(c.monto, '1000')
    escribir(c.unidad, 'u1')

    await waitFor(() => expect(c.unidad.value).toBe('u1'))
    expect(c.monto.value).toBe('1000')
  })

  describe('el botón se habilita solo con las cinco condiciones', () => {
    it('sin email sigue deshabilitado', async () => {
      preparar()
      montar()
      const c = await controles()

      escribir(c.unidad, 'u1')

      await waitFor(() => expect(c.monto.value).toBe('285000'))
      expect(c.enviar.disabled).toBe(true)
    })

    it('un email de solo espacios no cuenta', async () => {
      preparar()
      montar()
      const c = await controles()

      escribir(c.email, '   ')
      escribir(c.unidad, 'u1')

      await waitFor(() => expect(c.monto.value).toBe('285000'))
      expect(c.enviar.disabled).toBe(true)
    })

    it('sin unidad sigue deshabilitado', async () => {
      preparar()
      montar()
      const c = await controles()

      escribir(c.email, 'ana@example.com')
      escribir(c.monto, '1000')

      await waitFor(() => expect(c.monto.value).toBe('1000'))
      expect(c.enviar.disabled).toBe(true)
    })

    it('sin monto sigue deshabilitado', async () => {
      preparar()
      montar()
      const c = await controles()

      escribir(c.email, 'ana@example.com')
      escribir(c.unidad, 'u2')

      await waitFor(() => expect(c.unidad.value).toBe('u2'))
      expect(c.enviar.disabled).toBe(true)
    })

    it('un monto en cero (precio 0 de la unidad) no habilita', async () => {
      preparar()
      montar()
      const c = await controles()

      escribir(c.email, 'ana@example.com')
      escribir(c.unidad, 'u4')

      await waitFor(() => expect(c.monto.value).toBe('0'))
      expect(c.enviar.disabled).toBe(true)
    })

    it('un monto con más de dos decimales marca error y no habilita', async () => {
      preparar()
      montar()
      const c = await controles()

      escribir(c.email, 'ana@example.com')
      escribir(c.unidad, 'u2')
      escribir(c.monto, '10.123')

      await screen.findByText(t['developer.invite.amountInvalid'])
      expect(c.enviar.disabled).toBe(true)
    })

    it('con un monto válido el error desaparece y habilita', async () => {
      preparar()
      montar()
      const c = await controles()

      escribir(c.email, 'ana@example.com')
      escribir(c.unidad, 'u2')
      escribir(c.monto, '10.123')
      await screen.findByText(t['developer.invite.amountInvalid'])
      escribir(c.monto, '10.12')

      await waitFor(() => expect(c.enviar.disabled).toBe(false))
      expect(screen.queryByText(t['developer.invite.amountInvalid'])).toBeNull()
    })
  })

  it('enviar el formulario sin datos completos no llama a la API', async () => {
    const crear = preparar()
    montar()
    await controles()

    fireEvent.submit(screen.getByTestId('DEV-INVITE-CREATE-001'))

    expect(crear).not.toHaveBeenCalled()
  })

  it('éxito: manda el monto en unidades mínimas, el email sin espacios y la moneda de la unidad, y va a la lista', async () => {
    const crear = preparar().mockResolvedValue(
      {} as Awaited<ReturnType<typeof api.createInvitation>>
    )
    const router = montar()
    const c = await controles()

    escribir(c.email, '  ana@example.com ')
    escribir(c.unidad, 'u1')
    await waitFor(() => expect(c.monto.value).toBe('285000'))
    escribir(c.monto, '285000.5')
    await waitFor(() => expect(c.enviar.disabled).toBe(false))
    fireEvent.click(c.enviar)

    await waitFor(() =>
      expect(crear).toHaveBeenCalledWith('p1', {
        unitId: 'u1',
        investorEmail: 'ana@example.com',
        amountMinorUnits: 28_500_050,
        currency: 'EUR'
      })
    )
    await waitFor(() => expect(router.state.location.pathname).toBe('/developer/project/p1/units'))
  })

  it('una unidad sin moneda invita en USD', async () => {
    const crear = preparar().mockResolvedValue(
      {} as Awaited<ReturnType<typeof api.createInvitation>>
    )
    montar()
    const c = await controles()

    escribir(c.email, 'ana@example.com')
    escribir(c.unidad, 'u2')
    escribir(c.monto, '500')
    await waitFor(() => expect(c.enviar.disabled).toBe(false))
    fireEvent.click(c.enviar)

    await waitFor(() =>
      expect(crear).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ amountMinorUnits: 50_000, currency: 'USD' })
      )
    )
  })

  it('mientras la invitación está en vuelo el botón queda deshabilitado', async () => {
    const crear = preparar().mockReturnValue(new Promise(() => {}))
    montar()
    const c = await controles()

    escribir(c.email, 'ana@example.com')
    escribir(c.unidad, 'u2')
    escribir(c.monto, '500')
    await waitFor(() => expect(c.enviar.disabled).toBe(false))
    fireEvent.click(c.enviar)

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: /Enviar invitación|…/ }) as HTMLButtonElement).disabled
      ).toBe(true)
    )
    fireEvent.submit(screen.getByTestId('DEV-INVITE-CREATE-001'))
    expect(crear).toHaveBeenCalledTimes(1)
  })

  it('si la API falla muestra el error y se queda en la pantalla', async () => {
    preparar().mockRejectedValue(new ApiError(409, 'unidad no disponible'))
    const router = montar()
    const c = await controles()

    escribir(c.email, 'ana@example.com')
    escribir(c.unidad, 'u2')
    escribir(c.monto, '500')
    await waitFor(() => expect(c.enviar.disabled).toBe(false))
    fireEvent.click(c.enviar)

    await screen.findByText(t['developer.invite.error'])
    expect(router.state.location.pathname).toBe('/developer/project/p1/invite')
  })

  it('el botón de volver lleva al detalle del proyecto', async () => {
    preparar()
    const router = montar()
    await controles()

    fireEvent.click(screen.getByRole('button', { name: t['nav.back'] }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/developer/project/p1'))
  })
})
