import { useState } from 'react'

// Componente de dominio (CLAUDE.md): hash SHA-256 truncado con copia.
export function HashChip({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    void navigator.clipboard?.writeText(hash)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <span className="proof-value" title={hash}>
      <span className="truncate" style={{ maxWidth: '16rem' }}>
        {hash}
      </span>
      <span
        className="copy-btn"
        role="button"
        aria-label="Copiar hash"
        onClick={copy}
      >
        {copied ? '✓' : '📋'}
      </span>
    </span>
  )
}
