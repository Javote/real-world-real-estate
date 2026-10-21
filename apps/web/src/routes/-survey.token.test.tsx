import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '#/api/port'
import { esAR } from '#/i18n/dictionary'
import { montarRuta } from './-test-mount'
import { Route } from './survey.$token'

const t = esAR

const montar = () => montarRuta(Route, '/survey/$token', [], '/survey/tok-123')

const enviar = () => screen.getByRole('button', { name: t['survey.submit'] })

describe('/survey/:token (sin sesión, SPEC-503)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('INV-SURVEY-NPS-001: sin puntaje no se envía; con puntaje y comentario manda los dos con el token', async () => {
    const responder = vi.spyOn(api, 'respondNpsSurvey').mockResolvedValue(undefined)
    montar()

    await screen.findByTestId('INV-SURVEY-NPS-001')
    const escala = screen.getByRole('group', { name: t['notifications.survey.nps'] })
    expect(within(escala).getAllByRole('button', { pressed: false })).toHaveLength(11)
    expect((enviar() as HTMLButtonElement).disabled).toBe(true)

    await userEvent.click(screen.getByRole('button', { name: '9' }))
    expect(screen.getByRole('button', { name: '9' }).getAttribute('aria-pressed')).toBe('true')
    await userEvent.type(screen.getByLabelText(t['survey.comment']), '  Muy claro  ')
    await userEvent.click(enviar())

    await screen.findByText(t['survey.thanks'])
    expect(responder).toHaveBeenCalledWith('tok-123', { score: 9, comment: 'Muy claro' })
  })

  it('un submit sin puntaje (Enter en el formulario) no llama a la API', async () => {
    const responder = vi.spyOn(api, 'respondNpsSurvey').mockResolvedValue(undefined)
    montar()

    const main = await screen.findByTestId('INV-SURVEY-NPS-001')
    fireEvent.submit(main.querySelector('form') as HTMLFormElement)
    expect(responder).not.toHaveBeenCalled()
  })

  it('un comentario en blanco no viaja: el campo es opcional', async () => {
    const responder = vi.spyOn(api, 'respondNpsSurvey').mockResolvedValue(undefined)
    montar()

    await userEvent.click(await screen.findByRole('button', { name: '0' }))
    await userEvent.type(screen.getByLabelText(t['survey.comment']), '   ')
    await userEvent.click(enviar())

    await waitFor(() => expect(responder).toHaveBeenCalledWith('tok-123', { score: 0 }))
  })

  it.each([
    [
      'ya respondida',
      new ApiError(409, 'Conflict', { code: 'SURVEY_ALREADY_ANSWERED' }),
      'survey.alreadyAnswered'
    ],
    ['inexistente', new ApiError(404, 'Not Found', { code: 'NOT_FOUND' }), 'survey.notFound']
  ] as const)('una encuesta %s cierra el formulario con su mensaje', async (_, error, clave) => {
    vi.spyOn(api, 'respondNpsSurvey').mockRejectedValue(error)
    montar()

    await userEvent.click(await screen.findByRole('button', { name: '7' }))
    await userEvent.click(enviar())

    await screen.findByText(t[clave])
    expect(screen.queryByRole('button', { name: t['survey.submit'] })).toBeNull()
  })

  it('un error que no es de la encuesta deja el formulario para reintentar, con el aviso', async () => {
    vi.spyOn(api, 'respondNpsSurvey').mockRejectedValue(new ApiError(500, 'Server Error'))
    montar()

    await userEvent.click(await screen.findByRole('button', { name: '7' }))
    await userEvent.click(enviar())

    expect((await screen.findByRole('alert')).textContent).toBe(t['error.generic'])
    expect(enviar()).toBeTruthy()
  })
})
