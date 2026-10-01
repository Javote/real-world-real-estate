# SPEC-207 — El audit log se escribe con strings sueltos y se filtra con un mapeo cerrado

> **Origen:** [`AUDITORIA-2026-09-11-calidad-del-backend.md`](AUDITORIA-2026-09-11-calidad-del-backend.md) §B-09.
> Nivel 🟢. **Independiente.** No toca ningún criterio del SOM (el 10 ya está cerrado y esta spec no
> cambia lo que el ledger guarda).

## El problema, en una frase

`writeAuditLog` (`utils/audit.ts:4`) toma `action: string` y `entityType: string`. Del otro lado,
`auditScope` es **fail-closed** y conoce ocho `entityType`: **uno que no esté en la lista no se
muestra nunca**. Y las **29** `action` tienen que estar espejadas a mano en
`apps/web/src/i18n/dictionary.ts` o la UI muestra el literal — **que es el bug que cerró la Tanda 2.4
del plan de entrega**.

Hoy las tres listas coinciden. La auditoría las verificó una por una:

- 9 `entityType` escritos; los 8 que `auditScope` mapea, más `User`, que está afuera **por diseño** y
  documentado.
- Las 29 `action` están todas en el diccionario del front, incluidas las dos que se pasan por
  `auditAction` y no aparecen en un `grep 'action: "'` ingenuo (`STAGE_WORK_INITIATED`,
  `CHANGE_STAGE_STATE`).
- El diccionario tiene además **dos claves muertas**: `CREATE_EVIDENCE` y `CREATE_STAGE`, de las
  rutas borradas el 2026-09-08.

**Coinciden porque alguien se acordó, no porque algo lo obligue.** Un `entityType` con un typo no
falla: desaparece del audit log del developer, en silencio, que es el modo de falla que `auditScope`
eligió a propósito para lo desconocido.

## Qué se cambia

1. **`AUDIT_ACTIONS` y `AUDIT_ENTITY_TYPES` como uniones en `packages/shared`** (regla 6: el contrato
   vive ahí primero).
2. **`writeAuditLog` tipado contra ellas**: `action: AuditAction`, `entityType: AuditEntityType`.
3. **`auditScope` con `satisfies Record<AuditEntityType, …>`** para las que llevan scope, y `User`
   excluida explícitamente, no por omisión.
4. **Las dos claves muertas del diccionario se borran.**

**La casa ya tiene la técnica**: `middlewares/auth.ts` la usa dos veces —`ALL_MEMBERSHIPS` y
`TODOS_LOS_ROLES`— con el argumento escrito al lado:

> *"Ampliar un permiso tiene que ser un acto deliberado; el trabajo de escribir un renglón es
> exactamente el punto."*

## Y lo que esto habilita del otro lado

Con la unión escrita, **el diccionario del front puede tipar sus claves contra ella** — que es lo que
volvería *imposible* el drift en vez de prohibido, el mismo argumento que justifica `packages/shared`
entero. Eso es [`SPEC-107`](SPEC-107-claves-de-traduccion-tipadas.md), y **ninguna de las dos bloquea
a la otra**: esta crea la unión, aquella la consume.

## Invariantes

1. **Ninguna `action` ni `entityType` se escribe como string libre.** Una acción nueva es un renglón
   deliberado en `packages/shared`.
2. **`auditScope` cubre todos los `AuditEntityType`**, y las exclusiones son explícitas: agregar un
   tipo sin decidir su scope **no compila**.
3. **El contenido del ledger no cambia.** Las filas ya escritas se siguen leyendo igual; esto es
   tipado, no migración.
4. El diccionario del front no tiene claves muertas ni faltantes contra la unión.

## Casos borde (definen los tests)

| Caso | Esperado |
|---|---|
| Se agrega una `action` a la unión y no al diccionario | rojo (por [`SPEC-107`](SPEC-107-claves-de-traduccion-tipadas.md); mientras tanto, el chequeo de paridad que exista) |
| Se agrega un `entityType` y no se decide su scope | **no compila** |
| Una fila vieja con un `entityType` que ya no está en la unión | se sigue leyendo; la unión gobierna la escritura, no la lectura histórica |
| `User` en el audit log | sigue fuera del scope del developer, ahora por exclusión escrita |
