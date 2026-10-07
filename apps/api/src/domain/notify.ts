import type { NotificationCategory } from "@plataforma/shared";
import { db } from "../lib/db.js";
import { type EntradaDeNotificacion, notify as notificar } from "../platform/notify.js";

// La forma vieja, sobre `notify()` de `platform/`: las llamadas se van con su módulo en A4 (SPEC-616).
export async function notify(input: EntradaDeNotificacion): Promise<void> {
  await notificar(db, input);
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
  await notificar(
    db,
    units.map((u) => ({
      userId: u.investorId,
      category: input.category,
      titleKey: input.titleKey,
      ...(input.params ? { params: input.params } : {}),
      unitId: u.unitId
    }))
  );
}
