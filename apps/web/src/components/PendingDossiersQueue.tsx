import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { api } from '#/api/port'
import { SecondaryButton } from '#/components/domain/PrimaryButton'
import { ProgressBar } from '#/components/domain/ProgressBar'
import { useTranslation } from '#/i18n/useTranslation'

// La cola de dossiers pendientes de revisión (M2-D5 fila 51).
//
// Igual que `AssignedStagesQueue`: aparece en el panel y en la solapa
// "Dossiers", así que vive una sola vez.
//
// **`completeness` es cuánta prueba está sustanciada**, no cuán listo está el
// dossier (regla 17): la barra mide qué fracción de sus artefactos tiene TXID.

export function PendingDossiersQueue() {
  const { t } = useTranslation()
  const { data: pendientes } = useQuery({
    queryKey: ['notary', 'pending'],
    queryFn: api.getNotaryPendingDossiers
  })

  if (!pendientes?.length) {
    return <p className="mt-s3 text-body-sm text-text-muted">{t('panel.notary.emptyPending')}</p>
  }

  return (
    <ul className="mt-s4 flex flex-col gap-s3">
      {pendientes.map((d) => (
        <li key={d.dossierId} className="flex flex-col gap-s2 rounded-lg bg-surface-alt p-s3">
          <div className="flex items-center justify-between gap-s3">
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-body font-bold text-text-primary">{d.unitLabel}</span>
              <span className="truncate text-body-sm text-text-muted">{d.investorName}</span>
            </div>

            <Link to="/notary/dossier/$dossierId" params={{ dossierId: d.dossierId }}>
              <SecondaryButton className="shrink-0 px-s3 py-s1 text-body-sm">
                {t('panel.notary.review')}
              </SecondaryButton>
            </Link>
          </div>

          <ProgressBar percent={d.completeness} showValue />
        </li>
      ))}
    </ul>
  )
}
