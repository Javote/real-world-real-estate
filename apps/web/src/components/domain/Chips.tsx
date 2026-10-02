import { cn } from '#/lib/cn'

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
  number: number
  label?: string
  anchored?: boolean
  ariaLabel: string
}

export function StageChip({
  number,
  label,
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
        label ? 'shrink-0 whitespace-nowrap' : 'size-10 px-0 tabular-nums',
        selected ? SELECCIONADO : SIN_SELECCIONAR,
        anchored && !selected && 'ring-1 ring-verified',
        className
      )}
    >
      {label ? `${number}. ${label}` : number}
    </button>
  )
}
