import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AlertCircle, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { api } from '#/api/port'
import { CERTIFIER_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { DocumentCard } from '#/components/domain/DocumentCard'
import { ObserveStageModal } from '#/components/domain/ObserveStageModal'
import { PrimaryButton, SecondaryButton } from '#/components/domain/PrimaryButton'
import { StatusPill } from '#/components/domain/StatusPill'
import { PanelLayout } from '#/components/PanelLayout'
import { formatDate } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'

// **M2-D5 filas 56v, 56c y 57** — captura 56-CERTIFIER-CERTIFY-STAGE y
// 57-...-OBSERVE.
//
// Tres superficies del backlog en una pantalla, porque así las dibuja la
// captura: la vista del stage, la acción de certificar y el modal de observar.
//
// Test IDs: CER-STAGE-VIEW-001, CER-CERTIFY-001, CER-OBSERVE-001.
//
// **La barra de acciones va fija al pie** (captura 56): "Observe" secundario a
// la izquierda, "Certify" primario a la derecha. Es la única pantalla del rol
// donde una decisión irreversible está a un toque — M2-D3 §Principio 5, "make
// the irreversible visible".

export const Route = createFileRoute('/certifier/stage/$stageId')({
  component: CertifyStage
})

function CertifyStage() {
  const { stageId } = Route.useParams()
  const { ready } = useRoleGuard(CERTIFIER_ROLES)
  const { t, locale } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [observando, setObservando] = useState(false)

  const { data: stage } = useQuery({
    queryKey: ['certifier', 'stage', stageId],
    queryFn: () => api.getCertifierStage(stageId),
    enabled: ready
  })

  // Certificar y observar invalidan lo mismo: el panel cuenta stages por estado
  // y la lista de asignados sale de ahí.
  const alTerminar = () => {
    void queryClient.invalidateQueries({ queryKey: ['certifier'] })
    void navigate({ to: '/certifier' })
  }

  const certificar = useMutation({
    mutationFn: () => api.certifyStage(stageId),
    onSuccess: alTerminar
  })

  const observar = useMutation({
    mutationFn: (note: string) => api.observeStage(stageId, note),
    onSuccess: () => {
      setObservando(false)
      alTerminar()
    }
  })

  if (!ready) return null

  // **Un stage sin evidencia no se puede certificar** y la pantalla lo dice en
  // vez de esconder el botón: el certifier tiene que entender por qué no puede,
  // no descubrir que la acción desapareció.
  const sinEvidencia = (stage?.evidence.length ?? 0) === 0
  const yaCerrado = stage?.state === 'Completed'

  return (
    <PanelLayout
      rol="certifier"
      title={t('certifier.stage.title')}
      {...(stage ? { context: `${stage.projectName} · ${stage.name}` } : {})}
    >
      <section className="flex flex-col gap-s4" data-testid="CER-STAGE-VIEW-001">
        {stage ? (
          <article className="flex flex-col gap-s1 rounded-xl bg-card p-s4 shadow-e1">
            <div className="flex items-start justify-between gap-s3">
              <span className="text-body-sm text-text-muted">
                {t('certifier.stage.number', { number: String(stage.sequenceOrder) })}
              </span>
              <StatusPill tone={yaCerrado ? 'verified' : 'pending'}>
                {yaCerrado ? t('status.certified') : t('status.pending')}
              </StatusPill>
            </div>
            <h2 className="text-h2 font-bold text-text-primary">{stage.name}</h2>
          </article>
        ) : null}

        <article className="flex flex-col gap-s3 rounded-xl bg-card p-s4 shadow-e1">
          <h3 className="text-body font-bold text-text-primary">
            {t('certifier.stage.evidenceTitle')}
          </h3>

          {sinEvidencia ? (
            // El empty-state es parte del diseño (fila 56v), no un error.
            <p className="py-s4 text-center text-body-sm text-text-muted">
              {t('certifier.stage.noEvidence')}
            </p>
          ) : (
            <ul className="flex flex-col gap-s2">
              {stage?.evidence.map((e) => (
                <li key={e.id}>
                  <DocumentCard
                    filename={e.originalFilename}
                    uploadedAtLabel={formatDate(String(e.uploadedAt), locale)}
                    format={e.category}
                    sha256={e.sha256Hash}
                    // Todavía no hay TXID por archivo en esta respuesta: el
                    // anclaje se produce AL certificar. Mostrarlo como
                    // verificado antes sería exactamente lo que la regla 17
                    // prohíbe.
                    txid={null}
                    showHash
                    labels={{
                      verified: t('status.verified'),
                      pending: t('status.pending'),
                      view: t('document.view'),
                      download: t('document.download'),
                      copy: t('hash.copy'),
                      copied: t('hash.copied'),
                      hashLabel: t('hash.label')
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      {/* Barra de acciones al pie, como la captura. */}
      {!yaCerrado ? (
        <div className="flex gap-s3">
          <SecondaryButton
            className="flex-1"
            onClick={() => setObservando(true)}
            disabled={observar.isPending || certificar.isPending}
          >
            <AlertCircle className="size-icon-inline" aria-hidden="true" />
            {t('certifier.stage.observe')}
          </SecondaryButton>

          <PrimaryButton
            className="flex-1"
            testId="CER-CERTIFY-001"
            onClick={() => certificar.mutate()}
            disabled={sinEvidencia || certificar.isPending}
          >
            <ShieldCheck className="size-icon-inline" aria-hidden="true" />
            {certificar.isPending ? t('certifier.stage.certifying') : t('certifier.stage.certify')}
          </PrimaryButton>
        </div>
      ) : null}

      {certificar.isError ? (
        <p className="text-body-sm text-danger">{t('certifier.stage.error')}</p>
      ) : null}

      <div data-testid="CER-OBSERVE-001">
        <ObserveStageModal
          open={observando}
          onClose={() => setObservando(false)}
          onSubmit={(note) => observar.mutate(note)}
          submitting={observar.isPending}
          labels={{
            title: t('certifier.observe.title'),
            helper: t('certifier.observe.helper'),
            noteLabel: t('certifier.observe.noteLabel'),
            notePlaceholder: t('certifier.observe.notePlaceholder'),
            cancel: t('common.cancel'),
            send: t('certifier.observe.send'),
            sending: t('certifier.observe.sending')
          }}
        />
      </div>
    </PanelLayout>
  )
}
