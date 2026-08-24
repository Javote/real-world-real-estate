import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import {
  type Personaje,
  sembrarMembresias,
  sembrarProyecto,
  sembrarUnidadVendida,
  sembrarUsuarios
} from "../src/db/fixtures";
import { applyPendingMigrations } from "../src/db/migrate";
import { SqliteTypeCoercionPlugin } from "../src/db/sqlite-type-plugin";
import type { Database } from "../src/db/types";
import { Kysely } from "../src/lib/kysely";
import { createClient } from "../src/lib/libsql-client";
import { LibsqlDialect } from "../src/lib/libsql-dialect";

// ── Una base POR ARCHIVO de test, no una compartida ────────────────────────
//
// Acá se siembra la **plantilla**, una sola vez. `test/setup-db.ts` la copia
// antes de cada archivo y le da su propia base (SPEC-015 §1).
//
// **Por qué dejó de ser una sola base compartida.** Con una, el estado se
// acumulaba entre archivos: las asserts exactas se volvían frágiles —un total
// dependía de si otro archivo ya había creado un contrato— y había que repartir
// valores a mano entre archivos para no chocar contra los índices únicos
// (`sequenceOrder` 71, 81…). Eso es coordinación manual que no escala y que
// nadie se acuerda de mantener. Además obligaba a `fileParallelism: false`.
//
// El migrador propio (D-049) resuelve rutas relativas al cwd del proceso (acá,
// apps/api), así que `file:./.data/...` cae dentro de apps/api.
export const TEST_DB_DIR = ".data";
export const TEMPLATE_DB = path.join(TEST_DB_DIR, "test.template.db");

const DATABASE_URL = `file:./${TEMPLATE_DB}`;
const DB_FILE = path.join(process.cwd(), TEMPLATE_DB);

/** Los sufijos que SQLite deja al lado del archivo principal. */
export const SQLITE_SIDECARS = ["", "-journal", "-wal", "-shm"] as const;

// ── El elenco ──────────────────────────────────────────────────────────────
//
// Los constructores son los MISMOS que usa el seed de desarrollo
// (`src/db/fixtures.ts`, SPEC-015 §2); el elenco no, y a propósito: este mundo
// es **adverso**. Tiene un usuario inactivo, un developer sin membresía y un
// proyecto sin miembros — casos que existen para probar rechazos y que en una
// demo solo confundirían.
//
// **Lo que sí comparte con el seed es la regla que faltaba:** todo rol de
// `USER_ROLES` tiene acá un representante ACTIVO. Su ausencia es la razón por
// la que un guard que contestaba 403 a toda la superficie del investor vivió
// sin que ningún test lo viera — no había con qué pedirla.

export const FIXTURES = {
  /** developer, activo y MIEMBRO del proyecto de prueba */
  activo: { email: "dev@test.local", password: "dev123", fullName: "Dev Test" },
  inactivo: { email: "inactivo@test.local", password: "inactivo123", fullName: "Inactivo Test" },
  revocable: {
    email: "revocable@test.local",
    password: "revocable123",
    fullName: "Revocable Test"
  },
  /** developer activo pero SIN membresía: la segunda capa de autorización */
  ajeno: { email: "ajeno@test.local", password: "ajeno123", fullName: "Ajeno Test" },
  /** admin que ningún test muta — `revocable` se desactiva en auth.test.ts */
  admin: { email: "admin@test.local", password: "admin123", fullName: "Admin Test" },
  /** buyer ACTIVO y dueño de la unidad de prueba: el investor del backlog */
  investor: { email: "investor@test.local", password: "investor123", fullName: "Investor Test" },
  /** notary activo. No tiene membresía por proyecto: no le hace falta (M2-D1 §4) */
  notario: { email: "notary@test.local", password: "notary123", fullName: "Notary Test" },
  /** verifier activo, MIEMBRO del proyecto de prueba: el certifier del backlog */
  certificador: {
    email: "certifier@test.local",
    password: "certifier123",
    fullName: "Certifier Test"
  },
  proyecto: { slug: "torre-test" },
  /** la unidad del investor, con su contrato */
  unidad: { unitReference: "3B", priceMinorUnits: 12_000_000, currency: "USD" },
  /** segundo proyecto, SIN miembros: sin él no se puede ver si el listado scopea */
  otroProyecto: { slug: "torre-ajena" }
};

/** El elenco con su rol y su estado, en la forma que comen los constructores. */
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
  // El directorio de bases de test se rehace entero en cada corrida: así no
  // sobrevive la base de un archivo que se renombró o se borró.
  const dir = path.join(process.cwd(), TEST_DB_DIR);
  if (existsSync(dir)) rmSync(dir, { recursive: true });
  mkdirSync(dir, { recursive: true });

  for (const sufijo of SQLITE_SIDECARS) {
    const f = `${DB_FILE}${sufijo}`;
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

  const ids = await sembrarUsuarios(db, ELENCO_TEST);
  const id = (email: string) => ids.get(email) as string;

  // Un proyecto con UN developer miembro y otro que no lo es: sin eso no se
  // puede testear la segunda capa de autorización (rol global + membresía).
  const projectId = await sembrarProyecto(db, {
    slug: FIXTURES.proyecto.slug,
    name: "Torre Test",
    status: "in_progress",
    totalUnits: 10
  });

  await sembrarMembresias(db, projectId, [
    { userId: id(FIXTURES.activo.email), membershipRole: "developer" },
    // DOS membresías sobre el MISMO proyecto: el schema lo permite (índice
    // único por userId+projectId+membershipRole) y el listado viejo lo
    // devolvía duplicado. Sin este fixture, esa regresión no se ve.
    { userId: id(FIXTURES.activo.email), membershipRole: "buyer" },
    { userId: id(FIXTURES.investor.email), membershipRole: "buyer" },
    { userId: id(FIXTURES.certificador.email), membershipRole: "verifier" }
  ]);

  // La unidad del investor y su contrato: sin ellos no hay dossier, ni capital,
  // ni directorio de investors que testear. El contrato existe porque la
  // invitación se aceptó — acá se planta el resultado.
  await sembrarUnidadVendida(db, {
    projectId,
    investorId: id(FIXTURES.investor.email),
    unitReference: FIXTURES.unidad.unitReference,
    floor: 3,
    sizeM2: 72,
    priceMinorUnits: FIXTURES.unidad.priceMinorUnits,
    currency: FIXTURES.unidad.currency
  });

  // Segundo proyecto, sin ningún miembro: es contra lo que se mide que el
  // listado scopee. Se crea después, así que es el más nuevo por createdAt.
  await sembrarProyecto(db, {
    slug: FIXTURES.otroProyecto.slug,
    name: "Torre Ajena",
    status: "planning",
    totalUnits: 4,
    offsetMs: 1
  });

  await db.destroy();
}
