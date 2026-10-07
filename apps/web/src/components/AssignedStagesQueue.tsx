import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { etapaQueries } from '#/api/queries'
import { Loading } from '#/components/domain/Loading'
import { SecondaryButton } from '#/components/domain/PrimaryButton'
import { useTranslation } from '#/i18n/useTranslation'

export function AssignedStagesQueue() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: asignados, isPending } = useQuery({
    ...etapaQueries.asignadas()
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
