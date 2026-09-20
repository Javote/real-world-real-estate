import { randomUUID } from "node:crypto";
import { loginRequestSchema, loginResponseSchema, meResponseSchema } from "@plataforma/shared";
import bcrypt from "bcrypt";
import { Router } from "express";
import type { UserRole } from "../db/types";
import { db } from "../lib/db";
import { signToken } from "../lib/jwt";
import { OpenAPIHandler, ORPCError, os } from "../lib/orpc";
import { authenticate, authorize, CUALQUIER_ROL } from "../middlewares/auth";
import { loginRateLimiter } from "../middlewares/rateLimit";
import { writeAuditLog } from "../utils/audit";

// **SPEC-216 §E2 — migrado a oRPC (D-066)**, junto con `public.routes.ts`: los
// dos primeros routers sin sesión que se migran — ninguna de las 45 rutas de
// las cuatro sub-partes de SPEC-212 corría sin `authenticate` antes.
//
// **Lo nuevo acá, resuelto de la forma más simple que el diseño preveía**
// (`AuthContext` con `user` OPCIONAL, no dos routers de generación separados):
// `POST /login` nunca tiene `req.user` —es el endpoint que lo crea— y
// `GET /me` siempre lo tiene, porque `authenticate` corre antes. Un solo
// `$context<AuthContext>()` cubre los dos: el procedimiento de login no toca
// `context.user`, y el de `/me` lo lee con `!` (no-null assertion), la MISMA
// garantía que ya usa `req.user!` en el resto de la API — la da `authenticate`,
// corrido como middleware Express antes de que oRPC vea la request, no el tipo.

const PREFIJO_ABSOLUTO = "/api/v1/auth";

export type AuthContext = { user?: { id: string; email: string; role: UserRole } };
const orpc = os.$context<AuthContext>();

const router = Router();

/**
 * Hash contra el que se compara cuando el email no corresponde a ningún usuario.
 *
 * Existe para que `/login` tarde lo mismo exista o no la cuenta: sin él, el
 * camino "no existe" cortaba antes de `bcrypt.compare` y el endpoint respondía
 * ~81 ms más rápido (medido). El cuerpo de la respuesta ya era idéntico, así que
 * el oráculo de enumeración no se consultaba leyendo el body sino con un
 * cronómetro — que es igual de gratis.
 *
 * Se deriva de un UUID aleatorio por proceso: ninguna password puede coincidir,
 * y no queda en el repo un literal con forma de hash de credencial. Se calcula
 * una vez al cargar el módulo, no por request: hacerlo por request costaría otro
 * bcrypt entero y agregaría su propia varianza temporal.
 */
const HASH_DUMMY = bcrypt.hashSync(randomUUID(), 10);

/**
 * **La comparación de tiempo constante no se toca por la migración.**
 * `bcrypt.compare` sigue corriendo siempre, exista el usuario o no
 * (`HASH_DUMMY`) — es lógica de dominio adentro del `.handler()`, y oRPC no le
 * agrega ni le saca latencia estructural distinta de la que ya mide
 * `test/auth-timing.test.ts`.
 *
 * El 401 es un `ORPCError` liso, no un error con nombre (`.errors({...})`):
 * ningún test fija el shape exacto del body de rechazo, solo que las dos
 * respuestas (email inexistente / password incorrecta) sean IDÉNTICAS entre
 * sí y que ninguna traiga `token` — ambas cosas siguen valiendo con el sobre
 * nativo de oRPC.
 */
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

    // Se compara SIEMPRE, exista el usuario o no: es lo que hace que los tres
    // rechazos —no existe, inactivo, password incorrecta— cuesten lo mismo. Y
    // por eso los tres se resuelven en un solo `if`, después de la
    // comparación: un `throw` temprano acá arriba vuelve a abrir el oráculo
    // sin que se note.
    const valid = await bcrypt.compare(input.password, user?.passwordHash ?? HASH_DUMMY);

    // Misma respuesta para los tres: distinguirlas convertiría al endpoint en
    // un oráculo de qué emails están registrados.
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

    // `.parse()` y no solo el tipo: es lo que impide que un campo nuevo del
    // modelo —passwordHash, el primero de la lista— se filtre a la respuesta
    // por un spread distraído. `z.strictObject` lo rechaza en RUNTIME, no solo
    // en el compilador, que un `spread` distraído puede engañar igual.
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

router.post("/login", loginRateLimiter(), async (req, res, next) => {
  const { matched } = await loginHandler.handle(req, res, { prefix: PREFIJO_ABSOLUTO });
  if (!matched) next();
});

const meProcedure = orpc
  .route({ method: "GET", path: "/me" })
  .output(meResponseSchema)
  .handler(async ({ context }) => {
    const user = await db
      .selectFrom("User")
      .select(["id", "email", "role", "fullName", "isActive", "createdAt"])
      .where("id", "=", context.user!.id)
      .executeTakeFirst();

    // `authenticate` ya validó que existe y está activo, así que esto solo pasa
    // si lo borraron entre una consulta y la otra. 401 es la misma postura que
    // `authenticate`.
    if (!user) {
      throw new ORPCError("UNAUTHORIZED", { message: "User not active" });
    }

    return meResponseSchema.parse({
      ...user,
      createdAt: user.createdAt.toISOString() // JSON no tiene tipo fecha; UTC (regla 1)
    });
  });
const meHandler = new OpenAPIHandler({ meProcedure });

router.get(
  "/me",
  authenticate,
  authorize({ roles: CUALQUIER_ROL, acceso: { scopeEnQuery: "User.id = usuario" } }),
  async (req, res, next) => {
    const { matched } = await meHandler.handle(req, res, {
      prefix: PREFIJO_ABSOLUTO,
      context: { user: req.user! }
    });
    if (!matched) next();
  }
);

/** El router oRPC combinado de esta vertical — lo consume
 * `scripts/generate-openapi.ts` para generar el fragmento de OpenAPI de las 2
 * rutas migradas. */
export const authOrpcRouter = {
  loginProcedure,
  meProcedure
};

export default router;
