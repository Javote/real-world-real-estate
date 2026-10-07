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

/** Al menos una: una lista vacía no es un INSERT. */
export type EntradasDeNotificacion =
  | EntradaDeNotificacion
  | readonly [EntradaDeNotificacion, ...EntradaDeNotificacion[]];

/**
 * Una notificación, o varias en un solo INSERT, sin ejecutar, como `audit`: viaja en el mismo
 * `enLote` que la mutación que avisa y, si falla, la deshace (SPEC-613 §La decisión). En un flujo que
 * ancla, va en el lote que guarda el resultado del anclaje, no antes.
 */
export function notify(ejecutor: Ejecutor, entradas: EntradasDeNotificacion) {
  const lista: readonly EntradaDeNotificacion[] = Array.isArray(entradas)
    ? entradas
    : [entradas as EntradaDeNotificacion];
  return ejecutor.insertInto("Notification").values(
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
  );
}
