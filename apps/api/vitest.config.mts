import path from "node:path";
import { defineConfig } from "vitest/config";

// La suite corre contra bases SQLite PROPIAS, no contra dev.db: un test no
// puede depender del seed de desarrollo ni ensuciarlo.
//
// **Una base por ARCHIVO de test** (SPEC-015 §1): `global-setup.ts` siembra una
// plantilla una sola vez y `setup-db.ts` la copia antes de cada archivo. Así
// ningún archivo ve el estado que dejó otro, y por eso vuelve a poder correr en
// paralelo.
export default defineConfig({
  // Los tests resuelven @plataforma/shared al FUENTE, no al dist. Dos razones:
  // no hay que compilar antes de testear, y es imposible testear contra un dist
  // viejo. El dist existe solo para el runtime de la API, que es CommonJS y lo
  // carga con require() (ver packages/shared/tsconfig.json).
  //
  // La ruta se ancla a ESTE archivo, no al `process.cwd()`. Con el cwd, mover el
  // package rompía la resolución en silencio: al pasar de `packages/api` a
  // `apps/api` (D-055), `../shared` dejó de existir y las 9 suites fallaron con
  // "Cannot find package". Un path relativo al cwd es una dependencia oculta de
  // desde dónde se invoca el comando.
  resolve: {
    alias: {
      "@plataforma/shared": path.resolve(import.meta.dirname, "../../packages/shared/src/index.ts"),
      "@plataforma/cardano": path.resolve(
        import.meta.dirname,
        "../../packages/cardano/src/index.ts"
      )
    }
  },
  test: {
    include: ["test/**/*.test.ts"],
    // El segundo solo actúa con `S3_TEST=1`: levanta MinIO y lo baja al
    // terminar. En `pnpm test` entra, ve la variable vacía y sale.
    globalSetup: ["./test/global-setup.ts", "./test/global-setup-minio.mts"],
    // Corre una vez POR ARCHIVO y antes de sus imports, que es lo que hace
    // falta: `src/lib/db.ts` lee DATABASE_URL al importarse.
    setupFiles: ["./test/setup-db.ts"],
    env: {
      // Piso: `setup-db.ts` lo pisa con la base propia de cada archivo. Queda
      // apuntando a la plantilla para que nada corra sin base si ese setup no
      // llegara a ejecutarse.
      DATABASE_URL: "file:./.data/test.template.db",
      JWT_SECRET: "test-secret-jamas-en-produccion",
      NODE_ENV: "test",
      // Piso: `setup-db.ts` lo pisa con un subdirectorio propio por archivo,
      // porque hay tests que cuentan archivos en disco para detectar huérfanos.
      UPLOAD_DIR: "./test-uploads",
      // Alto a propósito: las suites comparten proceso y IP, así que el límite
      // real de /login (20) las haría chocar entre archivos. El comportamiento
      // del limiter se prueba aparte, con su propio max — ver rate-limit.test.ts.
      LOGIN_RATE_LIMIT_MAX: "100000"
    },
    // **En paralelo otra vez.** Estuvo en `false` mientras los archivos
    // compartían una sola base sembrada y se pisaban entre sí; con una base por
    // archivo (SPEC-015 §1) esa razón desapareció.
    fileParallelism: true,

    // Coverage — SPEC-015 §3 y SPEC-017 §paso 4.
    //
    // **Los umbrales arrancan en el piso MEDIDO, no en el 95% que pide la
    // aceptación de M3.** Poner el número final antes de tenerlo deja el CI
    // rojo por deuda conocida, y un CI que está rojo por default enseña a
    // ignorar el rojo. Es un trinquete: suben con cada rebanada, no bajan.
    //
    // El 95% de M3 se mide contra los **test IDs** del backlog, no contra
    // líneas (M2-D5 §8) — eso lo cuenta `scripts/check-testids.mjs`. Esto de
    // acá es la otra mitad: que el código que existe esté ejercitado.
    //
    // SPEC-017 §paso 4, tandas 1-2 (2026-09-22): `certifier.routes.ts`,
    // `investor.routes.ts` y `lib/storage.ts` llegaron a 100% de líneas;
    // `developer-comercial.routes.ts` a 94,82% (quedan dos ramas documentadas
    // como de bajo valor — el desempate de `contractsOfProjectProcedure`
    // cuando el mismo investor compró la misma unidad dos veces, y un
    // `catch` puramente defensivo).
    //
    // Tanda 3 cerrada (2026-09-22): `db/migrate.ts` y `db/fixtures.ts`
    // (commit `8bcfacb`) y `db/seed.ts`/`instrumentation.ts` (esta sesión) —
    // los cuatro scripts de arranque tenían su lógica real detrás de un
    // `require.main === module`/nivel de módulo, sin ninguna función
    // invocable desde un test. **El paso 4 (API) queda cerrado: 96,26% de
    // líneas, sobre el 95% que pide la aceptación de M3.** Statements
    // (89,94%) y branches (77,66%) quedan por debajo — la spec mide líneas,
    // no las cuatro métricas, así que no bloquean el cierre; el umbral de acá
    // sí las sube igual, al piso medido, para que no bajen sin querer.
    //
    // Subida de branches, fuera de la spec (2026-09-22): `contracts.routes.ts`,
    // `users.routes.ts` — tests nuevos para la rama disyuntiva de
    // `GET /contracts/:contractId/releases` (dueño vs. miembro del proyecto,
    // más el 403 y el 404), y para `GET /users/:id` 404 y
    // `PATCH /users/:id` (fullName, isActive, password). El 404 que el
    // handler de `contracts.routes.ts` declara (`if (!contrato)`) quedó sin
    // ejercitar a propósito: `evaluarDueño`/`evaluarProyecto` (auth.ts) ya
    // resuelven la existencia del contrato en el middleware — las dos ramas
    // de `authorize({ alguna: [...] })` cargan la fila antes de que el
    // handler la vuelva a buscar, así que ese `if` (y el `if (!matched)` de
    // todo router montado sobre oRPC) es defensivo, no alcanzable por HTTP.
    //
    // Segunda tanda de branches (2026-09-22): `notary.routes.ts` — el
    // filtro disyuntivo de `kpis` ("un admin ve el total; un notario, lo que
    // firmó él más la cola común"), los 404 de firmar/rechazar un dossier
    // inexistente, `signatures` con la rama de admin y la paginación por
    // cursor (`nextCursor` no nulo y su siguiente página), el caso sin
    // firmas (`nextCursor: null`), y la cola de revisión mostrando el nombre
    // del investor. Quedaron sin ejercitar, y documentados como no
    // alcanzables con el esquema actual: el `??`/`?.` de `investorName` y
    // `completeness` en `pendingDossiersProcedure` (un `Dossier` solo se
    // compila desde `GET /investor/units/:id/dossier`, que exige que la
    // unidad ya tenga `investorId` — el investor siempre existe), el
    // `if (!dossier)` post-`compileDossier` en `dossierByIdProcedure` y
    // `signDossierProcedure` (la FK `Dossier.unitId → Unit.id` es
    // `ON DELETE CASCADE`, así que un `Dossier` no puede sobrevivir a su
    // unidad — verificado insertando un huérfano a mano: rechaza con
    // `SQLITE_CONSTRAINT_FOREIGNKEY`), y `signedAt ? ... : null` en
    // `signaturesProcedure` (la query ya filtra `status = "signed"`, y firmar
    // siempre escribe `signedAt` en el mismo `update`). El mismo
    // `if (!dossier)` de `public.routes.ts` (línea 56) es la misma garantía:
    // se probó a propósito insertando un `Dossier` con un `unitId`
    // inexistente y la base lo rechazó.
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        // Bootstrap del proceso: no tiene lógica que testear, y arrancarlo en
        // un test levantaría un puerto.
        "src/server.ts",
        // Solo tipos: no emite runtime, así que contarlo distorsiona.
        "src/db/types.ts"
      ],
      thresholds: {
        statements: 91,
        branches: 80,
        functions: 96,
        lines: 97
      }
    }
  }
});
