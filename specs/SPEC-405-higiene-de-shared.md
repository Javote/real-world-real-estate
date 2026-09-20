# SPEC-405 — Higiene de `packages/shared`: el idioma, dos tipos, y un comentario al revés

> **Origen:** [`AUDITORIA-2026-09-11-calidad-de-packages.md`](AUDITORIA-2026-09-11-calidad-de-packages.md)
> §P-07. Nivel 🟢. **Independiente.** La más chica de la serie — tres cambios mecánicos, ninguno con
> efecto en runtime. No toca ningún criterio del SOM.

## Los tres

### 1 · El único `z.string().datetime()` que queda

`documents.ts:178` — `evidenceProofSchema.timestamp: z.string().datetime().nullable()`. Todo el
resto del package usa `z.iso.datetime()`, que es el idioma de Zod 4.

No cambia nada en runtime. Importa por lo que `auth.ts` advierte en su encabezado:

> *"este archivo es el patrón que copian los schemas de cada rebanada: si acá queda el idioma viejo,
> se replica ochenta veces"*

Es exactamente eso, atrapado en uno. Pasa a `z.iso.datetime()`.

### 2 · Dos schemas sin su tipo inferido

`packages/shared/CLAUDE.md` §Cómo agregar un contrato, paso 2: *"Exportá el schema **y** el tipo
inferido"*. No lo cumplen:

| Schema | Dónde | Tipo que falta |
|---|---|---|
| `merkleStepSchema` | `documents.ts` | `MerkleStep` — **ojo: lo resuelve `SPEC-404`**, no duplicar |
| `notificationQuerySchema` | `notifications.ts` | `NotificationQuery` |

Los otros cinco schemas exportados sin tipo (`passwordSchema`, `refSchema`, `commitmentSchema`,
`cuidParamSchema`, `positiveIntParamSchema`) son **primitivos** y está bien que no lo tengan: su
tipo inferido es `string` o `number`, y exportarlo sería ruido. La regla aplica a los objetos.

**Si `SPEC-404` ya se tomó, acá solo queda `notificationQuerySchema`.** Son independientes en el
orden que sea; lo único que no hay que hacer es declarar `MerkleStep` dos veces por tomarlas juntas.

### 3 · El comentario del `tsconfig.json` afirma lo contrario del `package.json`

`packages/shared/tsconfig.json`, líneas 6-8:

> *"El package.json apunta `types` al FUENTE y `main` al dist: así el typecheck de los consumidores
> no depende de que este package esté compilado"*

`package.json` dice `"types": "./dist/index.d.ts"`. Apunta al **dist**, no al fuente, y el
typecheck **sí** depende de que esté compilado — por eso `pnpm typecheck` de la raíz empieza con
`pnpm --filter @plataforma/shared build`.

El `CLAUDE.md` del package tiene la explicación correcta, con la tabla de resolución por consumidor y
el motivo (*"un `.d.ts` nunca se emite, así que no cae bajo el `rootDir` del consumidor"*). El
comentario del tsconfig quedó de la versión anterior del cambio.

Se corrige el comentario, no el `package.json`: **el `package.json` está bien** y el `CLAUDE.md`
explica por qué.

## Alcance / NO-alcance

- **Cubre:** los tres puntos de arriba, y nada más.
- **NO cubre:** cambiar la resolución del package, el `main`, el `types` ni el `prepare`. Están
  decididos y documentados.
- **NO cubre:** una pasada de "modernizar Zod" por todo el package. El resto ya está en idioma 4;
  esto es un caso suelto.

## Invariantes

1. **Un solo idioma de Zod en `shared`.** Si aparece una forma vieja, es porque se copió de otro
   lado y se corrige donde se copió.
2. Todo schema de **objeto** exportado exporta su tipo inferido.
3. **Ningún comentario de configuración afirma algo que el archivo de al lado desmiente.** Cuando los
   dos se contradicen, gana el que el pipeline ejecuta.

## Casos borde (definen los tests)

Sin tests nuevos: los dos primeros los cubre el typecheck y el tercero es prosa. El único chequeo es
que `pnpm verify` siga verde — si `z.iso.datetime()` rechazara algo que `z.string().datetime()`
aceptaba, lo vería el test del endpoint de proof, y eso sería un hallazgo, no un obstáculo.

## Cerrada — 2026-09-19

Los tres, mecánicos: `evidenceProofSchema.timestamp` pasa a `z.iso.datetime()`
(`documents.ts`); `notificationQuerySchema` exporta `NotificationQuery`
(`notifications.ts`) — `MerkleStep` ya lo había resuelto `SPEC-404`, no se duplicó; el comentario de
`packages/shared/tsconfig.json` deja de afirmar que `types` apunta al fuente y explica lo que
`CLAUDE.md` del package ya tenía bien (apunta al dist, y por eso el typecheck de la raíz compila
`shared` antes de verificar).

`z.iso.datetime()` acepta lo mismo que `z.string().datetime()` para este campo: `pnpm verify`
completo, verde, sin tocar ningún test — como preveía la spec, si hubiera rechazado algo lo habría
visto el test del endpoint de proof.
