import type { DeveloperDocument } from '@plataforma/shared'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '#/api/port'
import { dictionary } from '#/i18n/dictionary'
import { autenticarComo, DEVELOPER_USER, montarRuta } from './-test-mount'
import { Route } from './developer.documentation'

const t = (clave: keyof (typeof dictionary)['es-AR']) => dictionary['es-AR'][clave]

const documento = (sobre: Partial<DeveloperDocument>): DeveloperDocument => ({
  id: 'd-1',
  filename: 'plano.pdf',
  category: 'plano',
  authoritative: false,
  sha256Hash: 'b'.repeat(64),
  uploadedAt: new Date('2026-06-01T12:00:00.000Z'),
  txid: null,
  anchorStatus: null,
  ...sobre
})

describe('/developer/documentation', () => {
  afterEach(() => vi.restoreAllMocks())

  it('mientras carga muestra el estado de carga en las dos secciones', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listDeveloperDocuments').mockReturnValue(new Promise(() => {}))
    montarRuta(Route, '/developer/documentation')

    const lista = await screen.findByTestId('DEV-DOCS-LIST-001')
    expect(within(lista).getByRole('status')).toBeTruthy()
    expect(screen.getAllByRole('status')).toHaveLength(2)
    expect(screen.queryByText(t('developer.docs.emptyVerified'))).toBeNull()
  })

  it('sin documentos muestra los dos vacíos', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listDeveloperDocuments').mockResolvedValue([])
    montarRuta(Route, '/developer/documentation')

    await screen.findByText(t('developer.docs.emptyVerified'))
    expect(screen.getByText(t('developer.docs.emptyPending'))).toBeTruthy()
  })

  it('el corte es por TXID: con anclaje va a "Verificados", sin anclaje a "Pendientes" con su botón de anclar', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listDeveloperDocuments').mockResolvedValue([
      documento({ id: 'ok', filename: 'permiso.pdf', txid: 'c'.repeat(64) }),
      documento({ id: 'pend', filename: 'acta.pdf', txid: null })
    ])
    montarRuta(Route, '/developer/documentation')

    const verificados = await screen.findByTestId('DEV-DOCS-LIST-001')
    await within(verificados).findByText('permiso.pdf')
    expect(within(verificados).queryByText('acta.pdf')).toBeNull()

    expect(screen.getByText('acta.pdf')).toBeTruthy()
    expect(screen.getAllByTestId('DEV-DOC-ANCHOR-002')).toHaveLength(1)
    expect(screen.queryByText(t('developer.docs.emptyVerified'))).toBeNull()
    expect(screen.queryByText(t('developer.docs.emptyPending'))).toBeNull()
  })

  it('anclar un documento pendiente llama a `anchorDocument` con su id y refresca la lista', async () => {
    autenticarComo(DEVELOPER_USER)
    const listar = vi
      .spyOn(api, 'listDeveloperDocuments')
      .mockResolvedValue([documento({ id: 'pend' })])
    const anclar = vi.spyOn(api, 'anchorDocument').mockResolvedValue({} as never)
    montarRuta(Route, '/developer/documentation')

    await userEvent.click(await screen.findByTestId('DEV-DOC-ANCHOR-002'))

    expect(anclar).toHaveBeenCalledWith('pend')
    await vi.waitFor(() => expect(listar).toHaveBeenCalledTimes(2))
  })

  it('mientras un anclaje está en vuelo, el botón queda deshabilitado', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listDeveloperDocuments').mockResolvedValue([documento({ id: 'pend' })])
    vi.spyOn(api, 'anchorDocument').mockReturnValue(new Promise(() => {}))
    montarRuta(Route, '/developer/documentation')

    const boton = await screen.findByTestId('DEV-DOC-ANCHOR-002')
    await userEvent.click(boton)

    await vi.waitFor(() => expect((boton as HTMLButtonElement).disabled).toBe(true))
  })

  it('un documento sin hash no se puede anclar', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listDeveloperDocuments').mockResolvedValue([documento({ sha256Hash: null })])
    montarRuta(Route, '/developer/documentation')

    const boton = await screen.findByTestId('DEV-DOC-ANCHOR-002')
    expect((boton as HTMLButtonElement).disabled).toBe(true)
  })

  it('la flecha de volver lleva al panel del developer', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listDeveloperDocuments').mockResolvedValue([])
    const router = montarRuta(Route, '/developer/documentation', ['/developer'])

    await userEvent.click(await screen.findByRole('button', { name: t('nav.backToPanel') }))

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/developer'))
  })
})
