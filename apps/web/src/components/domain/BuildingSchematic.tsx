import { MapPin } from 'lucide-react'
import { CARD_SHELL_DENSE } from '#/lib/cardShell'
import { cn } from '#/lib/cn'

// M2-D3 §Modals · BuildingSchematic — la grilla del edificio con la unidad del
// investor resaltada. *"Helps the investor orient their acquisition
// spatially."*
//
// Transcrito de la captura 21, que es lo normativo para la estructura:
//
//   · pisos como FILAS, de mayor a menor (P12 arriba, P1 abajo) — un edificio
//     se dibuja como se ve, no como se ordena un array;
//   · columnas A-D dentro de cada piso;
//   · fila de leyenda arriba: Disponible / Ocupada / Tu unidad;
//   · celda ACCESS al pie de la grilla;
//   · callout final con la posición de la unidad.
//
// Los tres estados son los de la leyenda y nada más: **púrpura la tuya, negra
// la ocupada, blanca la disponible.** Los valores de la captura son mock (el
// edificio de doce pisos no es un dato de diseño); la estructura sí.

export interface SchematicUnit {
  id: string
  /** "7B" */
  unitReference: string
  floor: number
  state: 'available' | 'occupied' | 'mine'
}

const CELDA: Record<SchematicUnit['state'], string> = {
  available: 'bg-card text-text-muted border-border',
  occupied: 'bg-text-primary text-white border-text-primary',
  mine: 'bg-primary text-white border-primary font-bold'
}

interface BuildingSchematicProps {
  projectName: string
  units: readonly SchematicUnit[]
  labels: {
    title: string
    /** Etiquetas de la leyenda. */
    available: string
    occupied: string
    mine: string
    access: string
    /** Prefijo de piso: "P". */
    floorPrefix: string
    /** Callout del pie, ya armado por quien lo usa (D-025). */
    callout?: string
    /** "Vista esquemática de referencia. Los planos finales están en el dossier." */
    disclaimer?: string
  }
  className?: string
}

export function BuildingSchematic({
  projectName,
  units,
  labels,
  className
}: BuildingSchematicProps) {
  // Agrupadas por piso, de mayor a menor: así se dibuja un edificio.
  const pisos = [...new Set(units.map((u) => u.floor))].sort((a, b) => b - a)
  const miPiso = units.find((u) => u.state === 'mine')?.floor

  const leyenda = [
    { key: 'available' as const, label: labels.available },
    { key: 'occupied' as const, label: labels.occupied },
    { key: 'mine' as const, label: labels.mine }
  ]

  return (
    <section className={cn('flex flex-col gap-s3', className)} aria-label={labels.title}>
      <header className="flex flex-wrap items-center justify-between gap-s2">
        <h3 className="text-body font-medium text-text-primary">{projectName}</h3>
        <ul className="flex items-center gap-s3">
          {leyenda.map((l) => (
            <li key={l.key} className="flex items-center gap-s1 text-caption text-text-muted">
              <span aria-hidden="true" className={cn('size-3 rounded-full border', CELDA[l.key])} />
              {l.label}
            </li>
          ))}
        </ul>
      </header>

      <div className={cn('flex flex-col gap-s1', CARD_SHELL_DENSE)}>
        {pisos.map((piso) => (
          <div key={piso} className="flex items-center gap-s2">
            <span
              className={cn(
                'w-8 shrink-0 text-caption tabular-nums',
                piso === miPiso ? 'font-bold text-primary' : 'text-text-muted'
              )}
            >
              {labels.floorPrefix}
              {piso}
            </span>

            <div className="flex flex-1 gap-s1">
              {units
                .filter((u) => u.floor === piso)
                .sort((a, b) => a.unitReference.localeCompare(b.unitReference))
                .map((u) => (
                  <span
                    key={u.id}
                    aria-current={u.state === 'mine' ? 'true' : undefined}
                    className={cn(
                      'flex flex-1 items-center justify-center rounded-md border py-s2 text-caption',
                      CELDA[u.state]
                    )}
                  >
                    {u.unitReference}
                  </span>
                ))}
            </div>
          </div>
        ))}

        <span className="mt-s2 self-center rounded-md border border-border px-s4 py-s1 text-caption text-text-muted">
          {labels.access}
        </span>
      </div>

      {labels.callout ? (
        <p className="flex items-start gap-s2 rounded-lg bg-primary-light p-s3 text-body-sm text-text-secondary">
          <MapPin className="size-icon-inline shrink-0 text-primary" aria-hidden="true" />
          {labels.callout}
        </p>
      ) : null}

      {labels.disclaimer ? (
        <p className="text-center text-caption text-text-muted">{labels.disclaimer}</p>
      ) : null}
    </section>
  )
}
