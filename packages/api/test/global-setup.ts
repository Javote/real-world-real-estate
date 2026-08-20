import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcrypt";
import { MembershipRole, PrismaClient, ProjectStatus, UserRole } from "@prisma/client";

// Prisma resuelve las rutas SQLite relativas al archivo de schema, así que
// `file:./test.db` cae en prisma/test.db — misma convención que dev.db.
const DATABASE_URL = "file:./test.db";
const DB_FILE = path.join(process.cwd(), "prisma", "test.db");

export const FIXTURES = {
  /** developer, activo y MIEMBRO del proyecto de prueba */
  activo: { email: "dev@test.local", password: "dev123", fullName: "Dev Test" },
  inactivo: { email: "inactivo@test.local", password: "inactivo123", fullName: "Inactivo Test" },
  revocable: { email: "revocable@test.local", password: "revocable123", fullName: "Revocable Test" },
  /** developer activo pero SIN membresía: la segunda capa de autorización */
  ajeno: { email: "ajeno@test.local", password: "ajeno123", fullName: "Ajeno Test" },
  proyecto: { slug: "torre-test" },
};

export default async function setup() {
  for (const f of [DB_FILE, `${DB_FILE}-journal`]) {
    if (existsSync(f)) rmSync(f);
  }

  // `migrate deploy` y no `db push`: así la suite verifica las migraciones
  // reales que van a correr en producción, no una proyección del schema.
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL },
    stdio: "pipe",
  });

  const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
  const hash = (pw: string) => bcrypt.hash(pw, 10);

  await prisma.user.createMany({
    data: [
      {
        email: FIXTURES.activo.email,
        passwordHash: await hash(FIXTURES.activo.password),
        role: UserRole.developer,
        fullName: FIXTURES.activo.fullName,
        isActive: true,
      },
      {
        email: FIXTURES.inactivo.email,
        passwordHash: await hash(FIXTURES.inactivo.password),
        role: UserRole.buyer,
        fullName: FIXTURES.inactivo.fullName,
        isActive: false,
      },
      {
        email: FIXTURES.revocable.email,
        passwordHash: await hash(FIXTURES.revocable.password),
        role: UserRole.admin,
        fullName: FIXTURES.revocable.fullName,
        isActive: true,
      },
      {
        email: FIXTURES.ajeno.email,
        passwordHash: await hash(FIXTURES.ajeno.password),
        role: UserRole.developer,
        fullName: FIXTURES.ajeno.fullName,
        isActive: true,
      },
    ],
  });

  // Un proyecto con UN developer miembro y otro que no lo es: sin eso no se
  // puede testear la segunda capa de autorización (rol global + membresía).
  const proyecto = await prisma.project.create({
    data: {
      name: "Torre Test",
      slug: FIXTURES.proyecto.slug,
      status: ProjectStatus.in_progress,
      totalUnits: 10,
    },
  });
  const miembro = await prisma.user.findUniqueOrThrow({ where: { email: FIXTURES.activo.email } });
  await prisma.projectMember.create({
    data: { projectId: proyecto.id, userId: miembro.id, membershipRole: MembershipRole.developer },
  });

  await prisma.$disconnect();
}
