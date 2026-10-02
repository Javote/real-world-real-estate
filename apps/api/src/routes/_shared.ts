import type { UserRole } from "../db/types";
import { db } from "../lib/db";
import { projectScope } from "../middlewares/auth";
import { codigoDeRestriccion } from "../middlewares/errorHandler";

type ManejadoresDeRestriccion = {
  RESOURCE_ALREADY_EXISTS: (opts: { message: string }) => unknown;
  RELATED_RESOURCE_NOT_FOUND: (opts: { message: string }) => unknown;
};

export function relanzarRestriccionComoOrpc(err: unknown, errors: ManejadoresDeRestriccion): never {
  const restriccion = codigoDeRestriccion(err);

  if (
    restriccion === "SQLITE_CONSTRAINT_UNIQUE" ||
    restriccion === "SQLITE_CONSTRAINT_PRIMARYKEY"
  ) {
    throw errors.RESOURCE_ALREADY_EXISTS({ message: "Resource already exists" });
  }
  if (restriccion === "SQLITE_CONSTRAINT_FOREIGNKEY") {
    throw errors.RELATED_RESOURCE_NOT_FOUND({ message: "A referenced resource does not exist" });
  }

  throw err;
}

export async function avancePorProyecto(projectIds: string[]): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  if (projectIds.length === 0) return mapa;

  const stages = await db
    .selectFrom("Stage")
    .select(["projectId", "state"])
    .where("projectId", "in", projectIds)
    .execute();

  for (const id of projectIds) {
    const suyos = stages.filter((s) => s.projectId === id);
    const completados = suyos.filter((s) => s.state === "Completed").length;
    mapa.set(id, suyos.length ? Math.round((completados / suyos.length) * 100) : 0);
  }
  return mapa;
}

export async function conStages<P extends { id: string }>(projectRows: P[]) {
  const projectIds = projectRows.map((p) => p.id);
  const stageRows = projectIds.length
    ? await db
        .selectFrom("Stage")
        .selectAll()
        .where("projectId", "in", projectIds)
        .orderBy("sequenceOrder", "asc")
        .execute()
    : [];

  const stagesByProject = new Map<string, typeof stageRows>();
  for (const stage of stageRows) {
    const list = stagesByProject.get(stage.projectId) ?? [];
    list.push(stage);
    stagesByProject.set(stage.projectId, list);
  }

  return projectRows.map((project) => ({
    ...project,
    stages: stagesByProject.get(project.id) ?? []
  }));
}

export function proyectosVisibles(userId: string, role: UserRole) {
  return db
    .selectFrom("Project")
    .select("Project.id")
    .where((eb) => projectScope(eb, role, userId, ["developer", "buyer", "verifier"]));
}

export const EVIDENCE_SAFE_COLUMNS = [
  "id",
  "projectId",
  "stageId",
  "uploadedById",
  "evidenceType",
  "category",
  "authoritative",
  "originalFilename",
  "storedFilename",
  "mimeType",
  "sizeBytes",
  "sha256Hash",
  "uploadedAt",
  "createdAt",
  "updatedAt"
] as const;
