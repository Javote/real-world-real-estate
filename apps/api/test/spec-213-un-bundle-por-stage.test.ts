import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createId } from "../src/db/id.js";
import { MIGRATIONS_DIR } from "../src/db/migrate.js";
import { db } from "../src/lib/db.js";
import { createClient } from "../src/lib/libsql-client.js";
import { FIXTURES } from "./global-setup.js";

const SQL_MIGRACION_0007 = readFileSync(
  path.join(MIGRATIONS_DIR, "0007_evidence_bundle_unico.sql"),
  "utf-8"
);
const STATEMENTS_0007 = SQL_MIGRACION_0007.split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

async function baseConDosBundlesLegitimos() {
  const c = createClient({ url: ":memory:" });
  await c.execute(`
    CREATE TABLE Stage (id text PRIMARY KEY NOT NULL, projectId text NOT NULL)
  `);
  await c.execute(`
    CREATE TABLE EvidenceBundle (
      id text PRIMARY KEY NOT NULL,
      projectId text NOT NULL,
      stageId text NOT NULL,
      commitmentHash text NOT NULL,
      createdAt integer NOT NULL
    )
  `);
  await c.execute(
    "CREATE UNIQUE INDEX EvidenceBundle_stageId_commitmentHash_key ON EvidenceBundle (stageId, commitmentHash)"
  );
  await c.execute({
    sql: "INSERT INTO Stage (id, projectId) VALUES (?, ?)",
    args: ["stage-1", "proyecto-1"]
  });
  await c.execute({
    sql: "INSERT INTO EvidenceBundle (id, projectId, stageId, commitmentHash, createdAt) VALUES (?, ?, ?, ?, ?)",
    args: ["bundle-1", "proyecto-1", "stage-1", "a".repeat(64), 1]
  });
  await c.execute({
    sql: "INSERT INTO EvidenceBundle (id, projectId, stageId, commitmentHash, createdAt) VALUES (?, ?, ?, ?, ?)",
    args: ["bundle-2", "proyecto-1", "stage-1", "b".repeat(64), 2]
  });
  return c;
}

describe("un leftJoin directo a EvidenceBundle sigue duplicando con bundles legítimos", () => {
  it("dos subidas de evidencia (sin bug) producen dos filas en un leftJoin plano", async () => {
    const c = await baseConDosBundlesLegitimos();

    const filas = await c.execute(`
      SELECT Stage.id as stageId, EvidenceBundle.commitmentHash as commitmentHash
      FROM Stage
      LEFT JOIN EvidenceBundle ON EvidenceBundle.stageId = Stage.id
      WHERE Stage.projectId = 'proyecto-1'
    `);

    expect(filas.rows).toHaveLength(2);

    c.close();
  });

  it("el leftJoin a través de ultimoBundlePorStage (SQL equivalente) devuelve una sola fila: la vigente", async () => {
    const c = await baseConDosBundlesLegitimos();

    const filas = await c.execute(`
      SELECT Stage.id as stageId, ultimo.commitmentHash as commitmentHash
      FROM Stage
      LEFT JOIN (
        SELECT * FROM EvidenceBundle ultimo
        WHERE NOT EXISTS (
          SELECT 1 FROM EvidenceBundle masNuevo
          WHERE masNuevo.stageId = ultimo.stageId AND masNuevo.createdAt > ultimo.createdAt
        )
      ) ultimo ON ultimo.stageId = Stage.id
      WHERE Stage.projectId = 'proyecto-1'
    `);

    expect(filas.rows).toHaveLength(1);
    expect(filas.rows[0]?.commitmentHash).toBe("b".repeat(64));

    c.close();
  });
});

describe("UNIQUE(stageId, commitmentHash) — el duplicado exacto sí se rechaza, la evidencia legítima no", () => {
  it("dos bundles con roots DISTINTOS para el mismo stage se aceptan los dos (evidencia acumulándose)", async () => {
    const c = await baseConDosBundlesLegitimos();
    const filas = await c.execute(
      "SELECT commitmentHash FROM EvidenceBundle WHERE stageId = 'stage-1'"
    );
    expect(filas.rows).toHaveLength(2);
    c.close();
  });

  it("un segundo bundle con el MISMO root para el mismo stage se rechaza — el bug real", async () => {
    const c = await baseConDosBundlesLegitimos();

    await expect(
      c.execute({
        sql: "INSERT INTO EvidenceBundle (id, projectId, stageId, commitmentHash, createdAt) VALUES (?, ?, ?, ?, ?)",
        args: ["bundle-3", "proyecto-1", "stage-1", "b".repeat(64), 3]
      })
    ).rejects.toThrow();

    c.close();
  });

  it("el MISMO root en OTRO stage no choca — la unicidad es por (stageId, commitmentHash), no por commitmentHash solo", async () => {
    const c = await baseConDosBundlesLegitimos();
    await c.execute({
      sql: "INSERT INTO Stage (id, projectId) VALUES (?, ?)",
      args: ["stage-2", "proyecto-1"]
    });

    await expect(
      c.execute({
        sql: "INSERT INTO EvidenceBundle (id, projectId, stageId, commitmentHash, createdAt) VALUES (?, ?, ?, ?, ?)",
        args: ["bundle-3", "proyecto-1", "stage-2", "a".repeat(64), 1]
      })
    ).resolves.toBeDefined();

    c.close();
  });
});

describe("migración 0007 — corrida dos veces (regla 8)", () => {
  it("la segunda corrida no falla: DROP INDEX IF EXISTS y CREATE UNIQUE INDEX IF NOT EXISTS", async () => {
    const c = createClient({ url: ":memory:" });
    await c.execute(`
      CREATE TABLE EvidenceBundle (
        id text PRIMARY KEY NOT NULL,
        projectId text NOT NULL,
        stageId text NOT NULL,
        commitmentHash text NOT NULL,
        createdAt integer NOT NULL
      )
    `);
    await c.execute("CREATE INDEX EvidenceBundle_stageId_idx ON EvidenceBundle (stageId)");

    for (const statement of STATEMENTS_0007) await c.execute(statement);
    for (const statement of STATEMENTS_0007) await c.execute(statement);

    const filas = await c.execute("SELECT name FROM sqlite_master WHERE type = 'index'");
    expect(filas.rows.map((r) => r.name)).toContain("EvidenceBundle_stageId_commitmentHash_key");

    c.close();
  });
});

describe("EvidenceBundle_stageId_commitmentHash_key contra el esquema real", () => {
  afterAll(async () => {
    await db.destroy();
  });

  it("la migración 0007 dejó el índice único aplicado — un segundo bundle con el mismo root para el mismo stage se rechaza", async () => {
    const ahora = new Date();
    const proyecto = (
      await db
        .selectFrom("Project")
        .select("id")
        .where("slug", "=", FIXTURES.proyecto.slug)
        .executeTakeFirstOrThrow()
    ).id;
    const stageId = createId();
    await db
      .insertInto("Stage")
      .values({
        id: stageId,
        projectId: proyecto,
        name: "SPEC-213 unicidad",
        sequenceOrder: 995_001,
        state: "InProgress",
        validationCritical: true,
        createdAt: ahora,
        updatedAt: ahora
      })
      .execute();

    await db
      .insertInto("EvidenceBundle")
      .values({
        id: createId(),
        projectId: proyecto,
        stageId,
        commitmentHash: "c".repeat(64),
        createdById: null,
        createdAt: ahora
      })
      .execute();

    await expect(
      db
        .insertInto("EvidenceBundle")
        .values({
          id: createId(),
          projectId: proyecto,
          stageId,
          commitmentHash: "c".repeat(64),
          createdById: null,
          createdAt: ahora
        })
        .execute()
    ).rejects.toThrow();

    await expect(
      db
        .insertInto("EvidenceBundle")
        .values({
          id: createId(),
          projectId: proyecto,
          stageId,
          commitmentHash: "d".repeat(64),
          createdById: null,
          createdAt: ahora
        })
        .execute()
    ).resolves.toBeDefined();
  });
});
