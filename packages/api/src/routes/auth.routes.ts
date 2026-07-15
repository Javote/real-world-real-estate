import bcrypt from "bcrypt";
import { Router } from "express";
import { z } from "zod";
import { signToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middlewares/auth";
import { writeAuditLog } from "../utils/audit";

const router = Router();

router.post("/login", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(3)
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email }
  });

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

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName
    }
  });
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

  return res.json(user);
});

export default router;
