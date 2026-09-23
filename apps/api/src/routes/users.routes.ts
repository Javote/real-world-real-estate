import {
  createUserSchema,
  cuidParamSchema,
  updateUserSchema,
  userMutationResultSchema,
  userSummarySchema
} from "@plataforma/shared";
import bcrypt from "bcrypt";
import { Router } from "express";
import { z } from "zod";
import { createId } from "../db/id";
import type { UserRole } from "../db/types";
import { db } from "../lib/db";
import { conUsuario, delegarAOrpc, OpenAPIHandler, ORPCError, os } from "../lib/orpc";
import { authenticate, authorize } from "../middlewares/auth";
import { paramValidator } from "../middlewares/validate-params";
import { writeAuditLog } from "../utils/audit";
import { relanzarRestriccionComoOrpc } from "./_shared";

// **SPEC-216 §E4 — migrado a oRPC (D-066). Aislado a propósito, en su propio
// commit, sin mezclarse con las otras sub-partes: toca superficie 🔴
// declarada (`bcrypt`, `apps/api/CLAUDE.md` §Superficie 🔴).**
//
// **Lo único que cambia es el transporte — la auditoría de la spec ya lo
// preveía ("ninguna — toca bcrypt, pero solo el transporte cambia").**
// `bcrypt.hash(password, 10)` (regla 4, cost 10) es EXACTAMENTE el mismo
// código, en el mismo lugar del handler, sin tocar ni una línea de la lógica
// 🔴 — lo único que cambia es que el body llega vía `.input()` de oRPC en vez
// de `safeParse` a mano, y la respuesta se valida contra el mismo
// `.output()` que ya declaraba `userMutationResultSchema`/`userSummarySchema`.
// `passwordHash` nunca sale (regla 4): la lista de columnas del `select` es
// la única fuente, y los dos `.output()` (`userSummarySchema`,
// `userMutationResultSchema`) son `z.strictObject` — un campo de más no pasa.
//
// **`POST /` inserta contra `User.email` único, y se envuelve en
// `relanzarRestriccionComoOrpc`**, mismo criterio que el resto del lote:
// `test/constraint-errors.test.ts` → "un email de usuario repetido" fija 409
// sin nombre de tabla/columna. `PATCH /:id` no toca `email` (no es un campo
// de `updateUserSchema`), pero se envuelve igual: `.errors()` y el
// `.catch()` cuestan lo mismo declararlos que no, y una columna única nueva
// en `User` el día de mañana no depende de que alguien se acuerde de
// agregarlos acá.

const PREFIJO_ABSOLUTO = "/api/v1/users";

/** El contexto que cada procedimiento recibe — siempre el usuario ya
 * autenticado por `authenticate`, corrido antes de que oRPC vea la request. */
export type UsersContext = { user: { id: string; email: string; role: UserRole } };
const orpc = os.$context<UsersContext>();

const router = Router();

router.param("id", paramValidator(cuidParamSchema));

router.use(authenticate);

const USER_LIST_COLUMNS = ["id", "email", "role", "fullName", "isActive", "createdAt"] as const;

const userListProcedure = os
  .route({ method: "GET", path: "/" })
  .output(z.array(userSummarySchema))
  .handler(async () => {
    const userList = await db
      .selectFrom("User")
      .select(USER_LIST_COLUMNS)
      .orderBy("createdAt", "desc")
      .execute();

    return userList.map((u) => userSummarySchema.parse(u));
  });
const userListHandler = new OpenAPIHandler({ userListProcedure });

router.get(
  "/",
  authorize({ roles: ["admin"], acceso: "soloRol" }),
  delegarAOrpc(userListHandler, PREFIJO_ABSOLUTO)
);

const createUserProcedure = orpc
  .errors({
    RESOURCE_ALREADY_EXISTS: { status: 409, message: "Resource already exists" },
    RELATED_RESOURCE_NOT_FOUND: { status: 400, message: "A referenced resource does not exist" }
  })
  .route({ method: "POST", path: "/", successStatus: 201 })
  .input(createUserSchema)
  .output(userMutationResultSchema)
  .handler(async ({ input, context, errors }) => {
    const passwordHash = await bcrypt.hash(input.password, 10);
    const now = new Date();

    const user = await db
      .insertInto("User")
      .values({
        id: createId(),
        email: input.email,
        passwordHash,
        role: input.role,
        fullName: input.fullName,
        isActive: true,
        createdAt: now,
        updatedAt: now
      })
      .returning(["id", "email", "role", "fullName", "isActive"])
      .executeTakeFirstOrThrow()
      .catch((err) => relanzarRestriccionComoOrpc(err, errors));

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "CREATE_USER",
      entityType: "User",
      entityId: user.id
    });

    return userMutationResultSchema.parse(user);
  });
const createUserHandler = new OpenAPIHandler({ createUserProcedure });

router.post(
  "/",
  authorize({ roles: ["admin"], acceso: "soloRol" }),
  delegarAOrpc(createUserHandler, PREFIJO_ABSOLUTO, conUsuario)
);

const userByIdProcedure = os
  .route({ method: "GET", path: "/{id}" })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(userSummarySchema)
  .handler(async ({ input }) => {
    const user = await db
      .selectFrom("User")
      .select(USER_LIST_COLUMNS)
      .where("id", "=", input.id)
      .executeTakeFirst();

    if (!user) throw new ORPCError("NOT_FOUND", { message: "User not found" });

    return userSummarySchema.parse(user);
  });
const userByIdHandler = new OpenAPIHandler({ userByIdProcedure });

router.get(
  "/:id",
  authorize({ roles: ["admin"], acceso: "soloRol" }),
  delegarAOrpc(userByIdHandler, PREFIJO_ABSOLUTO)
);

const updateUserProcedure = orpc
  .errors({
    RESOURCE_ALREADY_EXISTS: { status: 409, message: "Resource already exists" },
    RELATED_RESOURCE_NOT_FOUND: { status: 400, message: "A referenced resource does not exist" }
  })
  .route({ method: "PATCH", path: "/{id}" })
  .input(updateUserSchema.extend({ id: cuidParamSchema }))
  .output(userMutationResultSchema)
  .handler(async ({ input, context, errors }) => {
    const { id, ...body } = input;

    // Un id inexistente daba 500: `executeTakeFirstOrThrow()` tira un error que
    // `relanzarRestriccionComoOrpc` no clasifica (no es una restricción violada),
    // así que quedaba como el 500 genérico de oRPC. `GET /users/:id` ya da 404
    // para lo mismo — esto lo alinea (SPEC-018 §A4).
    const existe = await db.selectFrom("User").select("id").where("id", "=", id).executeTakeFirst();
    if (!existe) throw new ORPCError("NOT_FOUND", { message: "User not found" });

    const data: {
      fullName?: string;
      role?: (typeof body)["role"];
      isActive?: boolean;
      passwordHash?: string;
      updatedAt: Date;
    } = { updatedAt: new Date() };

    if (body.fullName !== undefined) data.fullName = body.fullName;
    if (body.role !== undefined) data.role = body.role;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.password !== undefined) {
      data.passwordHash = await bcrypt.hash(body.password, 10);
    }

    const user = await db
      .updateTable("User")
      .set(data)
      .where("id", "=", id)
      .returning(["id", "email", "role", "fullName", "isActive"])
      .executeTakeFirstOrThrow()
      /* v8 ignore start -- @preserve: inalcanzable salvo por una carrera con el chequeo de arriba (la fila ya se confirmó que existe) — ninguno de estos campos toca una columna única de User hoy, pero el `.catch()` queda por si mañana una sí (SPEC-018) */
      .catch((err) => relanzarRestriccionComoOrpc(err, errors));
    /* v8 ignore stop -- @preserve */

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "UPDATE_USER",
      entityType: "User",
      entityId: user.id
    });

    return userMutationResultSchema.parse(user);
  });
const updateUserHandler = new OpenAPIHandler({ updateUserProcedure });

router.patch(
  "/:id",
  authorize({ roles: ["admin"], acceso: "soloRol" }),
  delegarAOrpc(updateUserHandler, PREFIJO_ABSOLUTO, conUsuario)
);

const deleteUserProcedure = orpc
  .route({ method: "DELETE", path: "/{id}", successStatus: 204 })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(z.void())
  .handler(async ({ input, context }) => {
    await db.deleteFrom("User").where("id", "=", input.id).execute();

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "DELETE_USER",
      entityType: "User",
      entityId: input.id
    });
  });
const deleteUserHandler = new OpenAPIHandler({ deleteUserProcedure });

router.delete(
  "/:id",
  authorize({ roles: ["admin"], acceso: "soloRol" }),
  delegarAOrpc(deleteUserHandler, PREFIJO_ABSOLUTO, conUsuario)
);

/** El router oRPC combinado de esta vertical — lo consume
 * `scripts/generate-openapi.ts` para generar el fragmento de OpenAPI de las 5
 * rutas migradas. */
export const usersOrpcRouter = {
  userListProcedure,
  createUserProcedure,
  userByIdProcedure,
  updateUserProcedure,
  deleteUserProcedure
};

export default router;
