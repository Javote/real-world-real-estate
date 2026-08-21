import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcrypt";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import { projectMembers, projects, users } from "../src/db/schema";
import { createClient } from "../src/lib/libsql-client";

// Drizzle-kit resuelve las rutas SQLite relativas al cwd del proceso (acá,
// packages/api), así que `file:./test.db` cae directo en packages/api/test.db
// — ya no en prisma/test.db, que dejó de existir con la migración a Drizzle.
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

  const client = createClient({ url: DATABASE_URL });
  const db = drizzle(client);

  // Equivalente a `prisma migrate deploy`: aplica las migraciones commiteadas en
  // `drizzle/`, así la suite verifica las migraciones reales que van a correr en
  // producción y no una proyección del schema.
  await migrate(db, { migrationsFolder: "./drizzle" });

  const hash = (pw: string) => bcrypt.hash(pw, 10);

  await db.insert(users).values([
    {
      email: FIXTURES.activo.email,
      passwordHash: await hash(FIXTURES.activo.password),
      role: "developer",
      fullName: FIXTURES.activo.fullName,
      isActive: true,
    },
    {
      email: FIXTURES.inactivo.email,
      passwordHash: await hash(FIXTURES.inactivo.password),
      role: "buyer",
      fullName: FIXTURES.inactivo.fullName,
      isActive: false,
    },
    {
      email: FIXTURES.revocable.email,
      passwordHash: await hash(FIXTURES.revocable.password),
      role: "admin",
      fullName: FIXTURES.revocable.fullName,
      isActive: true,
    },
    {
      email: FIXTURES.ajeno.email,
      passwordHash: await hash(FIXTURES.ajeno.password),
      role: "developer",
      fullName: FIXTURES.ajeno.fullName,
      isActive: true,
    },
    {
      email: FIXTURES.admin.email,
      passwordHash: await hash(FIXTURES.admin.password),
      role: "admin",
      fullName: FIXTURES.admin.fullName,
      isActive: true,
    },
  ]);

  // Un proyecto con UN developer miembro y otro que no lo es: sin eso no se
  // puede testear la segunda capa de autorización (rol global + membresía).
  const [proyecto] = await db
    .insert(projects)
    .values({
      name: "Torre Test",
      slug: FIXTURES.proyecto.slug,
      status: "in_progress",
      totalUnits: 10,
    })
    .returning();

  const [miembro] = await db.select().from(users).where(eq(users.email, FIXTURES.activo.email));

  await db.insert(projectMembers).values([
    { projectId: proyecto.id, userId: miembro.id, membershipRole: "developer" },
    // DOS membresías sobre el MISMO proyecto: el schema lo permite (índice único
    // por userId+projectId+membershipRole) y el listado viejo lo devolvía
    // duplicado. Sin este fixture, esa regresión no se ve.
    { projectId: proyecto.id, userId: miembro.id, membershipRole: "buyer" },
  ]);

  // Segundo proyecto, sin ningún miembro: es contra lo que se mide que el
  // listado scopee. Se crea después, así que es el más nuevo por createdAt.
  await db.insert(projects).values({
    name: "Torre Ajena",
    slug: FIXTURES.otroProyecto.slug,
    status: "planning",
    totalUnits: 4,
  });

  client.close();
}
