import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '#/api/port'
import { getSession } from '#/auth/session'
import { autenticarComo, DEVELOPER_USER, INVESTOR_USER, montarRuta } from '#/routes/-test-mount'
import { ProfileScreen } from './ProfileScreen'

// M2-D5 fila 30: una sola superficie con cuatro entradas. Acá se prueba el
// componente con sus props; las cuatro rutas de rol tienen su propio test.

const PERFIL = {
  id: 'u-dev',
  email: 'developer@example.com',
  role: 'developer',
  fullName: 'Developer Demo',
  isActive: true,
  notificationPrefsJson: null,
  createdAt: new Date(),
  updatedAt: new Date()
} as never

function montar(props: Partial<Parameters<typeof ProfileScreen>[0]> = {}) {
  return montarRuta(
    () => <ProfileScreen rol="developer" testId="PERFIL-001" {...props} />,
    '/perfil'
  )
}

describe('ProfileScreen', () => {
  afterEach(() => vi.restoreAllMocks())

  it('muestra nombre, email y rol del perfil, y el rol también en la credencial', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'getProfile').mockResolvedValue(PERFIL)
    montar()

    expect(await screen.findByText('developer@example.com')).toBeDefined()
    expect(screen.getByTestId('PERFIL-001').textContent).toContain('Developer Demo')
    expect(screen.getByText('Rol: Desarrollador')).toBeDefined()
  })

  it('mientras el perfil no llegó no dibuja el rol: pone la raya', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'getProfile').mockReturnValue(new Promise(() => {}))
    montar()

    expect(await screen.findByText('Rol: —')).toBeDefined()
    expect(screen.queryByText('Desarrollador')).toBeNull()
  })

  it('el investor lleva el contexto del diccionario', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'getProfile').mockResolvedValue({ ...(PERFIL as object), role: 'buyer' } as never)
    montar({ rol: 'investor' })

    expect(await screen.findByText('Cuenta y preferencias')).toBeDefined()
  })

  it('un rol que no es investor muestra el nombre del perfil bajo el título', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'getProfile').mockResolvedValue(PERFIL)
    montar()

    await waitFor(() => expect(screen.getByRole('banner').textContent).toContain('Developer Demo'))
    expect(screen.queryByText('Cuenta y preferencias')).toBeNull()
  })

  it('con back lo pasa al header', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'getProfile').mockResolvedValue(PERFIL)
    const volver = vi.fn()
    montar({ back: { label: 'Volver al panel', onClick: volver } })

    await userEvent.click(await screen.findByRole('button', { name: /Volver al panel/ }))
    expect(volver).toHaveBeenCalledOnce()
  })

  describe('preferencias de notificación', () => {
    it('sin preferencias guardadas todo está activado', async () => {
      autenticarComo(DEVELOPER_USER)
      vi.spyOn(api, 'getProfile').mockResolvedValue(PERFIL)
      montar({ prefsTestId: 'PREFS-001' })

      await screen.findByText('developer@example.com')
      const prefs = screen.getByTestId('PREFS-001')
      expect(prefs.querySelectorAll('[role="switch"][aria-checked="true"]')).toHaveLength(5)
    })

    it('respeta lo guardado: lo apagado queda apagado y lo ausente, activado', async () => {
      autenticarComo(DEVELOPER_USER)
      vi.spyOn(api, 'getProfile').mockResolvedValue({
        ...(PERFIL as object),
        notificationPrefsJson: JSON.stringify({ stage: false })
      } as never)
      montar()

      const avance = await screen.findByRole('switch', { name: 'Avance de etapas' })
      await waitFor(() => expect(avance.getAttribute('aria-checked')).toBe('false'))
      expect(
        screen.getByRole('switch', { name: 'Documentos nuevos' }).getAttribute('aria-checked')
      ).toBe('true')
    })

    it('tocar un switch manda solo esa categoría y vuelve a leer el perfil', async () => {
      autenticarComo(DEVELOPER_USER)
      const leer = vi.spyOn(api, 'getProfile').mockResolvedValue(PERFIL)
      const guardar = vi.spyOn(api, 'updateNotificationPrefs').mockResolvedValue(undefined as never)
      montar()

      await userEvent.click(await screen.findByRole('switch', { name: 'Liberaciones' }))

      await waitFor(() => expect(guardar).toHaveBeenCalledWith({ release: false }))
      await waitFor(() => expect(leer).toHaveBeenCalledTimes(2))
    })

    it('mientras guarda, los switches quedan deshabilitados', async () => {
      autenticarComo(DEVELOPER_USER)
      vi.spyOn(api, 'getProfile').mockResolvedValue(PERFIL)
      vi.spyOn(api, 'updateNotificationPrefs').mockReturnValue(new Promise(() => {}))
      montar()

      await userEvent.click(await screen.findByRole('switch', { name: 'Firmas del escribano' }))

      await waitFor(() =>
        expect(screen.getByRole('switch', { name: 'Certificaciones' })).toHaveProperty(
          'disabled',
          true
        )
      )
    })
  })

  describe('edición del nombre', () => {
    it('el formulario no existe hasta que se toca Editar, y arranca con el nombre actual', async () => {
      autenticarComo(DEVELOPER_USER)
      vi.spyOn(api, 'getProfile').mockResolvedValue(PERFIL)
      montar({ editTestId: 'EDIT-001' })

      await screen.findByText('developer@example.com')
      expect(screen.queryByTestId('EDIT-001')).toBeNull()

      await userEvent.click(screen.getByRole('button', { name: 'Editar' }))

      expect(screen.getByTestId('EDIT-001')).toBeDefined()
      expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Developer Demo')
    })

    it('sin editTestId el formulario no lleva test ID', async () => {
      autenticarComo(DEVELOPER_USER)
      vi.spyOn(api, 'getProfile').mockResolvedValue(PERFIL)
      montar()

      await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))

      expect(screen.getByLabelText('Nombre').closest('form')?.hasAttribute('data-testid')).toBe(
        false
      )
    })

    it('editar antes de que llegue el perfil arranca con el campo vacío', async () => {
      autenticarComo(DEVELOPER_USER)
      vi.spyOn(api, 'getProfile').mockReturnValue(new Promise(() => {}))
      montar()

      await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))

      expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('')
    })

    it('guarda el nombre recortado, cierra el formulario y vuelve a leer el perfil', async () => {
      autenticarComo(DEVELOPER_USER)
      const leer = vi.spyOn(api, 'getProfile').mockResolvedValue(PERFIL)
      const guardar = vi.spyOn(api, 'updateProfile').mockResolvedValue(undefined as never)
      montar({ editTestId: 'EDIT-001' })

      await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))
      const campo = screen.getByLabelText('Nombre')
      await userEvent.clear(campo)
      await userEvent.type(campo, '  Ana Torres  ')
      await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

      await waitFor(() => expect(guardar).toHaveBeenCalledWith('Ana Torres'))
      await waitFor(() => expect(screen.queryByTestId('EDIT-001')).toBeNull())
      expect(leer).toHaveBeenCalledTimes(2)
    })

    it('un nombre en blanco no se guarda', async () => {
      autenticarComo(DEVELOPER_USER)
      vi.spyOn(api, 'getProfile').mockResolvedValue(PERFIL)
      const guardar = vi.spyOn(api, 'updateProfile').mockResolvedValue(undefined as never)
      montar({ editTestId: 'EDIT-001' })

      await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))
      const campo = screen.getByLabelText('Nombre')
      await userEvent.clear(campo)
      await userEvent.type(campo, '   ')
      // `required` no frena espacios: el recorte sí.
      await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

      expect(guardar).not.toHaveBeenCalled()
      expect(screen.getByTestId('EDIT-001')).toBeDefined()
    })

    it('mientras guarda, el botón dice Guardando… y está deshabilitado', async () => {
      autenticarComo(DEVELOPER_USER)
      vi.spyOn(api, 'getProfile').mockResolvedValue(PERFIL)
      vi.spyOn(api, 'updateProfile').mockReturnValue(new Promise(() => {}))
      montar()

      await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))
      await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

      const boton = await screen.findByRole('button', { name: 'Guardando…' })
      expect(boton).toHaveProperty('disabled', true)
    })
  })

  it('cerrar sesión borra la sesión y lleva a /login', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'getProfile').mockResolvedValue(PERFIL)
    const asignar = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign: asignar })
    try {
      montar()

      await userEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }))

      expect(getSession()).toBeNull()
      expect(asignar).toHaveBeenCalledWith('/login')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
