import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { cn } from '#/lib/cn'

export function truncateHash(hash: string): string {
  if (hash.length <= 10) return hash
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`
}

interface HashChipProps {
  hash: string
  label?: string
  onOpenDetail?: () => void
  copyLabel: string
  copiedLabel: string
}

export function HashChip({ hash, label, onOpenDetail, copyLabel, copiedLabel }: HashChipProps) {
  const [copiado, setCopiado] = useState(false)

  async function copiar(evento: React.MouseEvent) {
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
        className="relative text-text-muted before:absolute before:-inset-[5px] before:content-[''] hover:text-text-primary"
      >
        {copiado ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      </button>
    </span>
  )
}
