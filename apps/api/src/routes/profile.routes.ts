import {
  profileSchema,
  updateNotificationPrefsSchema,
  updateProfileSchema
} from "@plataforma/shared";
import { type Request, Router } from "express";
import { db } from "../lib/db";
import { authenticate, authorize, CUALQUIER_ROL } from "../middlewares/auth";
import { writeAuditLog } from "../utils/audit";

// Perfil y preferencias (M2-D5 fila 30 y sus equivalentes por rol).
//
// **Es compartido entre los cuatro roles** —el `[ASSUMPTION]` de M2-D5 §3 lo
// dice: "`/profile` opera sobre el usuario autenticado sin importar el rol"—.
// Por eso no vive en `/developer/profile` ni en `/notary/profile`: es una sola
// superficie con cuatro entradas.

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

router.get(
  "/",
  authorize({ roles: CUALQUIER_ROL, acceso: { scopeEnQuery: "User.id = usuario" } }),
  async (req, res) => {
    const usuario = await db
      .selectFrom("User")
      .select(COLUMNAS_SEGURAS)
      .where("id", "=", req.user!.id)
      .executeTakeFirstOrThrow();

    return res.json(profileSchema.parse(usuario));
  }
);

router.patch(
  "/",
  authorize({ roles: CUALQUIER_ROL, acceso: { scopeEnQuery: "User.id = usuario" } }),
  async (req: Request, res) => {
    // El email y el rol NO se editan acá: cambiar el rol por el endpoint de
    // perfil sería una escalada de privilegios con forma de preferencia.
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());

    const usuario = await db
      .updateTable("User")
      .set({ fullName: parsed.data.fullName, updatedAt: new Date() })
      .where("id", "=", req.user!.id)
      .returning(COLUMNAS_SEGURAS)
      .executeTakeFirstOrThrow();

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "UPDATE_PROFILE",
      entityType: "User",
      entityId: req.user!.id
    });

    return res.json(profileSchema.parse(usuario));
  }
);

router.patch(
  "/notifications",
  authorize({ roles: CUALQUIER_ROL, acceso: { scopeEnQuery: "User.id = usuario" } }),
  async (req: Request, res) => {
    // Las categorías son las cinco del audit log (M2-D4 P6), que son las mismas
    // sobre las que se notifica.
    const parsed = updateNotificationPrefsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());

    const actual = await db
      .selectFrom("User")
      .select("notificationPrefsJson")
      .where("id", "=", req.user!.id)
      .executeTakeFirstOrThrow();

    // Merge, no reemplazo: un PATCH que manda una sola preferencia no puede
    // apagar las otras cuatro.
    const previas = actual.notificationPrefsJson
      ? (JSON.parse(actual.notificationPrefsJson) as Record<string, boolean>)
      : {};
    const combinadas = { ...previas, ...parsed.data };

    await db
      .updateTable("User")
      .set({ notificationPrefsJson: JSON.stringify(combinadas), updatedAt: new Date() })
      .where("id", "=", req.user!.id)
      .execute();

    return res.json(combinadas);
  }
);

export default router;
