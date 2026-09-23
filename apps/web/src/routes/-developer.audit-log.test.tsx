import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '#/api/port'
import type { AuditEvent } from '#/api/types'
import { truncateHash } from '#/components/domain/HashChip'
import { dictionary } from '#/i18n/dictionary'
import { autenticarComo, DEVELOPER_USER, montarRuta } from './-test-mount'
import { Route } from './developer.audit-log'

const t = (clave: keyof (typeof dictionary)['es-AR']) => dictionary['es-AR'][clave]

const TXID = 'a'.repeat(64)

const evento = (sobre: Partial<AuditEvent>): AuditEvent => ({
  id: 'e-1',
  action: 'CHANGE_STAGE_STATE',
  entityType: 'Stage',
  entityId: 's-1',
  metadataJson: null,
  createdAt: '2026-06-01T12:00:00.000Z',
  actorName: 'Ana Dev',
  actorRole: 'developer',
  ...sobre
})

/** Una acción de cada familia de `categoriaDe` y un actor de cada rol de `rolDe`. */
const EVENTOS: AuditEvent[] = [
  evento({
    id: 'e-etapa',
    action: 'CHANGE_STAGE_STATE',
    actorName: 'Dora Dev',
    actorRole: 'developer'
  }),
  evento({
    id: 'e-cert',
    action: 'CERTIFY_STAGE',
    actorName: 'Carla Cert',
    actorRole: 'verifier',
    metadataJson: JSON.stringify({ txid: TXID })
  }),
  evento({ id: 'e-firma', action: 'SIGN_DOSSIER', actorName: 'Nora Not', actorRole: 'notary' }),
  evento({
    id: 'e-dossier',
    action: 'EXPORT_DOSSIER' as AuditEvent['action'],
    actorName: 'Ivo Inv',
    actorRole: 'buyer'
  }),
  evento({
    id: 'e-doc',
    action: 'UPLOAD_STAGE_EVIDENCE',
    actorName: 'Dora Dev',
    actorRole: 'developer'
  }),
  evento({
    id: 'e-doc2',
    action: 'ANCHOR_DOCUMENT',
    actorName: 'Dora Dev',
    actorRole: 'developer'
  }),
  evento({
    id: 'e-lib',
    action: 'RELEASE_PAYMENT' as AuditEvent['action'],
    actorName: 'Dora Dev',
    actorRole: 'developer'
  })
]

describe('/developer/audit-log', () => {
  afterEach(() => vi.restoreAllMocks())

  it('mientras carga muestra el estado de carga y no el vacío', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listAuditLog').mockReturnValue(new Promise(() => {}))
    montarRuta(Route, '/developer/audit-log')

    const lista = await screen.findByTestId('DEV-AUDIT-LIST-001')
    expect(within(lista).getByRole('status')).toBeTruthy()
    expect(screen.queryByText(t('developer.audit.empty'))).toBeNull()
  })

  it('sin eventos muestra el vacío', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listAuditLog').mockResolvedValue({ items: [], nextCursor: null })
    montarRuta(Route, '/developer/audit-log')

    await screen.findByText(t('developer.audit.empty'))
  })

  it('cada evento muestra su título, su categoría y el rol de su actor', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listAuditLog').mockResolvedValue({ items: EVENTOS, nextCursor: null })
    montarRuta(Route, '/developer/audit-log')

    const lista = await screen.findByTestId('DEV-AUDIT-LIST-001')
    await within(lista).findByText('Carla Cert')
    const tarjeta = (nombre: string) =>
      within(lista).getAllByText(nombre)[0].closest('article') as HTMLElement

    expect(within(tarjeta('Carla Cert')).getByText(t('audit.action.CERTIFY_STAGE'))).toBeTruthy()
    expect(within(tarjeta('Carla Cert')).getByText(t('audit.category.certificador'))).toBeTruthy()
    expect(within(tarjeta('Carla Cert')).getByText(t('role.verifier'))).toBeTruthy()
    expect(within(tarjeta('Nora Not')).getByText(t('audit.category.firma'))).toBeTruthy()
    expect(within(tarjeta('Nora Not')).getByText(t('role.notary'))).toBeTruthy()
    expect(within(tarjeta('Ivo Inv')).getByText(t('role.buyer'))).toBeTruthy()
    expect(within(tarjeta('Dora Dev')).getByText(t('audit.category.etapa'))).toBeTruthy()
  })

  it('una acción fuera del catálogo se muestra tal cual, en crudo, y se categoriza por su nombre', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listAuditLog').mockResolvedValue({
      items: [
        evento({
          id: 'x',
          action: 'RELEASE_FUTURE_ACTION' as AuditEvent['action'],
          actorName: 'Ana Dev'
        })
      ],
      nextCursor: null
    })
    montarRuta(Route, '/developer/audit-log')

    const lista = await screen.findByTestId('DEV-AUDIT-LIST-001')
    const tarjeta = (await within(lista).findByText('RELEASE_FUTURE_ACTION')).closest(
      'article'
    ) as HTMLElement
    expect(within(tarjeta).getByText(t('audit.category.liberacion'))).toBeTruthy()
  })

  it('un evento de sistema (sin actor ni rol) se atribuye a "Sistema" con rol de desarrollador', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listAuditLog').mockResolvedValue({
      items: [evento({ id: 'sys', actorName: null, actorRole: null })],
      nextCursor: null
    })
    montarRuta(Route, '/developer/audit-log')

    const lista = await screen.findByTestId('DEV-AUDIT-LIST-001')
    const tarjeta = (await within(lista).findByText(t('developer.audit.system'))).closest(
      'article'
    ) as HTMLElement
    expect(within(tarjeta).getByText(t('role.developer'))).toBeTruthy()
  })

  it('cada filtro de categoría deja solo los eventos de esa familia, y "Todos" los devuelve', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listAuditLog').mockResolvedValue({ items: EVENTOS, nextCursor: null })
    montarRuta(Route, '/developer/audit-log')

    const filtros = await screen.findByTestId('DEV-AUDIT-FILTER-002')
    const lista = screen.getByTestId('DEV-AUDIT-LIST-001')
    await within(lista).findByText('Carla Cert')
    const contar = () => lista.querySelectorAll('article').length
    const boton = (nombre: string) => within(filtros).getByRole('button', { name: nombre })

    expect(contar()).toBe(EVENTOS.length)
    expect(boton(t('developer.audit.all')).getAttribute('aria-pressed')).toBe('true')

    await userEvent.click(boton(t('audit.category.certificador')))
    expect(contar()).toBe(1)
    expect(boton(t('audit.category.certificador')).getAttribute('aria-pressed')).toBe('true')

    // SIGN_DOSSIER y EXPORT_DOSSIER.
    await userEvent.click(boton(t('audit.category.firma')))
    expect(contar()).toBe(2)
    await userEvent.click(boton(t('audit.category.liberacion')))
    expect(contar()).toBe(1)
    // UPLOAD_STAGE_EVIDENCE y ANCHOR_DOCUMENT.
    await userEvent.click(boton(t('audit.category.documento')))
    expect(contar()).toBe(2)
    await userEvent.click(boton(t('audit.category.etapa')))
    expect(contar()).toBe(1)

    await userEvent.click(boton(t('developer.audit.all')))
    expect(contar()).toBe(EVENTOS.length)
  })

  it('filtrar por una categoría sin eventos muestra el vacío', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listAuditLog').mockResolvedValue({
      items: [evento({ id: 'solo-etapa' })],
      nextCursor: null
    })
    montarRuta(Route, '/developer/audit-log')

    const filtros = await screen.findByTestId('DEV-AUDIT-FILTER-002')
    await userEvent.click(within(filtros).getByRole('button', { name: t('audit.category.firma') }))

    await screen.findByText(t('developer.audit.empty'))
  })

  it('solo los eventos con TXID llevan chip, y tocarlo abre el modal de verificación (DEV-AUDIT-VERIFY-001)', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listAuditLog').mockResolvedValue({
      items: [
        evento({ id: 'sin-meta', metadataJson: null }),
        evento({ id: 'sin-txid', metadataJson: JSON.stringify({ otro: 1 }) }),
        evento({ id: 'txid-null', metadataJson: JSON.stringify({ txid: null }) }),
        evento({
          id: 'con-txid',
          action: 'CERTIFY_STAGE',
          metadataJson: JSON.stringify({ txid: TXID })
        })
      ],
      nextCursor: null
    })
    montarRuta(Route, '/developer/audit-log')

    const lista = await screen.findByTestId('DEV-AUDIT-LIST-001')
    const chip = await within(lista).findByRole('button', { name: truncateHash(TXID) })
    expect(within(lista).getAllByRole('button', { name: truncateHash(TXID) })).toHaveLength(1)
    // La pantalla nunca abre el modal sola (M2-D4 §6.3).
    expect(screen.queryByTestId('DEV-AUDIT-VERIFY-001')).toBeNull()

    await userEvent.click(chip)

    const modal = await screen.findByTestId('DEV-AUDIT-VERIFY-001')
    expect(within(modal).getByText(t('txidModal.title'))).toBeTruthy()

    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' })
    await vi.waitFor(() => expect(screen.queryByTestId('DEV-AUDIT-VERIFY-001')).toBeNull())
  })

  it('el modal de un evento con acción fuera del catálogo rotula con la acción en crudo', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listAuditLog').mockResolvedValue({
      items: [
        evento({
          id: 'nuevo',
          action: 'FUTURE_ACTION' as AuditEvent['action'],
          metadataJson: JSON.stringify({ txid: TXID })
        })
      ],
      nextCursor: null
    })
    montarRuta(Route, '/developer/audit-log')

    await userEvent.click(await screen.findByRole('button', { name: truncateHash(TXID) }))

    const modal = await screen.findByTestId('DEV-AUDIT-VERIFY-001')
    expect(within(modal).getByText('FUTURE_ACTION')).toBeTruthy()
  })

  it('la flecha de volver lleva al panel del developer', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'listAuditLog').mockResolvedValue({ items: [], nextCursor: null })
    const router = montarRuta(Route, '/developer/audit-log', ['/developer'])

    await userEvent.click(await screen.findByRole('button', { name: t('nav.back') }))

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/developer'))
  })
})
