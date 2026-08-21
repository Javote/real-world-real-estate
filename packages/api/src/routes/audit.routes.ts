import { desc } from "drizzle-orm";
import { Router } from "express";
import { auditLogs } from "../db/schema";
import { db } from "../lib/db";
import { authenticate, requireRole } from "../middlewares/auth";

const router = Router();

router.use(authenticate, requireRole("admin"));

router.get("/", async (_req, res) => {
  const logs = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(200);

  return res.json(logs);
});

export default router;
