import { Router } from "express";
import { db } from "../lib/db";
import { authenticate, requireRole } from "../middlewares/auth";

const router = Router();

router.use(authenticate, requireRole("admin"));

router.get("/", async (_req, res) => {
  const logs = await db
    .selectFrom("AuditLog")
    .selectAll()
    .orderBy("createdAt", "desc")
    .limit(200)
    .execute();

  return res.json(logs);
});

export default router;
