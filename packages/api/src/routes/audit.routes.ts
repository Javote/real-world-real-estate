import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticate, requireRole } from "../middlewares/auth";

const router = Router();

router.use(authenticate, requireRole("admin"));

router.get("/", async (_req, res) => {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200
  });

  return res.json(logs);
});

export default router;
