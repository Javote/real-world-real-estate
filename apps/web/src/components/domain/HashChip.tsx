import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { cn } from '#/lib/cn'

// M2-D3 §Foundation · HashChip — y **patrón P2 de M2-D4**.
//
// Tres reglas del entregable que este componente existe para cumplir:
//
// 1. **Truncar a 6+4 con elipsis**, siempre. "Never display the full
//    untruncated hex inline — only in the verification modal."
// 2. **La truncación es puramente visual.** El valor completo llega entero al
//    cliente (regla 16) y es el que se copia. Nunca se pre-trunca en la capa de
//    datos: el componente recibe el hash completo o no funciona.
// 3. **Tocar el chip abre el TxidModal** (P3), y ese modal jamás se abre solo
//    (M2-D4 §6.3). De ahí que `onOpenDetail` sea opcional: sin handler, el chip
//    es solo lectura + copia, no un botón que no lleva a ningún lado.

/**
 * Primeros 6 caracteres —**contando el `0x` si está**—, elipsis, últimos 4.
 *
 * **M2-D4 se contradice a sí mismo acá** (D-069). El texto dice "First 6
 * characters *after* the '0x' prefix", pero su propio ejemplo es
 * `0xdcd5...7994`, donde `0xdcd5` son exactamente 6 contando el prefijo — o sea
 * 4 después de él. Las otras tres menciones de la regla, en M2-D3 y M2-D4,
 * dicen solo "6+4 characters".
 *
 * Gana el ejemplo: es la única de las cuatro menciones que muestra el resultado,
 * y es la lectura con la que las cuatro concuerdan.
 */
export function truncateHash(hash: string): string {
  // Si truncar no ahorra nada, se muestra entero: la regla existe para que no
  // desborde, no para ocultar por ocultar.
  if (hash.length <= 10) return hash
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`
}

interface HashChipProps {
  /** El hash COMPLETO. Truncarlo antes de pasarlo rompe la copia. */
  hash: string
  /** Etiqueta opcional dentro del chip: "hash", "txid". */
  label?: string
  /** Abre el TxidModal (P3). Sin esto, el chip no es cliqueable. */
  onOpenDetail?: () => void
  copyLabel: string
  copiedLabel: string
}

export function HashChip({ hash, label, onOpenDetail, copyLabel, copiedLabel }: HashChipProps) {
  const [copiado, setCopiado] = useState(false)

  async function copiar(evento: React.MouseEvent) {
    // El botón de copia vive dentro del chip cliqueable: sin esto, copiar
    // abriría también el modal.
    evento.stopPropagation()
    await navigator.clipboard?.writeText(hash)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }

  const contenido = (
    <>
      {label ? <span className="text-text-muted">{label}</span> : null}
      <span className="font-mono text-mono-sm">{truncateHash(hash)}</span>
      <button
        type="button"
        onClick={copiar}
        aria-label={copiado ? copiedLabel : copyLabel}
        // SPEC-105 (F-09): el ícono sigue midiendo 14px — `before:-inset-[5px]`
        // extiende el área táctil a ~24×24 sin agrandarlo (WCAG 2.5.8).
        className="relative text-text-muted before:absolute before:-inset-[5px] before:content-[''] hover:text-text-primary"
      >
        {copiado ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      </button>
    </>
  )

  const clases = cn(
    'inline-flex items-center gap-s2 rounded-md bg-surface-alt px-s2 py-s1',
    onOpenDetail && 'hover:bg-border'
  )

  if (!onOpenDetail) {
    return <span className={clases}>{contenido}</span>
  }

  return (
    <span className={clases}>
      <button type="button" onClick={onOpenDetail} className="inline-flex items-center gap-s2">
        {label ? <span className="text-text-muted">{label}</span> : null}
        <span className="font-mono text-mono-sm">{truncateHash(hash)}</span>
      </button>
      <button
        type="button"
        onClick={copiar}
        aria-label={copiado ? copiedLabel : copyLabel}
        // SPEC-105 (F-09): el ícono sigue midiendo 14px — `before:-inset-[5px]`
        // extiende el área táctil a ~24×24 sin agrandarlo (WCAG 2.5.8).
        className="relative text-text-muted before:absolute before:-inset-[5px] before:content-[''] hover:text-text-primary"
      >
        {copiado ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      </button>
    </span>
  )
}
