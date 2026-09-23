import {
  EVIDENCE_ALLOWED_MIME,
  EVIDENCE_MAX_FILE_MB,
  EVIDENCE_MAX_FILES
} from '@plataforma/shared/evidence-rules'
import { Upload, X } from 'lucide-react'
import { useId, useState } from 'react'
import { cn } from '#/lib/cn'
import { clasificarEntrantes, type MotivoLocal, type RechazoLocal } from '#/lib/evidenceFiles'

// M2-D3 §Forms & Controls · FileDropzone — el área de subida con la que se arma
// un bundle de evidencia (captura 38).
//
// **Los archivos se validan acá Y en el servidor, con las MISMAS reglas.** La
// regla 10 fija `application/pdf`, `image/jpeg`, `image/png` y un máximo; el tope
// de tamaño, el de archivos por subida y la detección del tipo real por los
// primeros bytes viven en `packages/shared/evidence-rules` y los importan los dos
// lados (SPEC-218) — antes eran un `50` a mano acá y una variable de entorno allá.
// Además se rechaza un archivo repetido (mismo SHA-256) dentro de la lista.
// Esta validación es de conveniencia —le ahorra al usuario subir un archivo pesado
// para que lo rechacen—, no es la que protege. La que protege es la del backend,
// que además no deja archivos huérfanos ante un rechazo. Todo lo que el navegador
// no pueda comprobar **falla abierto** y lo decide el backend (`lib/evidenceFiles`).
//
// **No sube nada.** Junta archivos y avisa; quien lo usa decide cuándo y cómo
// mandarlos. Un dropzone que dispara la request sola haría un anclaje sin que
// el usuario lo pida, y toda superficie de prueba la inicia el usuario
// (M2-D4 §6.3).

interface FileDropzoneProps {
  files: readonly File[]
  onChange: (files: File[]) => void
  labels: {
    /** "Arrastrá archivos o tocá para elegir" */
    primary: string
    /** Línea secundaria de ayuda. */
    secondary?: string
    remove: string
    /** Se muestra cuando un archivo no pasa el filtro, con el motivo. */
    rejected: (nombre: string, motivo: MotivoLocal) => string
  }
  /**
   * Un aviso por archivo ya elegido (p. ej. el motivo por el que el BACKEND lo
   * rechazó y quedó en la lista para que el usuario lo vea). Sin él, un archivo
   * rechazado desaparecería sin decir por qué.
   */
  notes?: ReadonlyMap<File, string>
  /** Por defecto, el tope de `packages/shared` (`EVIDENCE_MAX_FILE_MB`). Solo los tests lo bajan. */
  maxSizeMb?: number
  /** Por defecto, el tope de `packages/shared` (`EVIDENCE_MAX_FILES`). */
  maxFiles?: number
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
  disabled,
  className
}: FileDropzoneProps) {
  const inputId = useId()
  const [encima, setEncima] = useState(false)
  const [rechazados, setRechazados] = useState<RechazoLocal[]>([])

  const aceptar = async (entrantes: FileList | null) => {
    if (!entrantes) return
    // Se copia ANTES del primer `await`: el <input> se vacía apenas vuelve el
    // handler, y un `FileList` vaciado ya no tiene los archivos.
    const lista = Array.from(entrantes)
    const { aceptados, rechazados: malos } = await clasificarEntrantes(lista, files, {
      maxBytes: maxSizeMb * 1024 * 1024,
      maxFiles
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
          multiple
          accept={EVIDENCE_ALLOWED_MIME.join(',')}
          disabled={disabled}
          className="sr-only"
          onChange={(e) => {
            void aceptar(e.target.files)
            // Se limpia para que elegir el MISMO archivo dos veces vuelva a
            // disparar `change`. Sin esto, quitar un archivo y volver a
            // elegirlo no hace nada y parece que la app se colgó.
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
