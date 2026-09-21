import { db } from "../lib/db";

// Agregados de proyecto — lo que las cards de proyecto muestran y ninguna
// columna guarda (SPEC-220).
//
// Vivía inline en `GET /developer/projects`. Se extrajo cuando
// `GET /projects/:id/developer` (capturas 59-60) pasó a necesitar lo mismo:
// la regla de las dos monedas es exactamente el tipo de invariante que se
// desincroniza cuando está escrita dos veces.

export interface AgregadoDeProyecto {
  stageCount: number;
  /** 0-100, sobre etapas `Completed`. Un proyecto sin etapas da 0, no NaN. */
  progress: number;
  priceFromMinorUnits: number | null;
  priceCurrency: string | null;
  /** El "60 m² to 150 m²" de la captura 60. Solo lo usa el perfil. */
  sizeMinM2: number | null;
  sizeMaxM2: number | null;
}

/**
 * Los agregados de varios proyectos, en dos queries y no en dos por proyecto.
 *
 * El precio se calcula sobre **todas** las unidades y no solo las disponibles,
 * porque lo decide la captura: Belgrano Park está "Delivered" —o sea, sin nada
 * disponible— y aun así muestra su precio.
 */
export async function agregadosDeProyectos(
  ids: readonly string[]
): Promise<Map<string, AgregadoDeProyecto>> {
  const salida = new Map<string, AgregadoDeProyecto>();
  if (ids.length === 0) return salida;

  const [stages, unidades] = await Promise.all([
    db.selectFrom("Stage").select(["projectId", "state"]).where("projectId", "in", ids).execute(),
    db
      .selectFrom("Unit")
      .select(["projectId", "priceMinorUnits", "currency", "sizeM2"])
      .where("projectId", "in", ids)
      .execute()
  ]);

  for (const id of ids) {
    const suyos = stages.filter((s) => s.projectId === id);
    const completados = suyos.filter((s) => s.state === "Completed").length;

    const suyas = unidades.filter((u) => u.projectId === id);
    const conPrecio = suyas.filter((u) => u.priceMinorUnits !== null);
    const monedas = new Set(conPrecio.map((u) => u.currency));

    // **Con dos monedas en el mismo proyecto no hay "desde" que se pueda
    // sostener**: comparar unidades mínimas de monedas distintas da un número
    // sin significado. Antes que un mínimo falso, ningún precio (regla 17).
    const barata =
      monedas.size === 1
        ? conPrecio.reduce((min, u) => (u.priceMinorUnits! < min.priceMinorUnits! ? u : min))
        : null;

    const medidas = suyas.map((u) => u.sizeM2).filter((m): m is number => m !== null);

    salida.set(id, {
      stageCount: suyos.length,
      progress: suyos.length ? Math.round((completados / suyos.length) * 100) : 0,
      priceFromMinorUnits: barata?.priceMinorUnits ?? null,
      priceCurrency: barata?.currency ?? null,
      sizeMinM2: medidas.length ? Math.min(...medidas) : null,
      sizeMaxM2: medidas.length ? Math.max(...medidas) : null
    });
  }

  return salida;
}
