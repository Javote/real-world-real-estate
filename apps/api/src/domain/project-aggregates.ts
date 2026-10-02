import { db } from "../lib/db.js";

export interface AgregadoDeProyecto {
  stageCount: number;
  progress: number;
  priceFromMinorUnits: number | null;
  priceCurrency: string | null;
  sizeMinM2: number | null;
  sizeMaxM2: number | null;
}

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
