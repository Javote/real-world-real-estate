# SPEC-403 — El `authoritative` del multipart solo entiende el literal `"true"`

> **Origen:** [`AUDITORIA-2026-09-11-calidad-de-packages.md`](AUDITORIA-2026-09-11-calidad-de-packages.md)
> §P-04. Nivel 🟢. **Independiente.** No toca ningún criterio del SOM.

## El problema, en una frase

`stageEvidenceUploadSchema.authoritative` es `.transform((v) => v === "true")`, así que **todo lo que
no sea exactamente esas cuatro letras se guarda como "no autoritativa", en silencio** — incluido
`"on"`, que es lo que manda un checkbox HTML sin `value`.

Comprobado ejecutándolo:

```
authoritative("true") => true
authoritative("True") => false      authoritative("on")  => false
authoritative("1")    => false      authoritative("yes") => false
```

## Por qué no es cosmético

Ese campo es la entrada de D-028: una evidencia **declarada** autoritativa tiene que decir de qué
autoridad proviene, y si no lo dice, la transición se rechaza con `STAGE_EVIDENCE_UNATTRIBUTED`. Con
la transformación de hoy, un cliente que manda `"on"` obtiene:

1. la evidencia subida, con `authoritative = false`;
2. `issuingAuthority` guardada igual, pero sin nada que la exija;
3. **el guard nunca se dispara**, porque para la base esa evidencia no declara nada.

Nadie ve un error. Hay un campo que el usuario marcó y el registro no tiene — que es exactamente el
modo de falla que este repo llama "no falla: miente".

**Hoy no está roto en producción** (verificado: `apps/web` no manda el campo en ninguna superficie).
Está indefenso ante el primer cliente que lo mande, y **no hay ningún test sobre la transformación**.

## Qué se cambia

Un parseo de booleano de formulario, explícito y con lista cerrada, para el schema de multipart:

- **verdadero:** `"true"`, `"on"`, `"1"` — los tres que un formulario HTML produce realmente
- **falso:** `"false"`, `"off"`, `"0"`, `""`, ausente
- **cualquier otra cosa:** **400**, no `false`

La tercera línea es la que importa: hoy un valor desconocido cae en `false` sin ruido. Un multipart
es entrada del cliente, y la regla 6 pide que una entrada inválida sea 400 y no un default silencioso
— el mismo criterio que `projectListQuerySchema` ya aplica a `status`.

Mismo tratamiento para cualquier otro booleano que llegue por multipart; hoy es el único.

## Alcance / NO-alcance

- **Cubre:** `stageEvidenceUploadSchema` en `packages/shared/src/documents.ts`, y sus tests.
- **NO cubre:** `issuingAuthority`, cuya transformación (`v?.trim() || null`) es correcta y está
  explicada: un solo estado de "falta" para que el guard tenga una sola cosa que mirar.
- **NO cubre:** agregar el control al front. Si `apps/web` quiere ofrecer la casilla, es trabajo de
  su superficie; esta spec hace que cuando llegue, llegue bien.
- **NO cubre:** cambiar el guard de la transición ni D-028.

## Invariantes

1. **Un booleano de formulario no tiene un default silencioso.** O es reconocible, o es 400.
2. La lista de valores verdaderos y falsos está escrita en un solo lugar y tiene test.
3. `authoritative` ausente sigue siendo `false` — ese sí es un default legítimo: no declarar nada es
   no declarar nada.

## Casos borde (definen los tests)

| Entrada | Esperado |
|---|---|
| `"true"` · `"on"` · `"1"` | `true` |
| `"false"` · `"off"` · `"0"` · `""` | `false` |
| ausente | `false` |
| `"True"` · `"TRUE"` | `true` — se compara sin distinguir mayúsculas |
| `"sí"` · `"maybe"` · `"2"` | **400** |
| `authoritative: "on"` + `issuingAuthority` vacía | 400 del guard `STAGE_EVIDENCE_UNATTRIBUTED` al transicionar — que es el caso que hoy no llega nunca |

## Verificación

Un test de `packages/shared` por cada fila de la tabla, y un test de `apps/api` que suba evidencia
con `authoritative=on` sin `issuingAuthority` y exija que la transición a `Completed` se rechace.
Ese segundo es el que prueba que el arreglo sirve para algo.

## Cerrada — 2026-09-19

`multipartBooleanSchema` en `packages/shared/src/documents.ts`: dos `Set` (verdadero/falso),
comparación sin distinguir mayúsculas, y `ctx.addIssue` + `z.NEVER` para cualquier otro valor — 400,
no un default. `stageEvidenceUploadSchema.authoritative` lo usa; `issuingAuthority` no se tocó.

`packages/shared/src/documents.test.ts` (nuevo — el archivo no tenía tests) cubre las 6 filas de la
tabla de casos borde. `apps/api/test/evidence-upload.test.ts` suma el caso end-to-end: sube evidencia
real vía `POST .../evidence` con `authoritative: "on"` sin `issuingAuthority` sobre un stage
`validationCritical`, y confirma que `PATCH /stages/:id/state → Completed` devuelve 409
`STAGE_EVIDENCE_UNATTRIBUTED` — el caso que antes no llegaba nunca porque `"on"` se guardaba como
`false`. `pnpm verify` completo, verde.
