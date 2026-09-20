import { cuidParamSchema, unreadCountSchema } from "@plataforma/shared";
import { Router } from "express";
import { z } from "zod";
import type { UserRole } from "../db/types";
import { db } from "../lib/db";
import { OpenAPIHandler, ORPCError, os } from "../lib/orpc";
import { authenticate, authorize, CUALQUIER_ROL } from "../middlewares/auth";
import { paramValidator } from "../middlewares/validate-params";

// Notificaciones (M2-D5 filas 02, 22, 33-34, 62) — **M3-BE-07**.
//
// **SPEC-216 §E1 — migrado a oRPC (D-066)**, junto con `profile.routes.ts`:
// los dos más chicos del lote y el piloto de menor riesgo, porque
// `scopeEnQuery` ya está probado en producción (`investor.routes.ts:567`,
// la MISMA cadena literal, palabra por palabra).
//
// **Sin autorización por proyecto y a propósito**: una notificación pertenece a
// un usuario, no a un proyecto. La única regla de acceso es `userId = yo`, y
// está en el `where` de las dos rutas — no en un middleware que se pueda
// olvidar. Un admin tampoco lee las de otro: no hay nada que auditar acá que el
// `AuditLog` no tenga mejor.
//
// El backend manda `titleKey` + `params`, nunca la frase armada (regla 15).
//
// M2-D5 §3 fija el transporte: *"M3 may opt for polling on a 30-second
// interval as the M3-FE-07 default; push is out of scope for M3"*. Estas rutas
// son las que ese polling consulta.

const PREFIJO_ABSOLUTO = "/api/v1/notifications";

/** El contexto que cada procedimiento recibe — siempre el usuario ya
 * autenticado por `authenticate`, corrido antes de que oRPC vea la request. */
export type NotificationsContext = { user: { id: string; email: string; role: UserRole } };
const orpc = os.$context<NotificationsContext>();

const router = Router();

router.param("id", paramValidator(cuidParamSchema));

router.use(authenticate);

/** El badge del `NotificationBell` (filas 02 y 33-34). Cross-rol. */
const unreadCountProcedure = orpc
  .route({ method: "GET", path: "/unread-count" })
  .output(unreadCountSchema)
  .handler(async ({ context }) => {
    const fila = await db
      .selectFrom("Notification")
      .select((eb) => eb.fn.countAll<number>().as("total"))
      .where("userId", "=", context.user.id)
      .where("readAt", "is", null)
      .executeTakeFirstOrThrow();

    return unreadCountSchema.parse({ unread: Number(fila.total) });
  });
const unreadCountHandler = new OpenAPIHandler({ unreadCountProcedure });

router.get(
  "/unread-count",
  authorize({ roles: CUALQUIER_ROL, acceso: { scopeEnQuery: "Notification.userId = usuario" } }),
  async (req, res, next) => {
    const { matched } = await unreadCountHandler.handle(req, res, {
      prefix: PREFIJO_ABSOLUTO,
      context: { user: req.user! }
    });
    if (!matched) next();
  }
);

/**
 * Marcar leída (filas 22 y 62). **Idempotente** (regla 8): marcar dos veces
 * conserva el primer `readAt` en vez de moverlo — la fecha de lectura es un
 * hecho, no un contador.
 *
 * 404 si no es tuya, no 403: no hay por qué confirmarle a nadie que existe una
 * notificación ajena con ese id. Ningún test fija el body exacto de ese 404
 * (`res.status` nomás), así que dejar que oRPC arme el sobre de error acá es
 * una adaptación sin costo — mismo criterio que los 404 de `notary.routes.ts`.
 */
const markReadProcedure = orpc
  .route({ method: "PATCH", path: "/{id}/read", successStatus: 204 })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(z.void())
  .handler(async ({ input, context }) => {
    const notificacion = await db
      .selectFrom("Notification")
      .select(["id", "readAt"])
      .where("id", "=", input.id)
      .where("userId", "=", context.user.id)
      .executeTakeFirst();

    if (!notificacion) throw new ORPCError("NOT_FOUND", { message: "Notification not found" });

    if (notificacion.readAt === null) {
      await db
        .updateTable("Notification")
        .set({ readAt: new Date() })
        .where("id", "=", notificacion.id)
        .execute();
    }
  });
const markReadHandler = new OpenAPIHandler({ markReadProcedure });

router.patch(
  "/:id/read",
  authorize({ roles: CUALQUIER_ROL, acceso: { scopeEnQuery: "Notification.userId = usuario" } }),
  async (req, res, next) => {
    const { matched } = await markReadHandler.handle(req, res, {
      prefix: PREFIJO_ABSOLUTO,
      context: { user: req.user! }
    });
    if (!matched) next();
  }
);

/** El router oRPC combinado de esta vertical — lo consume
 * `scripts/generate-openapi.ts` para generar el fragmento de OpenAPI de las 2
 * rutas migradas. */
export const notificationsOrpcRouter = {
  unreadCountProcedure,
  markReadProcedure
};

export default router;
