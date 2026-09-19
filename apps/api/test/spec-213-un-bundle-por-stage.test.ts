import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createId } from "../src/db/id";
import { MIGRATIONS_DIR } from "../src/db/migrate";
import { db } from "../src/lib/db";
import { createClient } from "../src/lib/libsql-client";
import { FIXTURES } from "./global-setup";

const SQL_MIGRACION_0007 = readFileSync(
  path.join(MIGRATIONS_DIR, "0007_evidence_bundle_unico.sql"),
  "utf-8"
);
const STATEMENTS_0007 = SQL_MIGRACION_0007.split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

// SPEC-213 (anexo) — dos EvidenceBundle del MISMO stage no pueden tener el
// MISMO root. NO es "un stage tiene como máximo un EvidenceBundle" — esa
// primera formulación se probó y rompía comportamiento legítimo (ver el
// segundo describe): `crearBundle` corre en cada subida de evidencia, no
// solo al completar, así que un stage con 2+ subidas antes de completarse
// tiene, a propósito, más de un bundle con roots distintos.
//
// El bug real de producción era más angosto: "Terminaciones" de torre-a tenía
// 4 bundles y 3 roots — dos snapshots legítimos (1 y 2 evidencias) y UN
// duplicado exacto (mismo root que otro, por la doble-llamada a `crearBundle`
// en la misma completación, ya cerrada el 2026-09-09 hacia adelante).
// specs/evidence/evidence-bundle-torre-a-terminaciones-2026-09-18.json trae
// el detalle completo.
//
// Eso deja abierta la invariante 2 de la spec ("el masterHash de un dossier
// no depende de cuántas filas devuelva un join") para cualquier stage FUTURO
// con 2+ subidas: ningún índice único evita que existan varios bundles
// legítimos por stage. Lo que la cierra es `ultimoBundlePorStage`
// (domain/stage-transition.ts), que los tres `leftJoin` (dossier, certifier,
// investor) usan en vez de un `leftJoin` directo a `EvidenceBundle`.

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
  // Dos subidas de evidencia legítimas, sin completar — cada una escribe su
  // propio bundle con un root distinto. NO es el bug.
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

    // Este es el hallazgo real: ni siquiera hace falta el bug de duplicación
    // para que un leftJoin plano multiplique el artefacto — evidencia
    // acumulada normal ya alcanza. El índice único (stageId, commitmentHash)
    // no lo evita, porque los dos roots son distintos a propósito.
    expect(filas.rows).toHaveLength(2);

    c.close();
  });

  it("el leftJoin a través de ultimoBundlePorStage (SQL equivalente) devuelve una sola fila: la vigente", async () => {
    const c = await baseConDosBundlesLegitimos();

    // Mismo SQL que domain/stage-transition.ts → ultimoBundlePorStage.
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
    // baseConDosBundlesLegitimos() ya insertó los dos sin que nada tronara —
    // este test lo deja explícito: los dos siguen ahí.
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
    // Sin duplicados que borrar acá (el DELETE es por id literal, y ese id no
    // existe en esta base sintética) — lo que se prueba es que ninguno de los
    // tres statements truena en una segunda pasada.
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

    // Mismo root, mismo stage — el duplicado real. Se rechaza.
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

    // Root DISTINTO, mismo stage — evidencia acumulándose. Se acepta.
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
