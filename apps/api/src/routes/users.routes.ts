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
import { createId } from "../db/id.js";
import type { UserRole } from "../db/types.js";
import { db } from "../lib/db.js";
import { conUsuario, delegarAOrpc, OpenAPIHandler, ORPCError, os } from "../lib/orpc.js";
import { authenticate, authorize } from "../middlewares/auth.js";
import { paramValidator } from "../middlewares/validate-params.js";
import { writeAuditLog } from "../utils/audit.js";
import { relanzarRestriccionComoOrpc } from "./_shared.js";

const PREFIJO_ABSOLUTO = "/api/v1/users";

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
      /* v8 ignore start -- @preserve: inalcanzable salvo por una carrera con el chequeo de arriba (la fila ya se confirmó que existe) — ninguno de estos campos toca una columna única de User hoy, pero el `.catch()` queda por si mañana una sí */
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

export const usersOrpcRouter = {
  userListProcedure,
  createUserProcedure,
  userByIdProcedure,
  updateUserProcedure,
  deleteUserProcedure
};

export default router;
