import type { NotificationCategory } from "@plataforma/shared";
import { createId } from "../db/id.js";
import { db } from "../lib/db.js";

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
