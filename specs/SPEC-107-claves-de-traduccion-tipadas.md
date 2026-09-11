# SPEC-107 — Los 23 `as never` que apagan el chequeo del diccionario

> **Origen:** [`AUDITORIA-2026-09-11-calidad-del-frente.md`](AUDITORIA-2026-09-11-calidad-del-frente.md) §F-14.
> Nivel 🟢. **Independiente.** No toca ningún criterio del SOM.

## El problema, en una frase

`t()` está tipado contra el diccionario, pero **23 call sites en 14 archivos lo apagan con
`as never`** para poder armar la clave con un dato de runtime:

```ts
t(`audit.action.${e.action}` as never)
t(`unitStatus.${u.status}` as never)
t(`project.status.${p.status}` as never)
```

En runtime `t()` devuelve `undefined` para una clave ausente, y el `?? fallback` está en unos call
sites y no en otros: **`routes/investor.buy.tsx:146` no lo tiene y renderiza un pill vacío.**

**Esta es la causa raíz exacta de las ~20 claves faltantes de `AuditLog` que cerró el ítem 2.4 del
plan de entrega.** El bug ya pasó una vez; se arregló el síntoma (las claves) y el escape quedó.

## Alcance

- **Cubre:** los 23 `as never` sobre `t()` y el `schematic.floorPrefix` que vale `'P'` también en
  inglés.
- **NO cubre:** el diccionario en sí, que **está impecable** — 538 claves en `es-AR` y 538 en `en-US`,
  ninguna faltante y ninguna de más, verificado parseando el archivo. Los 33 strings idénticos entre
  idiomas son todos legítimos (marcas, símbolos, interpolaciones puras) salvo ese uno.
- **NO cubre:** agregar claves nuevas. Si el tipado destapa una que falta, se agrega en el mismo
  commit y se anota.

## Diseño

Con las uniones de estado **ya cerradas en `packages/shared`**, casi todas las claves dinámicas se
pueden tipar de verdad:

```ts
type ClaveDeEstado = `unitStatus.${UnitStatus}` | `project.status.${ProjectStatus}` | …
```

El template literal type expande la unión, y **el compilador verifica que el diccionario tenga las
N claves** — sin escape, sin `?? fallback`, sin que dependa de que alguien se acuerde. Es la misma
economía que `packages/shared` entero: volver el drift *imposible* en vez de prohibido.

Para lo que legítimamente no tenga unión en `shared` (si queda algo), el escape es **un helper
explícito** con nombre —`tDinamico(clave, fallback)`, fallback obligatorio— y no un `as never`. Un
escape que se ve y que no puede olvidarse el fallback es distinto de uno que desaparece en el diff.

## Invariantes

1. **Cero `as never` sobre `t()`** en `apps/web/src`.
2. **Toda clave derivada de una unión de `packages/shared` está verificada por el compilador**: si
   la unión crece y el diccionario no, no compila.
3. **Ningún call site puede renderizar vacío por clave ausente**: o la clave está probada por tipo, o
   pasó por el helper con fallback obligatorio.
4. Las 538 claves siguen siendo 538 en los dos idiomas, o el delta está anotado.

## Casos borde

| Caso | Esperado |
|---|---|
| Se agrega un estado a `UnitStatus` en `packages/shared` | `pnpm typecheck` del front se pone rojo hasta que el diccionario tenga las dos claves |
| Una `action` de audit log que el backend manda y el front no conoce | no compila si viene de la unión ([`SPEC-207`](SPEC-207-audit-log-tipado.md) crea esa unión); mientras tanto, fallback visible |
| `schematic.floorPrefix` en `en-US` | deja de ser `'P'` |
| Clave que existe en `es-AR` y no en `en-US` | el chequeo de paridad del diccionario lo marca |

## Relación con el backend

[`SPEC-207`](SPEC-207-audit-log-tipado.md) crea `AUDIT_ACTIONS` y `AUDIT_ENTITY_TYPES` en
`packages/shared`. **Las dos specs se potencian y ninguna bloquea a la otra**: con la unión escrita,
`audit.action.${...}` —el caso más grande de los 23— pasa a estar verificado por el compilador de
punta a punta. Si 207 no entró todavía, ese call site usa el helper con fallback.
