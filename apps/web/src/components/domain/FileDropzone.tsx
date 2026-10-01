import {
  EVIDENCE_ALLOWED_MIME,
  EVIDENCE_MAX_FILE_MB,
  EVIDENCE_MAX_FILES
} from '@plataforma/shared/evidence-rules'
import { Upload, X } from 'lucide-react'
import { useId, useState } from 'react'
import { cn } from '#/lib/cn'
import { clasificarEntrantes, type MotivoLocal, type RechazoLocal } from '#/lib/evidenceFiles'

interface FileDropzoneProps {
  files: readonly File[]
  onChange: (files: File[]) => void
  labels: {
    primary: string
    secondary?: string
    remove: string
    rejected: (nombre: string, motivo: MotivoLocal) => string
  }
  notes?: ReadonlyMap<File, string>
  maxSizeMb?: number
  maxFiles?: number
  allowedMime?: readonly string[]
  disabled?: boolean
  className?: string
}

export function FileDropzone({
  files,
  onChange,
  labels,
  notes,
  maxSizeMb = EVIDENCE_MAX_FILE_MB,
  maxFiles = EVIDENCE_MAX_FILES,
  allowedMime = EVIDENCE_ALLOWED_MIME,
  disabled,
  className
}: FileDropzoneProps) {
  const inputId = useId()
  const [encima, setEncima] = useState(false)
  const [rechazados, setRechazados] = useState<RechazoLocal[]>([])

  const aceptar = async (entrantes: FileList | null) => {
    if (!entrantes) return
    const lista = Array.from(entrantes)
    const { aceptados, rechazados: malos } = await clasificarEntrantes(lista, files, {
      maxBytes: maxSizeMb * 1024 * 1024,
      maxFiles,
      allowedMime
    })

    setRechazados(malos)
    if (aceptados.length > 0) onChange([...files, ...aceptados])
  }

  return (
    <div className={cn('flex flex-col gap-s2', className)}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: el control real es
          el <input type="file"> de abajo, que sí es focuseable y accesible por
          teclado. Este div solo agrega arrastrar-y-soltar, que es un extra de
          mouse: sin él, la superficie sigue siendo completamente usable. */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setEncima(true)
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault()
          setEncima(false)
          if (!disabled) void aceptar(e.dataTransfer.files)
        }}
        className={cn(
          'flex flex-col items-center gap-s2 rounded-lg border-2 border-dashed px-s4 py-s6 text-center',
          encima ? 'border-primary border-solid bg-primary-light' : 'border-border bg-surface-alt',
          disabled && 'opacity-50'
        )}
      >
        <Upload className="size-icon-empty text-text-muted" aria-hidden="true" />

        <label
          htmlFor={inputId}
          className={cn(
            'text-body font-medium text-primary',
            disabled ? 'cursor-not-allowed' : 'cursor-pointer'
          )}
        >
          {labels.primary}
        </label>

        {labels.secondary ? (
          <span className="text-caption text-text-muted">{labels.secondary}</span>
        ) : null}

        <input
          id={inputId}
          type="file"
          multiple={maxFiles > 1}
          accept={allowedMime.join(',')}
          disabled={disabled}
          className="sr-only"
          onChange={(e) => {
            void aceptar(e.target.files)
            // Sin esto, volver a elegir el mismo archivo no dispara `change`.
            e.currentTarget.value = ''
          }}
        />
      </div>

      {rechazados.length > 0 ? (
        <ul className="flex flex-col gap-s1">
          {rechazados.map(({ file, motivo }, i) => (
            <li key={`${file.name}-${file.size}-${i}`} className="text-caption text-danger">
              {labels.rejected(file.name, motivo)}
            </li>
          ))}
        </ul>
      ) : null}

      {files.length > 0 ? (
        <ul className="flex flex-col gap-s1">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${f.size}-${i}`}
              className="flex items-center justify-between gap-s2 rounded-md bg-surface-alt px-s3 py-s2"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body-sm text-text-secondary">{f.name}</span>
                {notes?.get(f) ? (
                  <span className="text-caption text-danger">{notes.get(f)}</span>
                ) : null}
              </span>
              <button
                type="button"
                aria-label={labels.remove}
                disabled={disabled}
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="text-text-muted hover:text-danger"
              >
                <X className="size-icon-inline" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
