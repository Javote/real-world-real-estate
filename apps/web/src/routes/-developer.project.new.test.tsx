import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '#/api/port'
import type { ProjectCreated } from '#/api/types'
import { dictionary } from '#/i18n/dictionary'
import { autenticarComo, DEVELOPER_USER, montarRuta } from './-test-mount'
import { Route } from './developer.project.new'

const t = (clave: keyof (typeof dictionary)['es-AR']) => dictionary['es-AR'][clave]

const creado = { id: 'p-nuevo' } as ProjectCreated

const montar = () =>
  montarRuta(Route, '/developer/project/new', [
    '/developer/project/$projectId',
    '/developer/projects'
  ])

const boton = () => screen.getByRole('button', { name: t('developer.newProject.submit') })

describe('/developer/project/new', () => {
  afterEach(() => vi.restoreAllMocks())

  it('sin nombre no se puede crear, y mostrar el formulario no llama a la API', async () => {
    autenticarComo(DEVELOPER_USER)
    const crear = vi.spyOn(api, 'createProject').mockResolvedValue(creado)
    montar()

    await screen.findByTestId('DEV-PROJECT-CREATE-001')
    expect((boton() as HTMLButtonElement).disabled).toBe(true)
    expect(crear).not.toHaveBeenCalled()
  })

  it('un nombre que no deja nada al normalizarlo tampoco alcanza, y enviar el formulario a la fuerza no crea', async () => {
    autenticarComo(DEVELOPER_USER)
    const crear = vi.spyOn(api, 'createProject').mockResolvedValue(creado)
    montar()

    const formulario = await screen.findByTestId('DEV-PROJECT-CREATE-001')
    await userEvent.type(screen.getByLabelText(t('developer.newProject.name')), '  !!!  ')

    expect((boton() as HTMLButtonElement).disabled).toBe(true)
    fireEvent.submit(formulario)
    expect(crear).not.toHaveBeenCalled()
  })

  it('con solo el nombre crea el proyecto con su slug y sin dirección, unidades ni entrega', async () => {
    autenticarComo(DEVELOPER_USER)
    const crear = vi.spyOn(api, 'createProject').mockResolvedValue(creado)
    montar()

    await userEvent.type(
      await screen.findByLabelText(t('developer.newProject.name')),
      'Torres del Palermo'
    )
    // Una dirección de puros espacios cuenta como vacía.
    await userEvent.type(screen.getByLabelText(t('developer.newProject.location')), '   ')
    await userEvent.click(boton())

    await vi.waitFor(() =>
      expect(crear).toHaveBeenCalledWith({ name: 'Torres del Palermo', slug: 'torres-del-palermo' })
    )
  })

  it('con dirección, unidades y entrega los manda los tres', async () => {
    autenticarComo(DEVELOPER_USER)
    const crear = vi.spyOn(api, 'createProject').mockResolvedValue(creado)
    montar()

    await userEvent.type(await screen.findByLabelText(t('developer.newProject.name')), ' Torre Ñ ')
    await userEvent.type(
      screen.getByLabelText(t('developer.newProject.location')),
      ' Av. Pellegrini 100 '
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
        address: 'Av. Pellegrini 100',
        totalUnits: 2,
        estimatedDelivery: '2027-12-01'
      })
    )
  })

  it('al crear con éxito navega al proyecto nuevo', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'createProject').mockResolvedValue(creado)
    const router = montar()

    await userEvent.type(await screen.findByLabelText(t('developer.newProject.name')), 'Torre X')
    await userEvent.click(boton())

    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe('/developer/project/p-nuevo')
    )
  })

  it('mientras se crea, el botón queda deshabilitado y no se puede enviar dos veces', async () => {
    autenticarComo(DEVELOPER_USER)
    const crear = vi.spyOn(api, 'createProject').mockReturnValue(new Promise(() => {}))
    montar()

    await userEvent.type(await screen.findByLabelText(t('developer.newProject.name')), 'Torre X')
    await userEvent.click(boton())

    await vi.waitFor(() => expect((boton() as HTMLButtonElement).disabled).toBe(true))
    fireEvent.submit(screen.getByTestId('DEV-PROJECT-CREATE-001'))
    expect(crear).toHaveBeenCalledTimes(1)
  })

  it('si la API rechaza la creación muestra el error y deja reintentar', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'createProject').mockRejectedValue(new ApiError(400, 'invalid'))
    montar()

    await userEvent.type(await screen.findByLabelText(t('developer.newProject.name')), 'Torre X')
    expect(screen.queryByText(t('developer.newProject.error'))).toBeNull()
    await userEvent.click(boton())

    await screen.findByText(t('developer.newProject.error'))
    expect((boton() as HTMLButtonElement).disabled).toBe(false)
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
