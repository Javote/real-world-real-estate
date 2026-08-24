import { type Notification, notificationQuerySchema, type UnreadCount } from "@plataforma/shared";
import { type Request, Router } from "express";
import { db } from "../lib/db";
import { authenticate } from "../middlewares/auth";

// Notificaciones (M2-D5 filas 02, 22, 33-34, 62) — **M3-BE-07**.
//
// **Sin autorización por proyecto y a propósito**: una notificación pertenece a
// un usuario, no a un proyecto. La única regla de acceso es `userId = yo`, y
// está en el `where` de las tres rutas — no en un middleware que se pueda
// olvidar. Un admin tampoco lee las de otro: no hay nada que auditar acá que el
// `AuditLog` no tenga mejor.
//
// El backend manda `titleKey` + `params`, nunca la frase armada (regla 15).
//
// M2-D5 §3 fija el transporte: *"M3 may opt for polling on a 30-second
// interval as the M3-FE-07 default; push is out of scope for M3"*. Estas rutas
// son las que ese polling consulta.

const router = Router();

router.use(authenticate);

/** El badge del `NotificationBell` (filas 02 y 33-34). Cross-rol. */
router.get("/notifications/unread-count", async (req, res) => {
  const fila = await db
    .selectFrom("Notification")
    .select((eb) => eb.fn.countAll<number>().as("total"))
    .where("userId", "=", req.user!.id)
    .where("readAt", "is", null)
    .executeTakeFirstOrThrow();

  return res.json({ unread: Number(fila.total) } satisfies UnreadCount);
});

/**
 * El listado (filas 22 y 62). `unitId` y `category` son los dos filtros que
 * dibujan las `FilterPill` de la captura 22.
 *
 * Un filtro inválido es 400 y no un listado vacío: quien filtra por una
 * categoría que no existe tiene que enterarse, no ver "no hay novedades".
 */
router.get("/investor/notifications", async (req, res) => {
  const filtros = notificationQuerySchema.safeParse(req.query);
  if (!filtros.success) return res.status(400).json(filtros.error.flatten());

  let query = db
    .selectFrom("Notification")
    .select(["id", "category", "titleKey", "paramsJson", "unitId", "readAt", "createdAt"])
    .where("userId", "=", req.user!.id);

  if (filtros.data.unitId) query = query.where("unitId", "=", filtros.data.unitId);
  if (filtros.data.category) query = query.where("category", "=", filtros.data.category);

  const filas = await query.orderBy("createdAt", "desc").limit(100).execute();

  const notificaciones = filas.map((fila) => ({
    id: fila.id,
    category: fila.category,
    titleKey: fila.titleKey,
    params: fila.paramsJson ? JSON.parse(fila.paramsJson) : {},
    unitId: fila.unitId,
    readAt: fila.readAt,
    createdAt: fila.createdAt
  })) as Notification[];

  return res.json(notificaciones);
});

/**
 * Marcar leída (filas 22 y 62). **Idempotente** (regla 8): marcar dos veces
 * conserva el primer `readAt` en vez de moverlo — la fecha de lectura es un
 * hecho, no un contador.
 *
 * 404 si no es tuya, no 403: no hay por qué confirmarle a nadie que existe una
 * notificación ajena con ese id.
 */
router.patch("/notifications/:id/read", async (req: Request<{ id: string }>, res) => {
  const notificacion = await db
    .selectFrom("Notification")
    .select(["id", "readAt"])
    .where("id", "=", req.params.id)
    .where("userId", "=", req.user!.id)
    .executeTakeFirst();

  if (!notificacion) return res.status(404).json({ message: "Notification not found" });

  if (notificacion.readAt === null) {
    await db
      .updateTable("Notification")
      .set({ readAt: new Date() })
      .where("id", "=", notificacion.id)
      .execute();
  }

  return res.status(204).send();
});

export default router;
