import {
  createUserSchema,
  cuidParamSchema,
  updateUserSchema,
  userMutationResultSchema,
  userSummarySchema
} from "@plataforma/shared";
import bcrypt from "bcrypt";
import { type Request, Router } from "express";
import { createId } from "../db/id";
import { db } from "../lib/db";
import { authenticate, authorize } from "../middlewares/auth";
import { paramValidator } from "../middlewares/validate-params";
import { writeAuditLog } from "../utils/audit";

const router = Router();

router.param("id", paramValidator(cuidParamSchema));

router.use(authenticate);

const USER_LIST_COLUMNS = ["id", "email", "role", "fullName", "isActive", "createdAt"] as const;

router.get("/", authorize({ roles: ["admin"], acceso: "soloRol" }), async (_req, res) => {
  const userList = await db
    .selectFrom("User")
    .select(USER_LIST_COLUMNS)
    .orderBy("createdAt", "desc")
    .execute();

  return res.json(userList.map((u) => userSummarySchema.parse(u)));
});

router.post("/", authorize({ roles: ["admin"], acceso: "soloRol" }), async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const now = new Date();

  const user = await db
    .insertInto("User")
    .values({
      id: createId(),
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
      fullName: parsed.data.fullName,
      isActive: true,
      createdAt: now,
      updatedAt: now
    })
    .returning(["id", "email", "role", "fullName", "isActive"])
    .executeTakeFirstOrThrow();

  await writeAuditLog({
    actorUserId: req.user!.id,
    action: "CREATE_USER",
    entityType: "User",
    entityId: user.id
  });

  return res.status(201).json(userMutationResultSchema.parse(user));
});

router.get(
  "/:id",
  authorize({ roles: ["admin"], acceso: "soloRol" }),
  async (req: Request<{ id: string }>, res) => {
    const user = await db
      .selectFrom("User")
      .select(USER_LIST_COLUMNS)
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(userSummarySchema.parse(user));
  }
);

router.patch(
  "/:id",
  authorize({ roles: ["admin"], acceso: "soloRol" }),
  async (req: Request<{ id: string }>, res) => {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.flatten());
    }

    const data: {
      fullName?: string;
      role?: (typeof parsed.data)["role"];
      isActive?: boolean;
      passwordHash?: string;
      updatedAt: Date;
    } = { updatedAt: new Date() };

    if (parsed.data.fullName !== undefined) data.fullName = parsed.data.fullName;
    if (parsed.data.role !== undefined) data.role = parsed.data.role;
    if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
    if (parsed.data.password !== undefined) {
      data.passwordHash = await bcrypt.hash(parsed.data.password, 10);
    }

    const user = await db
      .updateTable("User")
      .set(data)
      .where("id", "=", req.params.id)
      .returning(["id", "email", "role", "fullName", "isActive"])
      .executeTakeFirstOrThrow();

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "UPDATE_USER",
      entityType: "User",
      entityId: user.id
    });

    return res.json(userMutationResultSchema.parse(user));
  }
);

router.delete(
  "/:id",
  authorize({ roles: ["admin"], acceso: "soloRol" }),
  async (req: Request<{ id: string }>, res) => {
    await db.deleteFrom("User").where("id", "=", req.params.id).execute();

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "DELETE_USER",
      entityType: "User",
      entityId: req.params.id
    });

    return res.status(204).send();
  }
);

export default router;
