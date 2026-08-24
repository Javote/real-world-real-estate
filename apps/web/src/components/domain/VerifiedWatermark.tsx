// **M2-D4 Pattern 7 · el sello VERIFIED sobre el documento.**
//
// Cuando el usuario abre un documento está mirando el documento, no el pill del
// costado: la señal de prueba tiene que estar encima del render.
//
// Los números son del entregable, no elegidos: **rotación -25°, opacidad
// 30–40%, centrado**, en el mismo teal del VerificationBadge.
//
// **Anti-patrón, textual:** *"Never apply the VERIFIED watermark to a document
// whose hash is not actually anchored."* Por eso —igual que el
// VerificationBadge— el componente recibe el TXID y no un booleano: sin
// anclaje no hay marca, y un documento en pendiente lleva su pill naranja en el
// pie, no un sello atenuado.

interface VerifiedWatermarkProps {
  /** El TXID del anclaje. Sin esto no hay marca. */
  txid: string | null
  /** El texto del sello, traducido. */
  label: string
  children: React.ReactNode
}

export function VerifiedWatermark({ txid, label, children }: VerifiedWatermarkProps) {
  return (
    <div className="relative">
      {children}
      {txid ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <span
            className="text-verified opacity-35"
            style={{
              transform: 'rotate(-25deg)',
              fontSize: 'clamp(2rem, 12vw, 6rem)',
              fontWeight: 700,
              letterSpacing: '0.1em'
            }}
          >
            {label}
          </span>
        </div>
      ) : null}
    </div>
  )
}
