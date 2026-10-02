import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import {
  type Personaje,
  sembrarMembresias,
  sembrarProyecto,
  sembrarUnidadVendida,
  sembrarUsuarios
} from "../src/db/fixtures.js";
import { applyPendingMigrations } from "../src/db/migrate.js";
import { SqliteTypeCoercionPlugin } from "../src/db/sqlite-type-plugin.js";
import type { Database } from "../src/db/types.js";
import { Kysely } from "../src/lib/kysely.js";
import { createClient } from "../src/lib/libsql-client.js";
import { LibsqlDialect } from "../src/lib/libsql-dialect.js";

export const TEST_DB_DIR = path.join(".data", "test");
export const TEMPLATE_DB = path.join(TEST_DB_DIR, "test.template.db");

const DATABASE_URL = `file:./${TEMPLATE_DB}`;
const DB_FILE = path.join(process.cwd(), TEMPLATE_DB);

export const SQLITE_SIDECARS = ["", "-journal", "-wal", "-shm"] as const;

export const FIXTURES = {
  activo: { email: "dev@test.local", password: "dev123", fullName: "Dev Test" },
  inactivo: { email: "inactivo@test.local", password: "inactivo123", fullName: "Inactivo Test" },
  revocable: {
    email: "revocable@test.local",
    password: "revocable123",
    fullName: "Revocable Test"
  },
  ajeno: { email: "ajeno@test.local", password: "ajeno123", fullName: "Ajeno Test" },
  admin: { email: "admin@test.local", password: "admin123", fullName: "Admin Test" },
  investor: { email: "investor@test.local", password: "investor123", fullName: "Investor Test" },
  notario: { email: "notary@test.local", password: "notary123", fullName: "Notary Test" },
  certificador: {
    email: "certifier@test.local",
    password: "certifier123",
    fullName: "Certifier Test"
  },
  proyecto: { slug: "torre-test" },
  unidad: { unitReference: "3B", priceMinorUnits: 12_000_000, currency: "USD" },
  otroProyecto: { slug: "torre-ajena" }
};

export const ELENCO_TEST: Personaje[] = [
  { ...FIXTURES.activo, role: "developer" },
  { ...FIXTURES.inactivo, role: "buyer", isActive: false },
  { ...FIXTURES.revocable, role: "admin" },
  { ...FIXTURES.ajeno, role: "developer" },
  { ...FIXTURES.admin, role: "admin" },
  { ...FIXTURES.investor, role: "buyer" },
  { ...FIXTURES.notario, role: "notary" },
  { ...FIXTURES.certificador, role: "verifier" }
];

export default async function setup() {
  const dir = path.join(process.cwd(), TEST_DB_DIR);
  if (existsSync(dir)) rmSync(dir, { recursive: true });
  mkdirSync(dir, { recursive: true });

  for (const sufijo of SQLITE_SIDECARS) {
    const f = `${DB_FILE}${sufijo}`;
    if (existsSync(f)) rmSync(f);
  }

  const migrationClient = createClient({ url: DATABASE_URL });
  await applyPendingMigrations(migrationClient);
  migrationClient.close();

  const db = new Kysely<Database>({
    dialect: new LibsqlDialect({ url: DATABASE_URL }),
    plugins: [new SqliteTypeCoercionPlugin()]
  });

  const ids = await sembrarUsuarios(db, ELENCO_TEST);
  const id = (email: string) => ids.get(email) as string;

  const projectId = await sembrarProyecto(db, {
    slug: FIXTURES.proyecto.slug,
    name: "Torre Test",
    status: "in_progress",
    totalUnits: 10
  });

  await sembrarMembresias(db, projectId, [
    { userId: id(FIXTURES.activo.email), membershipRole: "developer" },
    { userId: id(FIXTURES.activo.email), membershipRole: "buyer" },
    { userId: id(FIXTURES.investor.email), membershipRole: "buyer" },
    { userId: id(FIXTURES.certificador.email), membershipRole: "verifier" }
  ]);

  await sembrarUnidadVendida(db, {
    projectId,
    investorId: id(FIXTURES.investor.email),
    unitReference: FIXTURES.unidad.unitReference,
    floor: 3,
    sizeM2: 72,
    priceMinorUnits: FIXTURES.unidad.priceMinorUnits,
    currency: FIXTURES.unidad.currency
  });

  await sembrarProyecto(db, {
    slug: FIXTURES.otroProyecto.slug,
    name: "Torre Ajena",
    status: "planning",
    totalUnits: 4,
    offsetMs: 1
  });

  await db.destroy();
}
