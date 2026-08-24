import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Une clases resolviendo conflictos de Tailwind: la última gana.
 *
 * Es el helper de shadcn/ui, y hace falta porque los componentes de M2-D3
 * tienen variantes que pisan la misma propiedad —un `PrimaryButton` deshabilitado
 * cambia el fondo que ya puso la variante base—. Sin `twMerge`, quedan las dos
 * clases y gana la que el compilador puso última, que no es la que se quiso.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
