import type { LoginResponse, MeResponse } from "@plataforma/shared";
import { loginRequestSchema } from "@plataforma/shared";
import bcrypt from "bcrypt";
import { Router } from "express";
import { signToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middlewares/auth";
import { writeAuditLog } from "../utils/audit";

const router = Router();

router.post("/login", async (req, res) => {
  // El schema vive en packages/shared, no acá (regla 6): el front importa el
  // mismo tipo, así que una respuesta que cambie de forma rompe su typecheck.
  const parsed = loginRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email }
  });

  // Misma respuesta para "no existe" y para "password incorrecta": distinguirlas
  // convertiría al endpoint en un oráculo de qué emails están registrados.
  if (!user || !user.isActive) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);

  if (!valid) {
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
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      email: true,
      role: true,
      fullName: true,
      isActive: true,
      createdAt: true
    }
  });

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
