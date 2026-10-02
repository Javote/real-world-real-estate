import { cuidParamSchema, unreadCountSchema } from "@plataforma/shared";
import { Router } from "express";
import { z } from "zod";
import type { UserRole } from "../db/types";
import { db } from "../lib/db";
import { conUsuario, delegarAOrpc, OpenAPIHandler, ORPCError, os } from "../lib/orpc";
import { authenticate, authorize, CUALQUIER_ROL } from "../middlewares/auth";
import { paramValidator } from "../middlewares/validate-params";

const PREFIJO_ABSOLUTO = "/api/v1/notifications";

export type NotificationsContext = { user: { id: string; email: string; role: UserRole } };
const orpc = os.$context<NotificationsContext>();

const router = Router();

router.param("id", paramValidator(cuidParamSchema));

router.use(authenticate);

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
  delegarAOrpc(unreadCountHandler, PREFIJO_ABSOLUTO, conUsuario)
);

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
  delegarAOrpc(markReadHandler, PREFIJO_ABSOLUTO, conUsuario)
);

export const notificationsOrpcRouter = {
  unreadCountProcedure,
  markReadProcedure
};

export default router;
