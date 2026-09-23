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

// **M2-D5 filas 38, 44c y 44d** — captura 38-DEVELOPER-SPECIFIC-PROJECT-UPLOAD-
// EVIDENCE. Test IDs: DEV-EVIDENCE-UPLOAD-001, DEV-ANCHOR-SUCCESS-001.
// Patrones: P4 y P5.
//
// **Es el paso 1 y 2 del flujo de evidencia** (M2-D1 §6), y la única pantalla
// de la app donde se produce una prueba nueva.
//
// La estructura sale de la captura: card "Seleccionar etapa" con los chips en
// scroll horizontal, y card de la etapa elegida con el dropzone, las notas
// opcionales y el botón de anclar.
//
// **La subida es por LOTE (SPEC-218):** todos los archivos elegidos viajan en UN
// request y producen un bundle y un anclaje. Si el backend rechaza alguno (tipo
// real no permitido, repetido, ya subido a la etapa), el resto entra igual y el
// rechazado **queda en la lista con su motivo**: nada desaparece sin decir por qué.
// Antes se subía solo el primero y el resto se perdía sin aviso.
//
// **El modal de éxito es la ÚNICA superficie de prueba que se abre sola**
// (M2-D4 §6.3) — y solo tras un anclaje exitoso, nunca al entrar. El TXID y el
// Merkle root llegan en la misma respuesta del POST (M2-D5 §2.2), así que no
// hay un segundo request que pueda fallar y dejar el modal sin qué mostrar.

export const Route = createFileRoute('/developer/project/$projectId/upload')({
  component: UploadEvidence
})

/** Un rechazo del backend tal como viaja en `rejected` (`{ index, code }`). */
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

/** Los rechazos de un `400 NO_FILES_ACCEPTED`, o `null` si el error es otro. */
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
  // El motivo por el que el BACKEND rechazó cada archivo que quedó en la lista, y
  // si el lote entró a medias o no entró nada.
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
    // La etapa entra por parámetro, como el monto en `invite`: el único que llama a
    // `mutate` es el botón, y solo existe con una etapa elegida — el tipo lo garantiza.
    mutationFn: async ({ enviados, stageId: etapaId }: { enviados: File[]; stageId: string }) => {
      const form = new FormData()
      // Todos en un request: `file` repetido. El bundle es UNO, con una hoja por
      // archivo aceptado, y el anclaje también.
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
      // Salen de la lista los aceptados; los rechazados se quedan, con su motivo.
      const quedan = enviados.filter((_, i) => rechazados.has(i))
      setAnclado(resultado)
      setArchivos(quedan)
      marcarRechazados(enviados, resultado.rejected)
      setResumen(resultado.rejected.length > 0 ? 'partial' : null)
      if (quedan.length === 0) setNotas('')
      void queryClient.invalidateQueries({ queryKey: ['developer'] })
    },
    onError: (error, { enviados }) => {
      // `400 NO_FILES_ACCEPTED`: ninguno entró, y el cuerpo dice por qué cada uno.
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
          {/* Scroll horizontal, como la captura: los chips no se encogen. */}
          <div className="-mx-s4 flex gap-s2 overflow-x-auto px-s4 pb-s1">
            {proyecto?.stages.map((s) => (
              <StageChip
                key={s.id}
                number={s.sequenceOrder}
                label={s.name}
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
              // Sin `maxSizeMb`: el tope sale de `packages/shared`, el mismo que aplica el backend.
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

      {/* P4 — la confirmación post-anclaje. Se abre sola porque el sistema la
          emite tras un anclaje exitoso; es la única excepción de M2-D4 §6.3. */}

      {/* Solo con TXID: si el anclaje quedó `Failed`, el archivo y su hash
            están escritos pero la prueba no existe, y el modal de éxito
            afirmaría lo que la regla 17 prohíbe. En ese caso se muestra el
            aviso de pendiente y nada más. */}
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
