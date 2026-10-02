# SPEC-617 — A5 + W5: una sola forma

> Fase 2, pasos A5 y W5 ([`SPEC-611`](SPEC-611-la-migracion-fase-2.md)); el estado, en
> [`specs/README.md`](README.md). Nivel 🟡: borra el camino viejo de autorización. **Depende de que
> A4 y W4 estén cerrados**: se borra lo que ya nadie usa.

## Alcance

**API (A5)**

1. Se borran `MONTAJE`, `GUARD`, `authorize` de Express, `delegarAOrpc` y `route-inventory`.
   `route-guards.test.ts` lee la matriz solo del árbol oRPC, más la excepción con nombre de la subida
   multipart (D-102). **La `MATRIZ` no cambia ni un carácter.**
2. `generate-openapi.ts` genera desde el contrato, sin introspección de Express ni las tablas
   `REQUEST_SCHEMAS`/`RESPONSE_SCHEMAS`/`PARAM_SCHEMAS`. El OpenAPI sale igual
   (`openapi-freshness`).
3. **Las cuatro reglas de la auditoría §2.2, como reglas de Biome** (`noRestrictedImports`), para
   que la forma no vuelva por descuido:
   - un `router.ts` no importa `db`;
   - un caso de uso no importa Express ni oRPC;
   - las queries reciben un ejecutor, no el `db` global;
   - un error de dominio es un `Result` con un `ErrorCode` de `shared`.
   Cada regla se prueba en rojo con una mutación antes de commitearla.
4. Se borran `writeAuditLog`/`insertAuditLog` y el `notify` viejo si quedó alguno sin migrar.
5. **La documentación, en el mismo commit**: el checklist de un endpoint nuevo y las trampas de
   Express y oRPC de `apps/api/CLAUDE.md` se reescriben para la forma nueva.

**Web (W5)**

1. Se borran las llaves escritas a mano que hayan sobrevivido y `unicosPorStageId` (hoy en 4
   archivos: deduplica un join que `SPEC-213` ya arregló en la API). `useRoleGuard` ya no existe
   desde W1.
2. **Toda ruta con datos tiene su `errorComponent`**: lo que se haya escapado de W3/W4 se cierra
   acá, y un test lo fija recorriendo el árbol de rutas.
3. `apps/web/CLAUDE.md` se reescribe para la forma nueva.

## Verificación

`pnpm verify:all`, `pnpm e2e` completo, y en producción la pasada de la demo de punta a punta con los
cuatro roles.
