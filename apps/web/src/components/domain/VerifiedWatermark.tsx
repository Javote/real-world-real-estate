interface VerifiedWatermarkProps {
  txid: string | null
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
