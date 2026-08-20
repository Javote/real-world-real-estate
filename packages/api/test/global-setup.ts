import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcrypt";
import { PrismaClient, UserRole } from "@prisma/client";

// Prisma resuelve las rutas SQLite relativas al archivo de schema, así que
// `file:./test.db` cae en prisma/test.db — misma convención que dev.db.
const DATABASE_URL = "file:./test.db";
const DB_FILE = path.join(process.cwd(), "prisma", "test.db");

export const FIXTURES = {
  activo: { email: "dev@test.local", password: "dev123", fullName: "Dev Test" },
  inactivo: { email: "inactivo@test.local", password: "inactivo123", fullName: "Inactivo Test" },
  revocable: { email: "revocable@test.local", password: "revocable123", fullName: "Revocable Test" },
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
    ],
  });

  await prisma.$disconnect();
}
