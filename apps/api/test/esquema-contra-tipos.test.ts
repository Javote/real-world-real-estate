import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "../src/lib/db.js";
import { sql } from "../src/lib/kysely.js";

// `db/types.ts` está escrito a mano: este test lo compara con la base que arman las migraciones reales
// (`global-setup.ts`), tabla por tabla. Una columna de más o de menos, una que cambió de nulabilidad o
// de afinidad, y se pone rojo (SPEC-613).

type Columna = { nulable: boolean; entera: boolean };

const ENTEROS = new Set([
  "number",
  "SqliteBoolean",
  "SqliteTimestamp",
  "SqliteTimestampSinCoercion"
]);

function columnasDeTypes(fuente: string): Map<string, Map<string, Columna>> {
  const archivo = ts.createSourceFile("types.ts", fuente, ts.ScriptTarget.Latest, true);
  const interfaces = new Map<string, ts.InterfaceDeclaration>();
  archivo.forEachChild((n) => {
    if (ts.isInterfaceDeclaration(n)) interfaces.set(n.name.text, n);
  });

  const propiedades = (i: ts.InterfaceDeclaration) =>
    i.members.filter(ts.isPropertySignature).map((m) => ({
      nombre: m.name.getText(archivo),
      tipo: m.type?.getText(archivo) ?? ""
    }));

  const tablas = new Map<string, Map<string, Columna>>();
  const database = interfaces.get("Database");
  if (!database) throw new Error("types.ts no declara `interface Database`");

  for (const { nombre: tabla, tipo } of propiedades(database)) {
    const interfaz = interfaces.get(tipo);
    if (!interfaz) throw new Error(`La tabla ${tabla} apunta a ${tipo}, que no es una interfaz`);
    tablas.set(
      tabla,
      new Map(
        propiedades(interfaz).map(({ nombre, tipo: t }) => {
          const partes = t.split("|").map((p) => p.trim());
          return [
            nombre,
            {
              nulable: partes.includes("null"),
              entera: partes.some((p) => ENTEROS.has(p.replace(/<.*$/, "")))
            }
          ];
        })
      )
    );
  }
  return tablas;
}

async function columnasDeLaBase(): Promise<Map<string, Map<string, Columna>>> {
  const { rows } = await sql<{ name: string }>`
    select name from sqlite_master
    where type = 'table' and name not like 'sqlite_%' and name not like '\\_%' escape '\\'
  `.execute(db);

  const tablas = new Map<string, Map<string, Columna>>();
  for (const { name } of rows) {
    const columnas = await sql<{ name: string; type: string; notnull: number; pk: number }>`
      select name, type, "notnull", pk from pragma_table_info(${name})
    `.execute(db);
    tablas.set(
      name,
      new Map(
        columnas.rows.map((c) => [
          c.name,
          {
            nulable: c.notnull === 0 && c.pk === 0,
            entera: /INT|REAL|NUM/i.test(c.type)
          }
        ])
      )
    );
  }
  return tablas;
}

const FUENTE = readFileSync(join(import.meta.dirname, "..", "src", "db", "types.ts"), "utf8");

afterAll(async () => {
  await db.destroy();
});

describe("el esquema real contra db/types.ts", () => {
  it("las mismas tablas", async () => {
    const base = await columnasDeLaBase();
    expect([...columnasDeTypes(FUENTE).keys()].sort()).toEqual([...base.keys()].sort());
  });

  it("las mismas columnas en cada tabla, con la misma nulabilidad y afinidad", async () => {
    const base = await columnasDeLaBase();
    const tipos = columnasDeTypes(FUENTE);
    const diferencias: string[] = [];

    for (const [tabla, columnas] of base) {
      const declaradas = tipos.get(tabla) ?? new Map<string, Columna>();
      for (const nombre of new Set([...columnas.keys(), ...declaradas.keys()])) {
        const real = columnas.get(nombre);
        const tipo = declaradas.get(nombre);
        if (!real) diferencias.push(`${tabla}.${nombre}: en types.ts, no en la base`);
        else if (!tipo) diferencias.push(`${tabla}.${nombre}: en la base, no en types.ts`);
        else if (real.nulable !== tipo.nulable)
          diferencias.push(
            `${tabla}.${nombre}: nulable ${real.nulable} en la base, ${tipo.nulable} en types.ts`
          );
        else if (real.entera !== tipo.entera)
          diferencias.push(
            `${tabla}.${nombre}: entera ${real.entera} en la base, ${tipo.entera} en types.ts`
          );
      }
    }

    expect(diferencias).toEqual([]);
  });

  it("una columna de más en types.ts se ve", () => {
    const mutada = FUENTE.replace(
      /export interface UserTable \{\n/,
      "export interface UserTable {\n  inventada: string;\n"
    );
    expect(columnasDeTypes(mutada).get("User")?.has("inventada")).toBe(true);
    expect(columnasDeTypes(FUENTE).get("User")?.has("inventada")).toBe(false);
  });
});
