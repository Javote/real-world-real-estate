import { useMutation } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { claveDeError } from '#/api/claveDeError'
import { api } from '#/api/port'
import { CategoryChip } from '#/components/domain/Chips'
import { GradientHeader } from '#/components/domain/GradientHeader'
import { LanguageToggle } from '#/components/domain/LanguageToggle'
import { PrimaryButton } from '#/components/domain/PrimaryButton'
import { TextArea } from '#/components/domain/TextArea'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL } from '#/lib/cardShell'
import { cn } from '#/lib/cn'

export const Route = createFileRoute('/survey/$token')({
  component: SurveyPage
})

const PUNTAJES = Array.from({ length: 11 }, (_, i) => i)

const POR_CODIGO = {
  SURVEY_ALREADY_ANSWERED: 'survey.alreadyAnswered',
  NOT_FOUND: 'survey.notFound'
} as const

/** SPEC-503: el link de la notificación. Sin sesión, como el dossier público: el token es la llave. */
function SurveyPage() {
  const { token } = Route.useParams()
  const { t } = useTranslation()
  const [puntaje, setPuntaje] = useState<number | null>(null)
  const [comentario, setComentario] = useState('')

  const responder = useMutation({
    mutationFn: (score: number) =>
      api.respondNpsSurvey(token, {
        score,
        ...(comentario.trim() ? { comment: comentario.trim() } : {})
      })
  })

  // Un error que no es la genérica cierra la encuesta: ya respondida o inexistente no se reintenta.
  const error = responder.isError ? claveDeError(responder.error, { porCodigo: POR_CODIGO }) : null
  const cierre = responder.isSuccess ? 'survey.thanks' : error === 'error.generic' ? null : error

  return (
    <div className="min-h-dvh bg-app-bg">
      <GradientHeader title={t('survey.title')} right={<LanguageToggle />} />

      <main className="mx-auto flex max-w-lg flex-col gap-s4 p-s4" data-testid="INV-SURVEY-NPS-001">
        {cierre ? (
          <p className="text-body text-text-muted">{t(cierre)}</p>
        ) : (
          <form
            className={cn('flex flex-col gap-s4', CARD_SHELL)}
            onSubmit={(e) => {
              e.preventDefault()
              if (puntaje !== null) responder.mutate(puntaje)
            }}
          >
            <fieldset className="flex flex-col gap-s2">
              <legend className="mb-s2 text-body font-bold text-text-primary">
                {t('notifications.survey.nps')}
              </legend>
              <div className="flex flex-wrap gap-s2">
                {PUNTAJES.map((n) => (
                  <CategoryChip key={n} selected={puntaje === n} onSelect={() => setPuntaje(n)}>
                    {n}
                  </CategoryChip>
                ))}
              </div>
              <p className="flex justify-between text-caption text-text-muted">
                <span>{t('survey.scaleLow')}</span>
                <span>{t('survey.scaleHigh')}</span>
              </p>
            </fieldset>
            <TextArea
              id="survey-comment"
              label={t('survey.comment')}
              value={comentario}
              onChange={setComentario}
              maxLength={1000}
              rows={3}
            />
            {error ? (
              <p role="alert" className="text-body-sm text-danger">
                {t(error)}
              </p>
            ) : null}
            <PrimaryButton type="submit" disabled={puntaje === null} loading={responder.isPending}>
              {t('survey.submit')}
            </PrimaryButton>
          </form>
        )}
      </main>
    </div>
  )
}
