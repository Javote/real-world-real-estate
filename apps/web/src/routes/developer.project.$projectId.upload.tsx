import {
  EVIDENCE_MAX_FILE_MB,
  EVIDENCE_MAX_FILES,
  EVIDENCE_REJECTION_CODES,
  type EvidenceRejectionCode
} from '@plataforma/shared/evidence-rules'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { ApiError, api } from '#/api/port'
import type { StageEvidenceAnchor } from '#/api/types'
import { DEV_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { AnchoringSuccessModal } from '#/components/domain/AnchoringSuccessModal'
import { StageChip } from '#/components/domain/Chips'
import { FileDropzone } from '#/components/domain/FileDropzone'
import { PrimaryButton } from '#/components/domain/PrimaryButton'
import { TextArea } from '#/components/domain/TextArea'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL } from '#/lib/cardShell'
import { cn } from '#/lib/cn'

export const Route = createFileRoute('/developer/project/$projectId/upload')({
  component: UploadEvidence
})

interface RechazoDelServidor {
  index: number
  code: EvidenceRejectionCode
}

function esRechazo(x: unknown): x is RechazoDelServidor {
  if (typeof x !== 'object' || x === null) return false
  const { index, code } = x as Record<string, unknown>
  return (
    typeof index === 'number' && (EVIDENCE_REJECTION_CODES as readonly unknown[]).includes(code)
  )
}

function rechazosDeUnError(error: unknown): RechazoDelServidor[] | null {
  if (!(error instanceof ApiError) || typeof error.body !== 'object' || error.body === null) {
    return null
  }
  const { code, rejected } = error.body as Record<string, unknown>
  if (code !== 'NO_FILES_ACCEPTED' || !Array.isArray(rejected)) return null
  return rejected.filter(esRechazo)
}

function UploadEvidence() {
  const { projectId } = Route.useParams()
  const { ready } = useRoleGuard(DEV_ROLES)
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [stageId, setStageId] = useState<string | null>(null)
  const [archivos, setArchivos] = useState<File[]>([])
  const [notas, setNotas] = useState('')
  const [anclado, setAnclado] = useState<StageEvidenceAnchor | null>(null)
  const [avisos, setAvisos] = useState<ReadonlyMap<File, string>>(new Map())
  const [resumen, setResumen] = useState<'partial' | 'none' | null>(null)

  const { data: proyecto } = useQuery({
    queryKey: ['developer', 'project', projectId],
    queryFn: () => api.getDeveloperProject(projectId),
    enabled: ready
  })

  const marcarRechazados = (enviados: readonly File[], rechazos: readonly RechazoDelServidor[]) => {
    setAvisos(
      new Map(
        rechazos.flatMap((r) => {
          const archivo = enviados[r.index]
          return archivo ? [[archivo, t(`developer.upload.serverRejected.${r.code}`)] as const] : []
        })
      )
    )
  }

  const subir = useMutation({
    mutationFn: async ({ enviados, stageId: etapaId }: { enviados: File[]; stageId: string }) => {
      const form = new FormData()
      for (const archivo of enviados) form.append('file', archivo)
      form.append('evidenceType', 'document')
      form.append('category', notas.trim() ? 'inspection' : 'document')
      return api.uploadStageEvidence(projectId, etapaId, form)
    },
    onMutate: () => {
      setAvisos(new Map())
      setResumen(null)
    },
    onSuccess: (resultado, { enviados }) => {
      const rechazados = new Set(resultado.rejected.map((r) => r.index))
      const quedan = enviados.filter((_, i) => rechazados.has(i))
      setAnclado(resultado)
      setArchivos(quedan)
      marcarRechazados(enviados, resultado.rejected)
      setResumen(resultado.rejected.length > 0 ? 'partial' : null)
      if (quedan.length === 0) setNotas('')
      void queryClient.invalidateQueries({ queryKey: ['developer'] })
    },
    onError: (error, { enviados }) => {
      const rechazos = rechazosDeUnError(error)
      if (!rechazos) return
      marcarRechazados(enviados, rechazos)
      setResumen('none')
    }
  })

  if (!ready) return null

  const etapaElegida = proyecto?.stages.find((s) => s.id === stageId)
  const puedeAnclar = stageId !== null && archivos.length > 0 && !subir.isPending

  return (
    <PanelLayout
      rol="developer"
      title={t('developer.upload.title')}
      context={t('developer.upload.context')}
      back={{
        label: t('nav.back'),
        onClick: () =>
          void navigate({
            to: '/developer/project/$projectId',
            params: { projectId }
          })
      }}
    >
      <section className="flex flex-col gap-s4" data-testid="DEV-EVIDENCE-UPLOAD-001">
        <article className={cn('flex flex-col gap-s2', CARD_SHELL)}>
          <h2 className="text-body-sm text-text-muted">{t('developer.upload.selectStage')}</h2>
          <div className="flex flex-wrap gap-s2">
            {proyecto?.stages.map((s) => (
              <StageChip
                key={s.id}
                number={s.sequenceOrder}
                selected={s.id === stageId}
                onSelect={() => setStageId(s.id)}
                ariaLabel={t('developer.upload.stageAria', {
                  number: String(s.sequenceOrder),
                  name: s.name
                })}
              />
            ))}
          </div>
        </article>

        {etapaElegida ? (
          <article className={cn('flex flex-col gap-s3', CARD_SHELL)}>
            <div className="flex flex-col">
              <span className="text-body-sm text-text-muted">
                {t('developer.upload.selectedStage')}
              </span>
              <span className="text-h2 font-bold text-text-primary">
                {etapaElegida.sequenceOrder}. {etapaElegida.name}
              </span>
            </div>

            <FileDropzone
              files={archivos}
              onChange={setArchivos}
              disabled={subir.isPending}
              notes={avisos}
              labels={{
                primary: t('developer.upload.dropzone'),
                secondary: t('developer.upload.dropzoneHint'),
                remove: t('developer.upload.remove'),
                rejected: (nombre, motivo) =>
                  t(`developer.upload.rejected.${motivo}`, {
                    name: nombre,
                    max: String(motivo === 'size' ? EVIDENCE_MAX_FILE_MB : EVIDENCE_MAX_FILES)
                  })
              }}
            />

            <TextArea
              id="upload-notes"
              label={t('developer.upload.notes')}
              placeholder={t('developer.upload.notesPlaceholder')}
              value={notas}
              onChange={setNotas}
              maxLength={2000}
              disabled={subir.isPending}
            />

            <PrimaryButton
              onClick={() => subir.mutate({ enviados: archivos, stageId: etapaElegida.id })}
              disabled={!puedeAnclar}
            >
              <ShieldCheck className="size-icon-inline" aria-hidden="true" />
              {subir.isPending ? t('developer.upload.anchoring') : t('developer.upload.anchor')}
            </PrimaryButton>

            {resumen ? (
              <p role="status" className="text-body-sm text-danger">
                {t(
                  resumen === 'none' ? 'developer.upload.noneAccepted' : 'developer.upload.partial'
                )}
              </p>
            ) : null}

            {subir.isError && resumen !== 'none' ? (
              <p className="text-body-sm text-danger">{t('developer.upload.error')}</p>
            ) : null}
          </article>
        ) : null}
      </section>

      {anclado?.anchor.txid ? (
        <AnchoringSuccessModal
          open
          testId="DEV-ANCHOR-SUCCESS-001"
          onDone={() => setAnclado(null)}
          merkleRoot={anclado.merkleRoot}
          txid={anclado.anchor.txid}
          labels={{
            title: t('developer.anchorSuccess.title'),
            body: t('developer.anchorSuccess.body'),
            merkleLabel: t('developer.anchorSuccess.merkle'),
            txidLabel: t('hash.txidLabel'),
            copy: t('hash.copy'),
            copied: t('hash.copied'),
            openExplorer: t('developer.anchorSuccess.explorer'),
            done: t('developer.anchorSuccess.done')
          }}
        />
      ) : null}

      {anclado && !anclado.anchor.txid ? (
        <p className="rounded-lg bg-pending-light p-s3 text-body-sm text-pending">
          {t('developer.upload.anchorPending')}
        </p>
      ) : null}
    </PanelLayout>
  )
}
