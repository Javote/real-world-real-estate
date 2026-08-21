import { passwordSchema } from "@plataforma/shared";
import bcrypt from "bcrypt";
import { desc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { users } from "../db/schema";
import { db } from "../lib/db";
import { authenticate, requireRole } from "../middlewares/auth";
import { writeAuditLog } from "../utils/audit";

const router = Router();

router.use(authenticate, requireRole("admin"));

router.get("/", async (_req, res) => {
  const userList = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      fullName: users.fullName,
      isActive: users.isActive,
      createdAt: users.createdAt
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  return res.json(userList);
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

  const [user] = await db
    .insert(users)
    .values({
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
      fullName: parsed.data.fullName
    })
    .returning({
      id: users.id,
      email: users.email,
      role: users.role,
      fullName: users.fullName,
      isActive: users.isActive
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
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      fullName: users.fullName,
      isActive: users.isActive,
      createdAt: users.createdAt
    })
    .from(users)
    .where(eq(users.id, req.params.id));

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

  const data: {
    fullName?: string;
    role?: (typeof parsed.data)["role"];
    isActive?: boolean;
    passwordHash?: string;
  } = {};

  if (parsed.data.fullName !== undefined) data.fullName = parsed.data.fullName;
  if (parsed.data.role !== undefined) data.role = parsed.data.role;
  if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
  if (parsed.data.password !== undefined) {
    data.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  }

  const [user] = await db
    .update(users)
    .set(data)
    .where(eq(users.id, req.params.id))
    .returning({
      id: users.id,
      email: users.email,
      role: users.role,
      fullName: users.fullName,
      isActive: users.isActive
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
  await db.delete(users).where(eq(users.id, req.params.id));

  await writeAuditLog({
    actorUserId: req.user!.id,
    action: "DELETE_USER",
    entityType: "User",
    entityId: req.params.id
  });

  return res.status(204).send();
});

export default router;
