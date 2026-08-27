import { Building2, Calendar, MapPin } from 'lucide-react'
import { ProgressBar } from './ProgressBar'
import { StatusPill, type StatusTone } from './StatusPill'

// M2-D3 §Cards · ProjectCard — la card de listado de un proyecto.
//
// "Card is fully tappable; entire surface routes to project detail" y "progress
// bar is required when status ≠ Delivered".
//
// **Los campos que el contrato todavía no da** —imagen de portada, precio
// desde, rango de m², nombre del developer— se dibujan como ausencia, no como
// dato falso: sin imagen va una superficie neutra, sin precio no va la línea.
// La captura 2 los muestra porque **la maqueta usa datos mock** (M2-D1); lo
// normativo de una captura es la estructura, no los valores. El detalle de
// cuál falta y por qué está en los props `priceLabel` y `developerName`.
//
// **`variant="developer"` es una excepción a la anatomía que describe M2-D3**
// ("From <price> label, location, m² range, status pill" + pie de progreso).
// Las capturas 35/36 (`/developer/projects`) muestran otra cosa: nombre + pill
// arriba, precio/unidades en dos columnas, fecha, y recién abajo — solo si el
// proyecto no está entregado — una sección de progreso propia. Regla 1 de
// CLAUDE.md: cuando la captura y la prosa difieren, gana la captura.

interface ProjectCardProps {
  name: string
  location?: string | null
  status: { label: string; tone: StatusTone }
  /** 0-100. Ausente quiere decir "sin barra" — no se infiere de `status`. */
  progress?: number | null
  imageUrl?: string | null
  /**
   * **DEUDA DECLARADA — el dato NO EXISTE en el modelo, y llenarlo es una
   * migración.**
   *
   * Las capturas lo piden dos veces: el chip sobre la portada ("Grupo Alpine",
   * capturas 2/13) y el subtítulo del header de la fila 35-36 ("3 projects by
   * Grupo Alpine"). Pero no hay entidad de organización en ningún lado:
   * `UserTable` tiene `fullName`, que es una PERSONA, y `ProjectTable` no tiene
   * dueño-empresa — el vínculo es `ProjectMember`, usuario ↔ proyecto.
   *
   * Poner el `fullName` del developer acá diría que el desarrollo lo hace una
   * persona física, que es una afirmación distinta y probablemente falsa. Por
   * eso el prop es opcional y sin dato no se dibuja el chip.
   *
   * Es 🟡 amarillo: tabla nueva o columna nueva + migración.
   */
  developerName?: string | null
  /**
   * El "Price from" de las capturas 2/13/35/36. **Es una AGREGACIÓN, no un
   * campo**: no existe precio a nivel `Project`, el precio vive en la unidad
   * (`UnitTable.priceMinorUnits` + `currency`), y el "desde" es el mínimo de
   * las unidades del proyecto.
   *
   * Lo calcula `GET /developer/projects` sobre TODAS las unidades y no solo
   * las disponibles, porque lo decide la captura: Belgrano Park está
   * "Delivered" y aun así muestra precio.
   *
   * Sigue siendo opcional: un proyecto sin unidades con precio —o que mezcla
   * monedas, donde el mínimo no significa nada— no tiene "desde" que mostrar,
   * y ahí no va la línea. El listado del investor todavía no lo agrega.
   */
  priceLabel?: string | null
  sizeLabel?: string | null
  /** Solo `variant="developer"`: "120 Unidades". */
  unitsLabel?: string | null
  /** Solo `variant="developer"`: "December 2027" o "Delivered in 2023". */
  dateLabel?: string | null
  onOpen: () => void
  labels: { from: string; units?: string; progress?: string }
  testId?: string
  variant?: 'buy' | 'developer'
}

export function ProjectCard({
  name,
  location,
  status,
  progress,
  imageUrl,
  developerName,
  priceLabel,
  sizeLabel,
  unitsLabel,
  dateLabel,
  onOpen,
  labels,
  testId,
  variant = 'buy'
}: ProjectCardProps) {
  const esDeveloper = variant === 'developer'

  return (
    <article className="overflow-hidden rounded-lg bg-card shadow-e1" data-testid={testId}>
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="relative aspect-video w-full bg-surface-alt">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            // Sin imagen: superficie neutra. Un placeholder ilustrado sugeriría
            // contenido que no existe.
            <span className="flex h-full w-full items-center justify-center text-disabled">
              <Building2 size={32} aria-hidden="true" />
            </span>
          )}

          {developerName ? (
            <span className="absolute bottom-s3 right-s3 flex items-center gap-s1 rounded-full bg-primary px-s3 py-s1 text-caption font-bold text-white">
              <Building2 size={14} aria-hidden="true" />
              {developerName}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-s2 p-s4">
          {esDeveloper ? (
            <div className="flex items-start justify-between gap-s2">
              {/* `min-w-0` + `break-words`: el que cede es el título, no el
                  pill. Sin esto un nombre largo sin espacios desborda la card
                  en vez de envolver. */}
              <span className="min-w-0 break-words text-h2 font-bold text-text-primary">
                {name}
              </span>
              <StatusPill tone={status.tone}>{status.label}</StatusPill>
            </div>
          ) : priceLabel ? (
            <div className="flex flex-col gap-s1">
              <span className="text-body-sm text-text-muted">{labels.from}</span>
              <span className="text-h2 font-bold text-text-primary">{priceLabel}</span>
            </div>
          ) : (
            <span className="text-h2 font-bold text-text-primary">{name}</span>
          )}

          {location ? (
            <span className="flex items-center gap-s1 text-body-sm text-text-secondary">
              <MapPin size={16} aria-hidden="true" />
              {location}
            </span>
          ) : null}

          {esDeveloper ? (
            priceLabel || unitsLabel ? (
              <div className="grid grid-cols-2 gap-s3">
                {priceLabel ? (
                  <div className="flex flex-col gap-s1">
                    <span className="text-body-sm text-text-muted">{labels.from}</span>
                    <span className="font-bold text-text-primary">{priceLabel}</span>
                  </div>
                ) : null}
                {unitsLabel ? (
                  <div className="flex flex-col gap-s1">
                    <span className="text-body-sm text-text-muted">{labels.units}</span>
                    <span className="font-bold text-text-primary">{unitsLabel}</span>
                  </div>
                ) : null}
              </div>
            ) : null
          ) : sizeLabel ? (
            <span className="text-body-sm text-text-muted">{sizeLabel}</span>
          ) : null}

          {esDeveloper && dateLabel ? (
            <span className="flex items-center gap-s1 text-body-sm text-text-muted">
              <Calendar size={16} aria-hidden="true" />
              {dateLabel}
            </span>
          ) : null}

          {!esDeveloper ? <StatusPill tone={status.tone}>{status.label}</StatusPill> : null}

          {progress != null ? (
            <div className="flex flex-col gap-s1">
              {esDeveloper ? (
                <div className="flex items-center justify-between text-body-sm text-text-secondary">
                  <span>{labels.progress}</span>
                  <span className="font-medium">{Math.round(progress)}%</span>
                </div>
              ) : null}
              <ProgressBar percent={progress} showValue={!esDeveloper} />
            </div>
          ) : null}
        </div>
      </button>
    </article>
  )
}
