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

// Perfil y preferencias (M2-D5 fila 30 y sus equivalentes por rol).
//
// **SPEC-216 §E1 — migrado a oRPC (D-066), el primero de los 11 routers
// cross-cutting/admin que quedaron fuera de las cuatro sub-partes de
// SPEC-212.** Mismo patrón ya probado en código de producción: el schema de
// cada ruta se declara una sola vez en su procedimiento (`packages/shared`,
// sin reescribir ninguno) y de ahí salen la validación, la respuesta y el
// fragmento de OpenAPI — ver `scripts/generate-openapi.ts`, que ya no tiene
// entrada de `profile` en `REQUEST_SCHEMAS`/`RESPONSE_SCHEMAS`.
//
// **Es compartido entre los cuatro roles** —el `[ASSUMPTION]` de M2-D5 §3 lo
// dice: "`/profile` opera sobre el usuario autenticado sin importar el rol"—.
// Por eso no vive en `/developer/profile` ni en `/notary/profile`: es una sola
// superficie con cuatro entradas.

const PREFIJO_ABSOLUTO = "/api/v1/profile";

/** El contexto que cada procedimiento recibe — siempre el usuario ya
 * autenticado por `authenticate`, corrido antes de que oRPC vea la request. */
export type ProfileContext = { user: { id: string; email: string; role: UserRole } };
const orpc = os.$context<ProfileContext>();

const router = Router();

router.use(authenticate);

/** Nunca sale `passwordHash` (regla 4). Se listan las columnas, no se excluyen. */
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

/**
 * El email y el rol NO se editan acá: cambiar el rol por el endpoint de
 * perfil sería una escalada de privilegios con forma de preferencia.
 */
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

/**
 * Las categorías son las cinco del audit log (M2-D4 P6), que son las mismas
 * sobre las que se notifica. Merge, no reemplazo: un PATCH que manda una sola
 * preferencia no puede apagar las otras cuatro.
 */
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

    // Merge, no reemplazo: un PATCH que manda una sola preferencia no puede
    // apagar las otras cuatro.
    const previas = actual.notificationPrefsJson
      ? (JSON.parse(actual.notificationPrefsJson) as Record<string, boolean>)
      : {};
    const combinadas = { ...previas, ...input };

    await db
      .updateTable("User")
      .set({ notificationPrefsJson: JSON.stringify(combinadas), updatedAt: new Date() })
      .where("id", "=", context.user.id)
      .execute();

    // notificationPrefsSchema completa con su default (true) las claves que
    // `combinadas` no tenga — el merge sigue guardando solo lo que vino, la
    // respuesta siempre muestra las 5 (Tanda 2, hallazgo del checkpoint).
    return notificationPrefsSchema.parse(combinadas);
  });
const updateNotificationPrefsHandler = new OpenAPIHandler({ updateNotificationPrefsProcedure });

router.patch(
  "/notifications",
  authorize({ roles: CUALQUIER_ROL, acceso: { scopeEnQuery: "User.id = usuario" } }),
  delegarAOrpc(updateNotificationPrefsHandler, PREFIJO_ABSOLUTO, conUsuario)
);

/** El router oRPC combinado de esta vertical — lo consume
 * `scripts/generate-openapi.ts` para generar el fragmento de OpenAPI de las 3
 * rutas migradas. */
export const profileOrpcRouter = {
  profileProcedure,
  updateProfileProcedure,
  updateNotificationPrefsProcedure
};

export default router;
