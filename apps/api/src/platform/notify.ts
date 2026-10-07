import type { NotificationCategory } from "@plataforma/shared";
import { createId } from "../db/id.js";
import type { Ejecutor } from "./audit.js";

export type EntradaDeNotificacion = {
  userId: string;
  category: NotificationCategory;
  titleKey: string;
  params?: Record<string, string | number>;
  unitId?: string | null;
};

/**
 * Una notificación, o varias en un solo INSERT. **No tira**: si falla, queda en el log y la mutación que
 * avisa sigue en pie. Se llama después del commit, con `db`. Si tiene que ser atómica con la mutación
 * (entrar en su transacción y deshacerla si falla) es una decisión pendiente del dueño (SPEC-613).
 */
export async function notify(
  ejecutor: Ejecutor,
  entradas: EntradaDeNotificacion | readonly EntradaDeNotificacion[]
): Promise<void> {
  const lista = Array.isArray(entradas) ? entradas : [entradas as EntradaDeNotificacion];
  if (lista.length === 0) return;

  try {
    await ejecutor
      .insertInto("Notification")
      .values(
        lista.map((e) => ({
          id: createId(),
          userId: e.userId,
          category: e.category,
          titleKey: e.titleKey,
          paramsJson: e.params ? JSON.stringify(e.params) : null,
          unitId: e.unitId ?? null,
          readAt: null,
          createdAt: new Date()
        }))
      )
      .execute();
  } catch (error) {
    console.error(
      Array.isArray(entradas)
        ? "[notify] no se pudieron registrar las notificaciones"
        : "[notify] no se pudo registrar la notificación",
      { titleKey: (lista[0] as EntradaDeNotificacion).titleKey, error }
    );
  }
}
