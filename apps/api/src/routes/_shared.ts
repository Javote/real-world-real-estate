import type { UserRole } from "../db/types";
import { db } from "../lib/db";
import { projectScope } from "../middlewares/auth";

// Ayudantes que usa más de una superficie de rol.
//
// El guion bajo del nombre dice que **no es un router**: los `*.routes.ts` de
// esta carpeta exportan uno, y un archivo que no lo hace entre ellos se lee
// como un olvido.

/**
 * Avance de obra por proyecto, en porcentaje de stages completados.
 *
 * **Es del proyecto, no de la unidad** (D-029): los stages son los mismos para
 * todas las unidades hermanas porque un desarrollo tiene un solo trámite. La
 * captura 55 muestra tres unidades del mismo proyecto en tres stages distintos
 * y casi nos hace modelar stages por unidad — son datos mock, no de diseño.
 *
 * Lo consumen la superficie del investor (sus unidades) y la del developer (el
 * listado de proyectos): vive acá para que la regla se calcule una sola vez.
 */
export async function avancePorProyecto(projectIds: string[]): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  if (projectIds.length === 0) return mapa;

  const stages = await db
    .selectFrom("Stage")
    .select(["projectId", "state"])
    .where("projectId", "in", projectIds)
    .execute();

  for (const id of projectIds) {
    const suyos = stages.filter((s) => s.projectId === id);
    const completados = suyos.filter((s) => s.state === "Completed").length;
    mapa.set(id, suyos.length ? Math.round((completados / suyos.length) * 100) : 0);
  }
  return mapa;
}

/**
 * Los proyectos que este usuario ve, con la MISMA regla que el resto (D-043).
 *
 * La usan los tres paneles de rol para calcular sus KPI. Vive acá y no en cada
 * uno porque un panel que scopee distinto que el listado muestra números de
 * proyectos que su dueño no puede abrir.
 */
export function proyectosVisibles(userId: string, role: UserRole) {
  return db
    .selectFrom("Project")
    .select("Project.id")
    .where((eb) => projectScope(eb, role, userId, ["developer", "buyer", "verifier"]));
}

/**
 * Las columnas de `Evidence` que PUEDEN salir al cliente.
 *
 * **`storagePath` nunca sale** (D-011, incidente real de filtración de la ruta
 * absoluta en disco del servidor). Se listan las columnas EXPLÍCITAS en vez de
 * `selectAll()`: acá no hay "excluir", solo "incluir", así que una columna
 * nueva en `Evidence` no se filtra sola — hay que sumarla a mano a esta lista.
 *
 * Vive acá desde que tres superficies devuelven evidencia (proyecto, developer
 * e investor). Antes estaba en `evidence.routes.ts` y el `CLAUDE.md` advertía
 * que "cualquier endpoint nuevo que toque Evidence tiene que repetir esta
 * lista" — repetir una lista de seguridad es exactamente como se filtra una
 * columna. Ahora es una sola.
 *
 * Las dos rutas que sí necesitan `storagePath` internamente (`download`,
 * `delete`) consultan la fila completa aparte y nunca la devuelven en el body.
 */
export const EVIDENCE_SAFE_COLUMNS = [
  "id",
  "projectId",
  "stageId",
  "uploadedById",
  "evidenceType",
  "category",
  "authoritative",
  "originalFilename",
  "storedFilename",
  "mimeType",
  "sizeBytes",
  "sha256Hash",
  "uploadedAt",
  "createdAt",
  "updatedAt"
] as const;
