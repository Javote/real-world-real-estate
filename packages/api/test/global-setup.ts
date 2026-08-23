import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcrypt";
import { Kysely } from "../src/lib/kysely";
import { LibsqlDialect } from "../src/lib/libsql-dialect";
import type { Database } from "../src/db/types";
import { SqliteTypeCoercionPlugin } from "../src/db/sqlite-type-plugin";
import { createId } from "../src/db/id";
import { createClient } from "../src/lib/libsql-client";
import { applyPendingMigrations } from "../src/db/migrate";

// El migrador propio (D-049) resuelve rutas relativas al cwd del proceso
// (acá, packages/api), así que `file:./test.db` cae directo en
// packages/api/test.db.
const DATABASE_URL = "file:./test.db";
const DB_FILE = path.join(process.cwd(), "test.db");

export const FIXTURES = {
  /** developer, activo y MIEMBRO del proyecto de prueba */
  activo: { email: "dev@test.local", password: "dev123", fullName: "Dev Test" },
  inactivo: { email: "inactivo@test.local", password: "inactivo123", fullName: "Inactivo Test" },
  revocable: { email: "revocable@test.local", password: "revocable123", fullName: "Revocable Test" },
  /** developer activo pero SIN membresía: la segunda capa de autorización */
  ajeno: { email: "ajeno@test.local", password: "ajeno123", fullName: "Ajeno Test" },
  /** admin que ningún test muta — `revocable` se desactiva en auth.test.ts */
  admin: { email: "admin@test.local", password: "admin123", fullName: "Admin Test" },
  proyecto: { slug: "torre-test" },
  /** segundo proyecto, SIN miembros: sin él no se puede ver si el listado scopea */
  otroProyecto: { slug: "torre-ajena" },
};

export default async function setup() {
  for (const f of [DB_FILE, `${DB_FILE}-journal`, `${DB_FILE}-wal`, `${DB_FILE}-shm`]) {
    if (existsSync(f)) rmSync(f);
  }

  // Se aplican las migraciones REALES con el MISMO runner que corre en
  // producción (`src/db/migrate.ts`, D-052) y no una proyección ad-hoc del
  // schema: así la suite verifica lo mismo que va a correr desplegado. Mientras
  // el runner estuvo duplicado acá, esa garantía dependía de que las dos copias
  // no divergieran — o sea, no era una garantía.
  //
  // Cliente propio, aparte del que instancia `LibsqlDialect` más abajo (ver
  // `lib/db.ts` sobre por qué no se comparte uno): acá hace falta `execute()`
  // con SQL crudo, que Kysely no expone.
  const migrationClient = createClient({ url: DATABASE_URL });
  await applyPendingMigrations(migrationClient);
  migrationClient.close();

  const db = new Kysely<Database>({
    dialect: new LibsqlDialect({ url: DATABASE_URL }),
    plugins: [new SqliteTypeCoercionPlugin()]
  });

  const hash = (pw: string) => bcrypt.hash(pw, 10);
  const now = new Date();

  await db
    .insertInto("User")
    .values([
      {
        id: createId(),
        email: FIXTURES.activo.email,
        passwordHash: await hash(FIXTURES.activo.password),
        role: "developer",
        fullName: FIXTURES.activo.fullName,
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: createId(),
        email: FIXTURES.inactivo.email,
        passwordHash: await hash(FIXTURES.inactivo.password),
        role: "buyer",
        fullName: FIXTURES.inactivo.fullName,
        isActive: false,
        createdAt: now,
        updatedAt: now
      },
      {
        id: createId(),
        email: FIXTURES.revocable.email,
        passwordHash: await hash(FIXTURES.revocable.password),
        role: "admin",
        fullName: FIXTURES.revocable.fullName,
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: createId(),
        email: FIXTURES.ajeno.email,
        passwordHash: await hash(FIXTURES.ajeno.password),
        role: "developer",
        fullName: FIXTURES.ajeno.fullName,
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: createId(),
        email: FIXTURES.admin.email,
        passwordHash: await hash(FIXTURES.admin.password),
        role: "admin",
        fullName: FIXTURES.admin.fullName,
        isActive: true,
        createdAt: now,
        updatedAt: now
      }
    ])
    .execute();

  // Un proyecto con UN developer miembro y otro que no lo es: sin eso no se
  // puede testear la segunda capa de autorización (rol global + membresía).
  const proyecto = await db
    .insertInto("Project")
    .values({
      id: createId(),
      name: "Torre Test",
      slug: FIXTURES.proyecto.slug,
      status: "in_progress",
      totalUnits: 10,
      createdAt: now,
      updatedAt: now
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  const miembro = await db
    .selectFrom("User")
    .selectAll()
    .where("email", "=", FIXTURES.activo.email)
    .executeTakeFirstOrThrow();

  await db
    .insertInto("ProjectMember")
    .values([
      {
        id: createId(),
        projectId: proyecto.id,
        userId: miembro.id,
        membershipRole: "developer",
        createdAt: now
      },
      // DOS membresías sobre el MISMO proyecto: el schema lo permite (índice
      // único por userId+projectId+membershipRole) y el listado viejo lo
      // devolvía duplicado. Sin este fixture, esa regresión no se ve.
      {
        id: createId(),
        projectId: proyecto.id,
        userId: miembro.id,
        membershipRole: "buyer",
        createdAt: now
      }
    ])
    .execute();

  // Segundo proyecto, sin ningún miembro: es contra lo que se mide que el
  // listado scopee. Se crea después, así que es el más nuevo por createdAt.
  await db
    .insertInto("Project")
    .values({
      id: createId(),
      name: "Torre Ajena",
      slug: FIXTURES.otroProyecto.slug,
      status: "planning",
      totalUnits: 4,
      createdAt: new Date(now.getTime() + 1),
      updatedAt: new Date(now.getTime() + 1)
    })
    .execute();

  await db.destroy();
}
