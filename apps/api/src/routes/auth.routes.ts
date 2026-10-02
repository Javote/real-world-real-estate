import { randomUUID } from "node:crypto";
import { loginRequestSchema, loginResponseSchema, meResponseSchema } from "@plataforma/shared";
import bcrypt from "bcrypt";
import { Router } from "express";
import type { UserRole } from "../db/types";
import { db } from "../lib/db";
import { signToken } from "../lib/jwt";
import { conUsuario, delegarAOrpc, OpenAPIHandler, ORPCError, os } from "../lib/orpc";
import { authenticate, authorize, CUALQUIER_ROL } from "../middlewares/auth";
import { loginRateLimiter } from "../middlewares/rateLimit";
import { writeAuditLog } from "../utils/audit";

const PREFIJO_ABSOLUTO = "/api/v1/auth";

export type AuthContext = { user?: { id: string; email: string; role: UserRole } };
const orpc = os.$context<AuthContext>();

const router = Router();

const HASH_DUMMY = bcrypt.hashSync(randomUUID(), 10);

const loginProcedure = orpc
  .route({ method: "POST", path: "/login" })
  .input(loginRequestSchema)
  .output(loginResponseSchema)
  .handler(async ({ input }) => {
    const user = await db
      .selectFrom("User")
      .selectAll()
      .where("email", "=", input.email)
      .executeTakeFirst();

    // Siempre se compara, aunque el usuario no exista: si no, el tiempo de respuesta lo delata.
    const valid = await bcrypt.compare(input.password, user?.passwordHash ?? HASH_DUMMY);

    if (!user?.isActive || !valid) {
      throw new ORPCError("UNAUTHORIZED", { message: "Invalid credentials" });
    }

    const token = signToken({
      userId: user.id,
      role: user.role,
      email: user.email
    });

    await writeAuditLog({
      actorUserId: user.id,
      action: "LOGIN",
      entityType: "User",
      entityId: user.id
    });

    return loginResponseSchema.parse({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName
      }
    });
  });
const loginHandler = new OpenAPIHandler({ loginProcedure });

router.post("/login", loginRateLimiter(), delegarAOrpc(loginHandler, PREFIJO_ABSOLUTO));

const meProcedure = orpc
  .route({ method: "GET", path: "/me" })
  .output(meResponseSchema)
  .handler(async ({ context }) => {
    const user = await db
      .selectFrom("User")
      .select(["id", "email", "role", "fullName", "isActive", "createdAt"])
      .where("id", "=", context.user!.id)
      .executeTakeFirst();

    /* v8 ignore if -- @preserve: solo alcanzable por una carrera entre `authenticate` y este handler — `authenticate` acaba de consultar la misma fila */
    if (!user) {
      throw new ORPCError("UNAUTHORIZED", { message: "User not active" });
    }

    return meResponseSchema.parse({
      ...user,
      createdAt: user.createdAt.toISOString()
    });
  });
const meHandler = new OpenAPIHandler({ meProcedure });

router.get(
  "/me",
  authenticate,
  authorize({ roles: CUALQUIER_ROL, acceso: { scopeEnQuery: "User.id = usuario" } }),
  delegarAOrpc(meHandler, PREFIJO_ABSOLUTO, conUsuario)
);

export const authOrpcRouter = {
  loginProcedure,
  meProcedure
};

export default router;
