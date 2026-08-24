import { Upload, X } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { cn } from '#/lib/cn'

// M2-D3 §Forms & Controls · FileDropzone — el área de subida con la que se arma
// un bundle de evidencia (captura 38).
//
// **Los tipos y el tamaño se validan acá Y en el servidor.** La regla 10 fija
// `application/pdf`, `image/jpeg`, `image/png` y un máximo; esta validación es
// de conveniencia —le ahorra al usuario subir 10 MB para que lo rechacen—, no
// es la que protege. La que protege es la del backend, que además borra el
// archivo huérfano si el rechazo llega después de escribirlo.
//
// **No sube nada.** Junta archivos y avisa; quien lo usa decide cuándo y cómo
// mandarlos. Un dropzone que dispara la request sola haría un anclaje sin que
// el usuario lo pida, y toda superficie de prueba la inicia el usuario
// (M2-D4 §6.3).

/** Regla 10 — los únicos tipos que el backend acepta. */
export const TIPOS_ACEPTADOS = ['application/pdf', 'image/jpeg', 'image/png'] as const

interface FileDropzoneProps {
  files: readonly File[]
  onChange: (files: File[]) => void
  labels: {
    /** "Arrastrá archivos o tocá para elegir" */
    primary: string
    /** Línea secundaria de ayuda. */
    secondary?: string
    remove: string
    /** Se muestra cuando un archivo no pasa el filtro de tipo o tamaño. */
    rejected: (nombre: string) => string
  }
  maxSizeMb?: number
  disabled?: boolean
  className?: string
}

export function FileDropzone({
  files,
  onChange,
  labels,
  maxSizeMb = 10,
  disabled,
  className
}: FileDropzoneProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [encima, setEncima] = useState(false)
  const [rechazados, setRechazados] = useState<string[]>([])

  const aceptar = (entrantes: FileList | null) => {
    if (!entrantes) return
    const buenos: File[] = []
    const malos: string[] = []

    for (const f of Array.from(entrantes)) {
      const tipoOk = (TIPOS_ACEPTADOS as readonly string[]).includes(f.type)
      const tamanoOk = f.size <= maxSizeMb * 1024 * 1024
      if (tipoOk && tamanoOk) buenos.push(f)
      else malos.push(f.name)
    }

    setRechazados(malos)
    if (buenos.length > 0) onChange([...files, ...buenos])
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
          if (!disabled) aceptar(e.dataTransfer.files)
        }}
        className={cn(
          'flex flex-col items-center gap-s2 rounded-lg border-2 border-dashed px-s4 py-s6 text-center',
          encima ? 'border-primary border-solid bg-primary-light' : 'border-border bg-surface-alt',
          disabled && 'opacity-50'
        )}
      >
        <Upload className="size-icon-lg text-text-muted" aria-hidden="true" />

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
          ref={inputRef}
          type="file"
          multiple
          accept={TIPOS_ACEPTADOS.join(',')}
          disabled={disabled}
          className="sr-only"
          onChange={(e) => {
            aceptar(e.target.files)
            // Se limpia para que elegir el MISMO archivo dos veces vuelva a
            // disparar `change`. Sin esto, quitar un archivo y volver a
            // elegirlo no hace nada y parece que la app se colgó.
            if (inputRef.current) inputRef.current.value = ''
          }}
        />
      </div>

      {rechazados.length > 0 ? (
        <ul className="flex flex-col gap-s1">
          {rechazados.map((nombre) => (
            <li key={nombre} className="text-caption text-danger">
              {labels.rejected(nombre)}
            </li>
          ))}
        </ul>
      ) : null}

      {files.length > 0 ? (
        <ul className="flex flex-col gap-s1">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${f.size}`}
              className="flex items-center justify-between gap-s2 rounded-md bg-surface-alt px-s3 py-s2"
            >
              <span className="min-w-0 flex-1 truncate text-body-sm text-text-secondary">
                {f.name}
              </span>
              <button
                type="button"
                aria-label={labels.remove}
                disabled={disabled}
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="text-text-muted hover:text-danger"
              >
                <X className="size-icon-sm" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
