import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '#/api/port'
import { dictionary } from '#/i18n/dictionary'
import { autenticarComo, DEVELOPER_USER, montarRuta } from './-test-mount'
import { Route } from './developer.index'

const t = (clave: keyof (typeof dictionary)['es-AR']) => dictionary['es-AR'][clave]

describe('/developer (panel)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('DEV-PANEL-KPIS-001 día 1: los KPI sin dato van en guión, no en cero', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'getDeveloperKpis').mockResolvedValue({
      activeProjects: 0,
      totalUnits: null,
      capitalRaisedMinorUnits: null,
      averageProgress: 0,
      verifiedDocuments: 0
    })
    montarRuta(Route, '/developer/')

    const panel = await screen.findByTestId('DEV-PANEL-KPIS-001')
    // Solo los dos KPI pendientes (unidades y capital) muestran el guión; el resto, su cero.
    await vi.waitFor(() =>
      expect(within(panel).getAllByText(t('panel.emptyValue'))).toHaveLength(2)
    )
    expect(panel.textContent).not.toContain('null')
  })

  it('DEV-PANEL-KPIS-001 con datos: muestra los valores de `getDeveloperKpis`', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'getDeveloperKpis').mockResolvedValue({
      activeProjects: 3,
      totalUnits: 42,
      capitalRaisedMinorUnits: 500000,
      averageProgress: 65,
      verifiedDocuments: 7
    })
    montarRuta(Route, '/developer/')

    const panel = await screen.findByTestId('DEV-PANEL-KPIS-001')
    await vi.waitFor(() => expect(panel.textContent).toContain('42'))
    expect(panel.textContent).toContain('3')
    // El capital llega en unidades mínimas: 500000 centavos son 5000.
    expect(panel.textContent).toContain('5')
    expect(panel.textContent).toContain('65%')
    expect(panel.textContent).toContain('7')
    expect(within(panel).queryByText(t('panel.emptyValue'))).toBeNull()
  })

  it('saluda al usuario de la sesión por su nombre', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'getDeveloperKpis').mockReturnValue(new Promise(() => {}))
    montarRuta(Route, '/developer/')

    await screen.findByText(t('panel.welcome').replace('{name}', DEVELOPER_USER.fullName))
  })

  it.each([
    ['panel.developer.newProject', '/developer/project/new'],
    ['panel.developer.investorsAction', '/developer/investors'],
    ['panel.developer.docsAction', '/developer/documentation'],
    ['panel.developer.auditAction', '/developer/audit-log']
  ] as const)('el acceso "%s" navega a %s', async (clave, destino) => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'getDeveloperKpis').mockReturnValue(new Promise(() => {}))
    const router = montarRuta(Route, '/developer/', [destino])

    await userEvent.click(await screen.findByRole('button', { name: new RegExp(t(clave)) }))

    await vi.waitFor(() => expect(router.state.location.pathname).toBe(destino))
  })
})
