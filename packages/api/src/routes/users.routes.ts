import { passwordSchema } from "@plataforma/shared";
import bcrypt from "bcrypt";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, requireRole } from "../middlewares/auth";
import { writeAuditLog } from "../utils/audit";

const router = Router();

router.use(authenticate, requireRole("admin"));

router.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      fullName: true,
      isActive: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" }
  });

  return res.json(users);
});

router.post("/", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: passwordSchema,
    role: z.enum(["admin", "developer", "buyer", "verifier"]),
    fullName: z.string().min(1)
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
      fullName: parsed.data.fullName
    },
    select: {
      id: true,
      email: true,
      role: true,
      fullName: true,
      isActive: true
    }
  });

  await writeAuditLog({
    actorUserId: req.user!.id,
    action: "CREATE_USER",
    entityType: "User",
    entityId: user.id
  });

  return res.status(201).json(user);
});

router.get("/:id", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      email: true,
      role: true,
      fullName: true,
      isActive: true,
      createdAt: true
    }
  });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  return res.json(user);
});

router.patch("/:id", async (req, res) => {
  const schema = z.object({
    fullName: z.string().min(1).optional(),
    role: z.enum(["admin", "developer", "buyer", "verifier"]).optional(),
    isActive: z.boolean().optional(),
    password: passwordSchema.optional()
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const data: Record<string, unknown> = {};

  if (parsed.data.fullName !== undefined) data.fullName = parsed.data.fullName;
  if (parsed.data.role !== undefined) data.role = parsed.data.role;
  if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
  if (parsed.data.password !== undefined) {
    data.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data,
    select: {
      id: true,
      email: true,
      role: true,
      fullName: true,
      isActive: true
    }
  });

  await writeAuditLog({
    actorUserId: req.user!.id,
    action: "UPDATE_USER",
    entityType: "User",
    entityId: user.id
  });

  return res.json(user);
});

router.delete("/:id", async (req, res) => {
  await prisma.user.delete({
    where: { id: req.params.id }
  });

  await writeAuditLog({
    actorUserId: req.user!.id,
    action: "DELETE_USER",
    entityType: "User",
    entityId: req.params.id
  });

  return res.status(204).send();
});

export default router;
