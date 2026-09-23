import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '#/api/port'
import { dictionary } from '#/i18n/dictionary'
import { ADMIN_USER, autenticarComo, montarRuta } from './-test-mount'
import { Route } from './admin.index'

const t = dictionary['es-AR']

type Proyectos = Awaited<ReturnType<typeof api.listProjects>>
type Detalle = Awaited<ReturnType<typeof api.getProject>>
type Usuarios = Awaited<ReturnType<typeof api.listUsers>>
type Invitaciones = Awaited<ReturnType<typeof api.listProjectCertifierInvitations>>

const proyecto = (id: string, name: string, createdAt: string) =>
  ({ id, name, createdAt, stages: [] }) as unknown as Proyectos[number]

const VIEJO = proyecto('p-viejo', 'Torre Vieja', '2026-01-01T00:00:00.000Z')
const NUEVO = proyecto('p-nuevo', 'Torre Nueva', '2026-06-01T00:00:00.000Z')

const miembro = (id: string, userId: string, membershipRole: string, fullName: string) => ({
  id,
  userId,
  membershipRole,
  user: { id: userId, fullName }
})

const detalle = (members: unknown[]) => ({ members }) as unknown as Detalle

const usuario = (id: string, fullName: string, role: string, isActive = true) => ({
  id,
  fullName,
  role,
  isActive
})

const invitacion = (id: string, certifierId: string, certifierName: string, status: string) =>
  ({ id, certifierId, certifierName, status }) as unknown as Invitaciones[number]

function preparar(opts: {
  proyectos?: Proyectos
  detalle?: Detalle
  usuarios?: unknown[]
  invitaciones?: Invitaciones
}) {
  autenticarComo(ADMIN_USER)
  vi.spyOn(api, 'listProjects').mockResolvedValue(opts.proyectos ?? [])
  const getProject = vi.spyOn(api, 'getProject').mockResolvedValue(opts.detalle ?? detalle([]))
  const listInv = vi
    .spyOn(api, 'listProjectCertifierInvitations')
    .mockResolvedValue(opts.invitaciones ?? [])
  vi.spyOn(api, 'listUsers').mockResolvedValue((opts.usuarios ?? []) as unknown as Usuarios)
  return { getProject, listInv }
}

const montar = () => montarRuta(Route.options.component as () => React.ReactElement, '/admin/')

/** Espera a que el select de certificadores tenga la opción, elige y pulsa "Invitar". */
async function invitarA(id: string, nombre: string) {
  const select = await screen.findByLabelText(t['admin.certifier'])
  await within(select).findByText(nombre)
  fireEvent.change(select, { target: { value: id } })
  fireEvent.click(screen.getByRole('button', { name: t['admin.invite'] }))
  return select as HTMLSelectElement
}

const botonInvitar = () =>
  screen.getByRole('button', { name: t['admin.invite'] }) as HTMLButtonElement

describe('/admin (invitar certificadores)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('sin proyectos: solo el selector, sin miembros ni formulario y sin pedir el detalle', async () => {
    const { getProject, listInv } = preparar({ proyectos: [] })
    montar()

    await screen.findByTestId('ADMIN-PROJECT-001')
    await waitFor(() => expect(api.listProjects).toHaveBeenCalled())
    expect(screen.queryByTestId('ADMIN-MEMBERS-002')).toBeNull()
    expect(screen.queryByTestId('ADMIN-CERTIFIER-INVITE-003')).toBeNull()
    expect(getProject).not.toHaveBeenCalled()
    expect(listInv).not.toHaveBeenCalled()
  })

  it('elige por defecto el proyecto más nuevo, sin miembros ni invitaciones', async () => {
    const { getProject } = preparar({ proyectos: [VIEJO, NUEVO] })
    montar()

    await screen.findByText(t['admin.noMembers'])
    expect(screen.getByText(t['admin.noInvitations'])).toBeTruthy()
    expect(getProject).toHaveBeenCalledWith('p-nuevo')
    const select = screen.getByLabelText(t['admin.project']) as HTMLSelectElement
    expect(select.value).toBe('p-nuevo')
    const opciones = within(select)
      .getAllByRole('option')
      .map((o) => o.textContent)
    expect(opciones.indexOf('Torre Nueva')).toBeLessThan(opciones.indexOf('Torre Vieja'))
  })

  it('elegir otro proyecto pide el detalle y las invitaciones de ese proyecto', async () => {
    const { getProject, listInv } = preparar({ proyectos: [VIEJO, NUEVO] })
    montar()

    const select = (await screen.findByLabelText(t['admin.project'])) as HTMLSelectElement
    await waitFor(() => expect(select.value).toBe('p-nuevo'))
    fireEvent.change(select, { target: { value: 'p-viejo' } })

    await waitFor(() => expect(getProject).toHaveBeenCalledWith('p-viejo'))
    expect(listInv).toHaveBeenCalledWith('p-viejo')
  })

  it('lista los miembros con su rol traducido', async () => {
    preparar({
      proyectos: [NUEVO],
      detalle: detalle([
        miembro('m1', 'u1', 'developer', 'Dana Dev'),
        miembro('m2', 'u2', 'buyer', 'Ivo Inversor'),
        miembro('m3', 'u3', 'verifier', 'Cora Certificadora')
      ])
    })
    montar()

    const seccion = await screen.findByTestId('ADMIN-MEMBERS-002')
    await within(seccion).findByText('Dana Dev')
    expect(within(seccion).getByText(t['admin.role.developer'])).toBeTruthy()
    expect(within(seccion).getByText(t['admin.role.buyer'])).toBeTruthy()
    expect(within(seccion).getByText(t['admin.role.verifier'])).toBeTruthy()
  })

  it('solo ofrece certificadores activos, que no certifican ya y sin invitación pendiente', async () => {
    preparar({
      proyectos: [NUEVO],
      detalle: detalle([miembro('m3', 'v-ya', 'verifier', 'Ya Certifica')]),
      usuarios: [
        usuario('v-ok', 'Invitable', 'verifier'),
        usuario('v-off', 'Inactivo', 'verifier', false),
        usuario('v-ya', 'Ya Certifica', 'verifier'),
        usuario('v-pend', 'Con Pendiente', 'verifier'),
        usuario('v-acc', 'Con Aceptada', 'verifier'),
        usuario('b1', 'Un Inversor', 'buyer')
      ],
      invitaciones: [
        invitacion('i1', 'v-pend', 'Con Pendiente', 'pending'),
        invitacion('i2', 'v-acc', 'Con Aceptada', 'accepted')
      ]
    })
    montar()

    // Las invitaciones y el detalle llegan aparte de los usuarios: se espera a las dos.
    await screen.findByText('Ya Certifica', { selector: 'span' })
    await screen.findByText('Con Pendiente', { selector: 'span' })
    const select = screen.getByLabelText(t['admin.certifier'])
    await waitFor(() =>
      expect(
        within(select)
          .getAllByRole('option')
          .map((o) => o.textContent)
      ).toEqual([t['admin.selectCertifier'], 'Invitable', 'Con Aceptada'])
    )
  })

  it('muestra las invitaciones con su estado', async () => {
    preparar({
      proyectos: [NUEVO],
      invitaciones: [
        invitacion('i1', 'c1', 'Ana', 'pending'),
        invitacion('i2', 'c2', 'Beto', 'accepted'),
        invitacion('i3', 'c3', 'Carla', 'declined')
      ]
    })
    montar()

    const seccion = await screen.findByTestId('ADMIN-CERTIFIER-INVITATIONS-004')
    await within(seccion).findByText('Ana')
    expect(within(seccion).getByText(t['admin.invitation.pending'])).toBeTruthy()
    expect(within(seccion).getByText(t['admin.invitation.accepted'])).toBeTruthy()
    expect(within(seccion).getByText(t['admin.invitation.declined'])).toBeTruthy()
  })

  it('sin certificador elegido el botón está deshabilitado y enviar el formulario no invita', async () => {
    preparar({ proyectos: [NUEVO], usuarios: [usuario('v1', 'Cora', 'verifier')] })
    const invitar = vi.spyOn(api, 'inviteCertifier')
    montar()

    const form = await screen.findByTestId('ADMIN-CERTIFIER-INVITE-003')
    expect(botonInvitar().disabled).toBe(true)
    fireEvent.submit(form)
    expect(invitar).not.toHaveBeenCalled()
  })

  it('invita al certificador elegido, avisa y limpia la selección', async () => {
    preparar({ proyectos: [NUEVO], usuarios: [usuario('v1', 'Cora', 'verifier')] })
    const invitar = vi.spyOn(api, 'inviteCertifier').mockResolvedValue({} as never)
    montar()

    const select = await invitarA('v1', 'Cora')

    await screen.findByText(t['admin.invited'])
    expect(invitar).toHaveBeenCalledWith('p-nuevo', 'v1')
    await waitFor(() => expect(select.value).toBe(''))
  })

  it('mientras invita deja el botón deshabilitado y sin mensajes', async () => {
    preparar({ proyectos: [NUEVO], usuarios: [usuario('v1', 'Cora', 'verifier')] })
    vi.spyOn(api, 'inviteCertifier').mockReturnValue(new Promise(() => {}))
    montar()

    await invitarA('v1', 'Cora')

    await waitFor(() => expect(botonInvitar().disabled).toBe(true))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it.each([
    ['CERTIFIER_NOT_ELIGIBLE', 'admin.error.CERTIFIER_NOT_ELIGIBLE'],
    ['ALREADY_MEMBER', 'admin.error.ALREADY_MEMBER'],
    ['INVITATION_ALREADY_PENDING', 'admin.error.INVITATION_ALREADY_PENDING'],
    ['OTRO_CODIGO', 'admin.error.generic']
  ] as const)('el error con código %s muestra su mensaje', async (code, clave) => {
    preparar({ proyectos: [NUEVO], usuarios: [usuario('v1', 'Cora', 'verifier')] })
    vi.spyOn(api, 'inviteCertifier').mockRejectedValue(new ApiError(409, 'x', { code }))
    montar()

    await invitarA('v1', 'Cora')

    expect((await screen.findByRole('alert')).textContent).toBe(t[clave])
  })

  it('un ApiError sin cuerpo cae al mensaje genérico', async () => {
    preparar({ proyectos: [NUEVO], usuarios: [usuario('v1', 'Cora', 'verifier')] })
    vi.spyOn(api, 'inviteCertifier').mockRejectedValue(new ApiError(500, 'x'))
    montar()

    await invitarA('v1', 'Cora')

    expect((await screen.findByRole('alert')).textContent).toBe(t['admin.error.generic'])
  })

  it('un error que no es de la API usa el genérico, y cambiar de certificador lo borra', async () => {
    preparar({
      proyectos: [NUEVO],
      usuarios: [usuario('v1', 'Cora', 'verifier'), usuario('v2', 'Dora', 'verifier')]
    })
    vi.spyOn(api, 'inviteCertifier').mockRejectedValue(new Error('boom'))
    montar()

    const select = await invitarA('v1', 'Cora')
    expect((await screen.findByRole('alert')).textContent).toBe(t['admin.error.generic'])

    fireEvent.change(select, { target: { value: 'v2' } })
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('cambiar de proyecto descarta el error de la invitación anterior', async () => {
    preparar({ proyectos: [VIEJO, NUEVO], usuarios: [usuario('v1', 'Cora', 'verifier')] })
    vi.spyOn(api, 'inviteCertifier').mockRejectedValue(new Error('boom'))
    montar()

    await invitarA('v1', 'Cora')
    await screen.findByRole('alert')

    fireEvent.change(screen.getByLabelText(t['admin.project']), { target: { value: 'p-viejo' } })
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })
})
