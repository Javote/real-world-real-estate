// Componente de dominio (CLAUDE.md): estado de anclaje on-chain de una evidencia.
// Hasta que AnchorPort esté integrado (D-014), toda evidencia está "Pendiente de anclaje".
export function StatusPill({ anchored }: { anchored?: boolean }) {
  return anchored ? (
    <span className="status-badge completed">Anclado</span>
  ) : (
    <span className="status-badge pending">Pendiente de anclaje</span>
  )
}
