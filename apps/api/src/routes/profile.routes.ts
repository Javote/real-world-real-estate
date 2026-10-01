import {
  notificationPrefsSchema,
  profileSchema,
  updateNotificationPrefsSchema,
  updateProfileSchema
} from "@plataforma/shared";
import { Router } from "express";
import type { UserRole } from "../db/types";
import { db } from "../lib/db";
import { conUsuario, delegarAOrpc, OpenAPIHandler, os } from "../lib/orpc";
import { authenticate, authorize, CUALQUIER_ROL } from "../middlewares/auth";
import { writeAuditLog } from "../utils/audit";

const PREFIJO_ABSOLUTO = "/api/v1/profile";

export type ProfileContext = { user: { id: string; email: string; role: UserRole } };
const orpc = os.$context<ProfileContext>();

const router = Router();

router.use(authenticate);

const COLUMNAS_SEGURAS = [
  "id",
  "email",
  "role",
  "fullName",
  "isActive",
  "notificationPrefsJson",
  "createdAt",
  "updatedAt"
] as const;

const profileProcedure = orpc
  .route({ method: "GET", path: "/" })
  .output(profileSchema)
  .handler(async ({ context }) => {
    const usuario = await db
      .selectFrom("User")
      .select(COLUMNAS_SEGURAS)
      .where("id", "=", context.user.id)
      .executeTakeFirstOrThrow();

    return profileSchema.parse(usuario);
  });
const profileHandler = new OpenAPIHandler({ profileProcedure });

router.get(
  "/",
  authorize({ roles: CUALQUIER_ROL, acceso: { scopeEnQuery: "User.id = usuario" } }),
  delegarAOrpc(profileHandler, PREFIJO_ABSOLUTO, conUsuario)
);

const updateProfileProcedure = orpc
  .route({ method: "PATCH", path: "/" })
  .input(updateProfileSchema)
  .output(profileSchema)
  .handler(async ({ input, context }) => {
    const usuario = await db
      .updateTable("User")
      .set({ fullName: input.fullName, updatedAt: new Date() })
      .where("id", "=", context.user.id)
      .returning(COLUMNAS_SEGURAS)
      .executeTakeFirstOrThrow();

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "UPDATE_PROFILE",
      entityType: "User",
      entityId: context.user.id
    });

    return profileSchema.parse(usuario);
  });
const updateProfileHandler = new OpenAPIHandler({ updateProfileProcedure });

router.patch(
  "/",
  authorize({ roles: CUALQUIER_ROL, acceso: { scopeEnQuery: "User.id = usuario" } }),
  delegarAOrpc(updateProfileHandler, PREFIJO_ABSOLUTO, conUsuario)
);

const updateNotificationPrefsProcedure = orpc
  .route({ method: "PATCH", path: "/notifications" })
  .input(updateNotificationPrefsSchema)
  .output(notificationPrefsSchema)
  .handler(async ({ input, context }) => {
    const actual = await db
      .selectFrom("User")
      .select("notificationPrefsJson")
      .where("id", "=", context.user.id)
      .executeTakeFirstOrThrow();

    const previas = actual.notificationPrefsJson
      ? (JSON.parse(actual.notificationPrefsJson) as Record<string, boolean>)
      : {};
    const combinadas = { ...previas, ...input };

    await db
      .updateTable("User")
      .set({ notificationPrefsJson: JSON.stringify(combinadas), updatedAt: new Date() })
      .where("id", "=", context.user.id)
      .execute();

    return notificationPrefsSchema.parse(combinadas);
  });
const updateNotificationPrefsHandler = new OpenAPIHandler({ updateNotificationPrefsProcedure });

router.patch(
  "/notifications",
  authorize({ roles: CUALQUIER_ROL, acceso: { scopeEnQuery: "User.id = usuario" } }),
  delegarAOrpc(updateNotificationPrefsHandler, PREFIJO_ABSOLUTO, conUsuario)
);

export const profileOrpcRouter = {
  profileProcedure,
  updateProfileProcedure,
  updateNotificationPrefsProcedure
};

export default router;
