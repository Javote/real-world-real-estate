import type { NotificationCategory } from "@plataforma/shared";
import { createId } from "../db/id";
import { db } from "../lib/db";

// Emisión de notificaciones — **M3-BE-07**.
//
// **Claves, nunca copy** (regla 15): `titleKey` es una entrada del diccionario
// y `params` lo que el cliente interpola. Este helper no arma frases.
//
// **Sin PII en `params`** (regla 2): van referencias e identificadores opacos,
// no nombres ni emails. El destinatario ya sabe quién es; el que no debería
// saberlo tampoco debería poder leer el registro.
//
// Notificar nunca puede voltear la acción que la origina: si acá falla algo, se
// loguea y se sigue. Perder un aviso es molesto; perder un anclaje ya escrito
// por un `INSERT` de conveniencia es un incidente.

export async function notify(input: {
  userId: string;
  category: NotificationCategory;
  titleKey: string;
  params?: Record<string, string | number>;
  unitId?: string | null;
}): Promise<void> {
  try {
    await db
      .insertInto("Notification")
      .values({
        id: createId(),
        userId: input.userId,
        category: input.category,
        titleKey: input.titleKey,
        paramsJson: input.params ? JSON.stringify(input.params) : null,
        unitId: input.unitId ?? null,
        readAt: null,
        createdAt: new Date()
      })
      .execute();
  } catch (error) {
    console.error("[notify] no se pudo registrar la notificación", {
      titleKey: input.titleKey,
      error
    });
  }
}

/**
 * Avisa al investor dueño de una unidad. No hace nada si la unidad no tiene
 * dueño todavía — que es el caso normal antes de que se acepte una invitación.
 */
export async function notifyUnitInvestor(input: {
  unitId: string;
  category: NotificationCategory;
  titleKey: string;
  params?: Record<string, string | number>;
}): Promise<void> {
  const unidad = await db
    .selectFrom("Unit")
    .select("investorId")
    .where("id", "=", input.unitId)
    .executeTakeFirst();

  if (!unidad?.investorId) return;

  // SPEC-208 (B-12): con `exactOptionalPropertyTypes`, `params: undefined`
  // explícito ya no es lo mismo que omitir la clave.
  await notify({
    userId: unidad.investorId,
    category: input.category,
    titleKey: input.titleKey,
    ...(input.params ? { params: input.params } : {}),
    unitId: input.unitId
  });
}

/**
 * Igual que {@link notifyUnitInvestor}, pero para N unidades a la vez —
 * SPEC-209 (B-13): un `INSERT` múltiple en vez de un `SELECT` + `INSERT` por
 * unidad. El llamador ya tiene que traer `investorId`: acá no se vuelve a
 * consultar `Unit`, que es exactamente el N+1 que esto reemplaza.
 *
 * Mismo criterio de "no puede voltear la acción que lo origina" que `notify`:
 * si el `INSERT` falla, se loguea y se sigue.
 */
export async function notifyUnitInvestors(
  units: { unitId: string; investorId: string }[],
  input: {
    category: NotificationCategory;
    titleKey: string;
    params?: Record<string, string | number>;
  }
): Promise<void> {
  if (units.length === 0) return;

  try {
    await db
      .insertInto("Notification")
      .values(
        units.map((u) => ({
          id: createId(),
          userId: u.investorId,
          category: input.category,
          titleKey: input.titleKey,
          paramsJson: input.params ? JSON.stringify(input.params) : null,
          unitId: u.unitId,
          readAt: null,
          createdAt: new Date()
        }))
      )
      .execute();
  } catch (error) {
    console.error("[notify] no se pudieron registrar las notificaciones", {
      titleKey: input.titleKey,
      error
    });
  }
}
