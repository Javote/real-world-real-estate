import { DEFAULT_STAGE_CATALOG } from "@plataforma/shared";
import { compileDossier } from "../domain/dossier.js";
import { db } from "../lib/db.js";
import {
  type Personaje,
  sembrarMembresias,
  sembrarOrganizacion,
  sembrarProyecto,
  sembrarStages,
  sembrarUnidadVendida,
  sembrarUsuarios
} from "./fixtures.js";

// El mundo demo, sin passwords: las pone cada seed. `db:seed` (local) usa las del repo y
// `db:seed:produccion` exige las del entorno.
export const ELENCO_DEMO = [
  {
    email: "admin@example.com",
    fullName: "Admin Demo",
    role: "admin",
    variable: "SEED_ADMIN_PASSWORD",
    passwordLocal: "admin123"
  },
  {
    email: "developer@example.com",
    fullName: "Developer Demo",
    role: "developer",
    variable: "SEED_DEMO_PASSWORD",
    passwordLocal: "developer123"
  },
  {
    email: "buyer@example.com",
    fullName: "Buyer Demo",
    role: "buyer",
    variable: "SEED_DEMO_PASSWORD",
    passwordLocal: "buyer123"
  },
  {
    email: "verifier@example.com",
    fullName: "Verifier Demo",
    role: "verifier",
    variable: "SEED_DEMO_PASSWORD",
    passwordLocal: "verifier123"
  },
  {
    email: "notary@example.com",
    fullName: "Notary Demo",
    role: "notary",
    variable: "SEED_DEMO_PASSWORD",
    passwordLocal: "notary123"
  }
] as const satisfies readonly (Omit<Personaje, "password"> & {
  variable: "SEED_ADMIN_PASSWORD" | "SEED_DEMO_PASSWORD";
  passwordLocal: string;
})[];

export type MiembroDelElenco = (typeof ELENCO_DEMO)[number];

export async function sembrarMundoDemo(personajes: Personaje[]): Promise<void> {
  const ids = await sembrarUsuarios(db, personajes);
  const id = (email: string) => ids.get(email) as string;

  const organizationId = await sembrarOrganizacion(db, {
    slug: "grupo-alpine",
    name: "Grupo Alpine",
    bio: "Grupo Alpine desarrolla vivienda en pozo en Buenos Aires, con obra propia y entrega documentada etapa por etapa.",
    foundedYear: 2005
  });

  const projectId = await sembrarProyecto(db, {
    organizationId,
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

  await sembrarStages(
    db,
    projectId,
    DEFAULT_STAGE_CATALOG.map((etapa, i) => ({
      name: etapa.name,
      sequenceOrder: etapa.sequenceOrder,
      state: i === 0 ? "InProgress" : "Pending"
    }))
  );

  const { unitId } = await sembrarUnidadVendida(db, {
    projectId,
    investorId: id("buyer@example.com"),
    unitReference: "4B",
    floor: 4,
    sizeM2: 68,
    priceMinorUnits: 9_500_000,
    currency: "USD"
  });

  await compileDossier(unitId);
}
