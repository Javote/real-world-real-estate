import { Router } from "express";
import { db } from "../lib/db";
import { authenticate, authorize } from "../middlewares/auth";

const router = Router();

router.use(authenticate);

router.get("/", authorize({ roles: ["admin"], acceso: "soloRol" }), async (_req, res) => {
  const logs = await db
    .selectFrom("AuditLog")
    .selectAll()
    .orderBy("createdAt", "desc")
    .limit(200)
    .execute();

  return res.json(logs);
});

export default router;
