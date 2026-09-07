# Security review — 2026-09-07

> Evidencia del criterio 4 del Milestone 3 de Catalyst ("No open P1 security findings after
> remediation"). Compila hallazgos ya cerrados en código y documentados en `CLAUDE.md` /
> `apps/api/CLAUDE.md`, más un escaneo de dependencias corrido el mismo día. No reemplaza esos
> documentos — los cita, con fecha, archivo y test que prueba el cierre.

## Alcance

- `apps/api` — 87 rutas montadas en 18 archivos de router.
- `packages/cardano` — adaptadores `simulated` y real del `AnchorPort`.
- `packages/shared` — contrato Zod.
- `contracts/` — validadores Aiken (Plutus V3).
- Dependencias de todo el workspace (`pnpm audit`).

**No alcance:** pentesting de infraestructura (Render, Turso, Blockfrost) más allá de lo que el
código controla; ingeniería social; el cliente Cardano (Lucid Evolution) como librería en sí.

## Metodología

1. **Matriz de permisos declarada** — `apps/api/test/route-guards.test.ts` reconstruye, leyendo los
   routers ya montados por Express, la cadena de guards de las 87 rutas y la compara contra un
   literal. Se verificó rompiéndola (tres mutaciones deliberadas, las tres en rojo, revertidas), no
   solo viéndola verde.
2. **Auditoría manual del tercer patrón** — rutas que autorizan adentro del handler en vez de en la
   firma (`requireOwnership`, D-088). Se verificó neutralizando el guard: 7 de 13 tests de rechazo
   en `test/require-ownership.test.ts` se ponen rojos.
3. **Escaneo de dependencias** — `pnpm audit` corrido el 2026-09-07 contra las 750 dependencias del
   workspace, con cada hallazgo trazado a su cadena real (`paths`) para distinguir dependencia de
   runtime de dependencia de instalación o de build/test.
4. **Timing de canales laterales** — medido, no estimado, con `test/auth-timing.test.ts` (9 corridas
   intercaladas, comparación por orden de magnitud).

## Hallazgos

| # | Hallazgo | Severidad | Estado | Cerrado | Evidencia |
|---|---|---|---|---|---|
| 1 | `JWT_SECRET` caía a un literal público (`"dev-secret"`) si la env venía ausente o vacía — cualquiera forgeaba un token de admin | **P1** | Cerrado | 2026-08-20 | `requireJwtSecret()` lanza al importar si no hay secreto; `test/jwt.test.ts` |
| 2 | `GET /evidence/:bundleId/proof/:fileHash` y `/:bundleId/files` sin segunda capa — cualquier usuario autenticado leía el Merkle root y los nombres de archivo de un bundle ajeno conociendo su id | **P1** | Cerrado | 2026-09-03 | `requireProjectAccess({via:"EvidenceBundle"})`; `test/evidence-anchor.test.ts` → "un developer sin membresía... recibe 403" |
| 3 | `GET /developer/audit-log` devolvía el `AuditLog` **entero** sin acotar por proyecto, con `actorName`/`actorRole` de todos los usuarios | **P1** | Cerrado | 2026-09-04 | `auditScope`, fail-closed; ver `apps/api/CLAUDE.md` §La matriz de permisos |
| 4 | Oráculo de timing en `/auth/login`: un email inexistente respondía ~81ms más rápido que uno válido (revela existencia de cuenta) | P2 | Cerrado | 2026-08-20 | comparación siempre contra `HASH_DUMMY`; medido en `test/auth-timing.test.ts` (diferencia de ~81ms a ~0.7ms) |
| 5 | 9 rutas del investor autorizaban pertenencia (`unitId`/`investorId`) con un `if` copiado dentro del handler, sin forma en la firma ni protección del compilador | P2 | Cerrado | 2026-09-04 | `requireOwnership` (D-088); `test/require-ownership.test.ts` |
| 6 | `POST/PATCH /users` usaba un `z.enum` local sin `notary`, incumpliendo regla 6 — un admin no podía dar de alta ni promover un notary por API | P3 | Cerrado | 2026-09-03 | `userRoleSchema` de `@plataforma/shared`; `test/users-roles.test.ts` |
| 7 | `signToken`/`verifyToken` no fijaban `algorithm`/`algorithms` explícito — dependían del default de `jsonwebtoken` para acotar a HS*. Sin agujero real (el default ya lo hacía con un secreto string), pero una dependencia implícita | P3 | Cerrado | 2026-09-04 | HS256 explícito de los dos lados; `test/jwt.test.ts` → "el algoritmo de firma está fijado" |
| 8 | `qs@6.15.3` (dependencia real de `express`/`body-parser`, en el camino de cada request) vulnerable a DoS por bypass de array-limit e `isBuffer` | P3 (moderate, CVSS 5.3) | Cerrado | 2026-09-07 | override a `qs@6.16.0` en `package.json`; `pnpm audit` bajó de 10 a 8 moderados |
| 9 | `tar@6.2.1` con 1 crítico + 7 altos — pero la cadena completa es `bcrypt → @mapbox/node-pre-gyp → tar`: node-pre-gyp solo corre en `postinstall`, para descomprimir el binario prebuilt de bcrypt. No procesa ningún input de un request | Crítico/Alto, **no explotable en runtime** | Abierto, sin plan de cierre inmediato | — | forzar `tar@7.x` es un salto de major sobre una herramienta que el build de un módulo nativo (🔴, D-046) usa en `postinstall`; el riesgo de romper el build supera el riesgo de un vector que no es alcanzable por un cliente. Se revisita si `bcrypt`/`node-pre-gyp` publican una versión que ya lo resuelva |
| 10 | `brace-expansion`, `browserslist`, `nanoid`, `undici`, `postcss` — 6 altos + 6 moderados, todos en la cadena de `vite`/`vitest`/`jsdom`/`@babel` (build y test) o del propio `node-pre-gyp` (`rimraf→glob→minimatch`) | Alto/Moderate, **no explotable en runtime** | Abierto, sin plan de cierre inmediato | — | ninguno de estos paquetes se sirve en el bundle de producción ni corre en el proceso de la API desplegada; se resuelven solos con el próximo bump de las herramientas de build, no ameritan un override manual hoy |
| 11 | Revocación de un JWT individual no existe (dura 7 días, solo se corta dando de baja la cuenta entera) | — (decisión de producto, no hallazgo) | Abierto a propósito | — | ver `CLAUDE.md` raíz — "es infraestructura para un problema que todavía no duele"; mitigado porque `authenticate()` reconsulta `isActive` en cada request |

## Conclusión

**Cero hallazgos P1 abiertos.** Los tres P1 encontrados (JWT_SECRET, segunda capa de autorización
en evidencia, audit-log sin acotar) están cerrados en código, con test que reproduce el bug original
y prueba el cierre. Los hallazgos de dependencias con severidad crítica/alta (`tar` y su cadena)
están confinados a rutas de instalación y build que un cliente de la API desplegada no alcanza — se
dejan documentados y abiertos como deuda de higiene, no como riesgo de producción. El único hallazgo
de dependencia con exposición real de runtime (`qs`, moderate) se cerró el mismo día.

## Reproducir este review

```bash
pnpm --filter @plataforma/api test route-guards.test.ts require-ownership.test.ts \
  auth-timing.test.ts jwt.test.ts users-roles.test.ts evidence-anchor.test.ts
pnpm audit
```
