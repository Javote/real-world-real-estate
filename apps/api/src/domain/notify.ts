import type { NotificationCategory } from "@plataforma/shared";
import { db } from "../lib/db.js";
import {
  type EntradaDeNotificacion,
  type EntradasDeNotificacion,
  notify as notificar
} from "../platform/notify.js";

// La forma vieja, sobre `notify()` de `platform/`: después del commit y tragándose el error. Las
// llamadas se van con su módulo en A4 (SPEC-616), a la nueva, que va en el lote de la mutación.
async function notificarSinTirar(entradas: EntradasDeNotificacion): Promise<void> {
  try {
    await notificar(db, entradas).execute();
  } catch (error) {
    console.error(
      Array.isArray(entradas)
        ? "[notify] no se pudieron registrar las notificaciones"
        : "[notify] no se pudo registrar la notificación",
      { titleKey: (Array.isArray(entradas) ? entradas[0] : entradas).titleKey, error }
    );
  }
}

export async function notify(input: EntradaDeNotificacion): Promise<void> {
  await notificarSinTirar(input);
}

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

  await notify({
    userId: unidad.investorId,
    category: input.category,
    titleKey: input.titleKey,
    ...(input.params ? { params: input.params } : {}),
    unitId: input.unitId
  });
}

export async function notifyUnitInvestors(
  units: { unitId: string; investorId: string }[],
  input: {
    category: NotificationCategory;
    titleKey: string;
    params?: Record<string, string | number>;
  }
): Promise<void> {
  const [primera, ...resto] = units.map((u) => ({
    userId: u.investorId,
    category: input.category,
    titleKey: input.titleKey,
    ...(input.params ? { params: input.params } : {}),
    unitId: u.unitId
  }));
  if (!primera) return;
  await notificarSinTirar([primera, ...resto]);
}
