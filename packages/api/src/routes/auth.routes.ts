import type { LoginResponse, MeResponse } from "@plataforma/shared";
import { loginRequestSchema } from "@plataforma/shared";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { Router } from "express";
import { signToken } from "../lib/jwt";
import { db } from "../lib/db";
import { authenticate } from "../middlewares/auth";
import { loginRateLimiter } from "../middlewares/rateLimit";
import { writeAuditLog } from "../utils/audit";

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

router.post("/login", loginRateLimiter(), async (req, res) => {
  // El schema vive en packages/shared, no acá (regla 6): el front importa el
  // mismo tipo, así que una respuesta que cambie de forma rompe su typecheck.
  const parsed = loginRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const user = await db
    .selectFrom("User")
    .selectAll()
    .where("email", "=", parsed.data.email)
    .executeTakeFirst();

  // Se compara SIEMPRE, exista el usuario o no: es lo que hace que los tres
  // rechazos —no existe, inactivo, password incorrecta— cuesten lo mismo. Y por
  // eso los tres se resuelven en un solo `if`, después de la comparación: un
  // `return` temprano acá arriba vuelve a abrir el oráculo sin que se note.
  const valid = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? HASH_DUMMY);

  // Misma respuesta para los tres: distinguirlas convertiría al endpoint en un
  // oráculo de qué emails están registrados.
  if (!user || !user.isActive || !valid) {
    return res.status(401).json({ message: "Invalid credentials" });
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

  // Tipado explícito a propósito: es lo que impide que un campo nuevo del modelo
  // —passwordHash, el primero de la lista— se filtre a la respuesta por un
  // spread distraído. El compilador lo rechaza antes que cualquier revisor.
  const body: LoginResponse = {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName
    }
  };

  return res.json(body);
});

router.get("/me", authenticate, async (req, res) => {
  const user = await db
    .selectFrom("User")
    .select(["id", "email", "role", "fullName", "isActive", "createdAt"])
    .where("id", "=", req.user!.id)
    .executeTakeFirst();

  // `authenticate` ya validó que existe y está activo, así que esto solo pasa si
  // lo borraron entre una consulta y la otra. Antes devolvía 200 con body `null`,
  // que ningún cliente sabe interpretar; 401 es la misma postura que authenticate.
  if (!user) {
    return res.status(401).json({ message: "User not active" });
  }

  const body: MeResponse = {
    ...user,
    createdAt: user.createdAt.toISOString() // JSON no tiene tipo fecha; UTC (regla 1)
  };

  return res.json(body);
});

export default router;
