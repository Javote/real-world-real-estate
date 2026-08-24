import { cn } from '#/lib/cn'

// M2-D3 §Forms & Controls · **FilterPill / CategoryChip / StageChip** — el
// entregable los describe en UNA ficha porque comparten anatomía: *"Capsule
// with horizontal padding. Selected — solid purple fill, white text.
// Unselected — light gray fill, dark text."*
//
// Viven en un archivo por la misma razón. Lo que los distingue es su regla de
// uso, no su forma, y esa diferencia sí está en el tipo de cada uno:
//
//   · **FilterPill**   — single-select dentro de un grupo (filtro de estado).
//   · **CategoryChip** — single-select sobre una lista con scroll horizontal.
//   · **StageChip**    — numérico 1-10, con los stages anclados distinguibles.
//
// **`StageChip` no es `StageChips`.** Este es el control de FORMULARIO con el
// que un developer elige a qué stage sube evidencia (captura 38). `StageChips`
// (plural) es el patrón P9 de M2-D4: la señal de anclaje por stage, de solo
// lectura. Misma palabra, dos cosas — el entregable las separa y nosotros
// también.

const BASE =
  'inline-flex items-center justify-center rounded-full px-s3 py-s1 text-body-sm transition-colors ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed'

const SELECCIONADO = 'bg-primary text-white font-medium'
const SIN_SELECCIONAR = 'bg-surface-alt text-text-secondary hover:bg-border'

interface ChipBaseProps {
  selected: boolean
  onSelect: () => void
  disabled?: boolean
  className?: string
}

/** Filtro de un grupo single-select. `aria-pressed` porque es un toggle. */
export function FilterPill({
  selected,
  onSelect,
  disabled,
  className,
  children
}: ChipBaseProps & { children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(BASE, selected ? SELECCIONADO : SIN_SELECCIONAR, className)}
    >
      {children}
    </button>
  )
}

/**
 * Chip de categoría sobre una lista con scroll horizontal.
 *
 * Idéntico al `FilterPill` en lo visual y distinto en lo semántico: va dentro
 * de un contenedor scrolleable y por eso no se encoge (`shrink-0`). Sin eso,
 * flex le come el ancho a los chips en vez de dejarlos scrollear, que es
 * exactamente lo que la captura 49 muestra que NO pasa.
 */
export function CategoryChip({
  selected,
  onSelect,
  disabled,
  className,
  children
}: ChipBaseProps & { children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(BASE, 'shrink-0', selected ? SELECCIONADO : SIN_SELECCIONAR, className)}
    >
      {children}
    </button>
  )
}

interface StageChipProps extends ChipBaseProps {
  /** 1-10. */
  number: number
  /**
   * Si ese stage ya tiene evidencia anclada. **Es una señal, no un permiso**:
   * un stage anclado se puede volver a elegir —se le suma evidencia y se ancla
   * otro bundle—, así que esto cambia el borde y nada más.
   */
  anchored?: boolean
  /** Para el lector de pantalla: "Etapa 3, anclada". */
  ariaLabel: string
}

export function StageChip({
  number,
  anchored,
  selected,
  onSelect,
  disabled,
  ariaLabel,
  className
}: StageChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        BASE,
        'size-10 px-0 tabular-nums',
        selected ? SELECCIONADO : SIN_SELECCIONAR,
        // El anclado se distingue con el teal de "verificado", que es el mismo
        // que usa el VerificationBadge: una sola señal para una sola idea.
        anchored && !selected && 'ring-1 ring-verified',
        className
      )}
    >
      {number}
    </button>
  )
}
