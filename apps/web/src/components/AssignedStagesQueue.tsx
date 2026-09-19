import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { api } from '#/api/port'
import { Loading } from '#/components/domain/Loading'
import { SecondaryButton } from '#/components/domain/PrimaryButton'
import { useTranslation } from '#/i18n/useTranslation'

// La cola de etapas asignadas al certifier (M2-D5 fila 55).
//
// Vive suelta porque aparece en DOS lugares —el panel y la solapa "Assigned"—
// y duplicarla garantizaría que se desincronicen. No es un componente de
// M2-D3: es composición, como `PanelLayout`.

export function AssignedStagesQueue() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: asignados, isPending } = useQuery({
    queryKey: ['certifier', 'assignments'],
    queryFn: api.getCertifierAssignments
  })

  if (isPending) return <Loading />

  if (!asignados?.length) {
    return (
      <p className="mt-s3 text-body-sm text-text-muted">{t('panel.certifier.emptyAssigned')}</p>
    )
  }

  return (
    <ul className="mt-s4 flex flex-col gap-s2">
      {asignados.map((asignacion) => (
        <li
          key={asignacion.stageId}
          // SPEC-106 (F-11): mismo defecto que PendingDossiersQueue —
          // `bg-surface-alt` (gris) donde el resto de las listas de la app
          // usa `bg-card`. La spec solo nombraba la cola del escribano, pero
          // la invariante 2 ("todas las listas comparten fondo") es general
          // y esta es la misma cola-tarjeta con el mismo copy-paste.
          className="flex items-center justify-between gap-s3 rounded-lg bg-card p-s3"
        >
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-body font-bold text-text-primary">
              {asignacion.projectName}
            </span>
            <span className="truncate text-body-sm text-text-muted">
              {t('panel.certifier.stageLine', {
                number: String(asignacion.sequenceOrder),
                name: asignacion.stageName
              })}
            </span>
          </div>

          {/* La captura muestra un pill compacto de borde naranja: es el
              SecondaryButton con el token `pending`, no un componente nuevo.
              SPEC-105 (F-08): el botón navega — un Link envolviéndolo era un
              elemento interactivo anidado dentro de otro. */}
          <SecondaryButton
            className="shrink-0 border-pending px-s3 py-s1 text-body-sm text-pending"
            onClick={() =>
              void navigate({
                to: '/certifier/stage/$stageId',
                params: { stageId: asignacion.stageId }
              })
            }
          >
            {t('panel.certifier.certify')}
          </SecondaryButton>
        </li>
      ))}
    </ul>
  )
}
