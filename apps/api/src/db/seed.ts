import "dotenv/config";
import { DEFAULT_STAGE_CATALOG } from "@plataforma/shared";
import { compileDossier } from "../domain/dossier";
import { db } from "../lib/db";
import { paraMostrar, passwordDeDemo } from "./credentials";
import {
  type Personaje,
  sembrarMembresias,
  sembrarProyecto,
  sembrarStages,
  sembrarUnidadVendida,
  sembrarUsuarios
} from "./fixtures";

// El mundo DEMOSTRABLE: lo que alguien ve al abrir la app por primera vez.
//
// Comparte los constructores con los fixtures de la suite (`db/fixtures.ts`,
// SPEC-015 §2) pero **no el elenco**: acá no hay usuarios inactivos ni
// developers sin membresía. Esos casos existen para probar rechazos y en una
// demo solo confunden.
//
// Corre por upsert porque la base puede ya tener datos — incluida Turso en
// pre-prod, donde el free tier no da shell y este seed se corre desde la
// máquina de uno (D-040).

/**
 * Un representante ACTIVO por cada rol de `USER_ROLES`. La cobertura completa
 * la fija un test: si mañana nace un rol y nadie lo agrega acá, la demo tendría
 * un rol sin con qué entrar.
 *
 * `defaultLocal` viaja aparte de la password resuelta a propósito: es lo único
 * que se puede imprimir. Si la password vino de una variable de entorno,
 * `paraMostrar` dice de dónde salió en vez de escupirla en el log.
 */
const ELENCO_DEMO = [
  {
    email: "admin@example.com",
    fullName: "Admin Demo",
    role: "admin",
    variable: "SEED_ADMIN_PASSWORD",
    defaultLocal: "admin123"
  },
  // Los otros cuatro comparten variable: el que importa de verdad es el admin.
  {
    email: "developer@example.com",
    fullName: "Developer Demo",
    role: "developer",
    variable: "SEED_DEMO_PASSWORD",
    defaultLocal: "developer123"
  },
  {
    email: "buyer@example.com",
    fullName: "Buyer Demo",
    role: "buyer",
    variable: "SEED_DEMO_PASSWORD",
    defaultLocal: "buyer123"
  },
  {
    email: "verifier@example.com",
    fullName: "Verifier Demo",
    role: "verifier",
    variable: "SEED_DEMO_PASSWORD",
    defaultLocal: "verifier123"
  },
  {
    email: "notary@example.com",
    fullName: "Notary Demo",
    role: "notary",
    variable: "SEED_DEMO_PASSWORD",
    defaultLocal: "notary123"
  }
] as const satisfies readonly (Omit<Personaje, "password"> & {
  variable: string;
  defaultLocal: string;
})[];

async function main() {
  const personajes: Personaje[] = ELENCO_DEMO.map((p) => ({
    email: p.email,
    fullName: p.fullName,
    role: p.role,
    password: passwordDeDemo(p.variable, p.defaultLocal)
  }));

  const ids = await sembrarUsuarios(db, personajes);
  const id = (email: string) => ids.get(email) as string;

  const projectId = await sembrarProyecto(db, {
    slug: "torre-a",
    name: "Torre A",
    address: "Av. Santa Fe 3200",
    city: "Buenos Aires",
    country: "Argentina",
    totalUnits: 48,
    status: "in_progress"
  });

  await sembrarMembresias(db, projectId, [
    { userId: id("developer@example.com"), membershipRole: "developer" },
    { userId: id("buyer@example.com"), membershipRole: "buyer" },
    { userId: id("verifier@example.com"), membershipRole: "verifier" }
  ]);

  // M3 §1 — placeholder de "≥8 stages" (D-021, DEFAULT_STAGE_CATALOG): las
  // dos primeras siguen en el estado que ya mostraba la demo (una completa,
  // una en curso); el resto nace `Pending`, sin tocar.
  await sembrarStages(
    db,
    projectId,
    DEFAULT_STAGE_CATALOG.map((etapa, i) => ({
      name: etapa.name,
      sequenceOrder: etapa.sequenceOrder,
      progressPercentage: etapa.progressPercentage,
      state: i === 0 ? "Completed" : i === 1 ? "InProgress" : "Pending"
    }))
  );

  // Una unidad vendida con su contrato: sin ella los paneles de capital, el
  // dossier y el directorio de investors arrancan vacíos y la demo no muestra
  // nada de la mitad del backlog.
  const { unitId } = await sembrarUnidadVendida(db, {
    projectId,
    investorId: id("buyer@example.com"),
    unitReference: "4B",
    floor: 4,
    sizeM2: 68,
    priceMinorUnits: 9_500_000,
    currency: "USD"
  });

  // **El dossier se COMPILA, no se inserta.** Es on-demand desde el estado
  // autoritativo (M2-D5 §3) y su hash sale de los artefactos que existen: una
  // fila insertada a mano tendría un `masterHash` que no corresponde a nada.
  // Sin esto, la cola de revisión del notario arranca vacía y su superficie no
  // se puede demostrar.
  await compileDossier(unitId);

  console.log("Seed completado");
  for (const p of ELENCO_DEMO) {
    console.log(`${p.role}: ${p.email} / ${paraMostrar(p.variable, p.defaultLocal)}`);
  }
  console.log("Project slug: torre-a");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    db.destroy();
  });
