import { type Request, Router } from "express";
import { db } from "../lib/db";
import { authenticate, requireRole } from "../middlewares/auth";

// Favoritos del investor (M2-D5 fila 13).
//
// La entidad más chica del backlog y la única que **no toca la cadena de
// prueba**: un usuario marca un proyecto y nada más. No hay hash, no hay
// anclaje, no hay señal de verificación — por eso el `Favorite` no lleva más
// que las dos claves y la fecha.

const router = Router();

router.use(authenticate);

router.get("/investor/favorites", requireRole("admin", "buyer"), async (req, res) => {
  const favoritos = await db
    .selectFrom("Favorite")
    .innerJoin("Project", "Project.id", "Favorite.projectId")
    .selectAll("Project")
    .where("Favorite.userId", "=", req.user!.id)
    .orderBy("Favorite.createdAt", "desc")
    .execute();

  return res.json(favoritos);
});

router.post(
  "/investor/favorites/:projectId",
  requireRole("admin", "buyer"),
  async (req: Request<{ projectId: string }>, res) => {
    const proyecto = await db
      .selectFrom("Project")
      .select("id")
      .where("id", "=", req.params.projectId)
      .executeTakeFirst();

    if (!proyecto) return res.status(404).json({ message: "Project not found" });

    // Idempotente: marcar dos veces no es un error, es la misma intención.
    await db
      .insertInto("Favorite")
      .values({ userId: req.user!.id, projectId: proyecto.id, createdAt: new Date() })
      .onConflict((oc) => oc.columns(["userId", "projectId"]).doNothing())
      .execute();

    return res.status(204).send();
  }
);

router.delete(
  "/investor/favorites/:projectId",
  requireRole("admin", "buyer"),
  async (req: Request<{ projectId: string }>, res) => {
    await db
      .deleteFrom("Favorite")
      .where("userId", "=", req.user!.id)
      .where("projectId", "=", req.params.projectId)
      .execute();

    // 204 aunque no existiera: el estado final es el mismo y el cliente no
    // gana nada distinguiendo.
    return res.status(204).send();
  }
);

export default router;
