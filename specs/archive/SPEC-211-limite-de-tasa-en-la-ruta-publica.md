# SPEC-211 — La otra ruta sin sesión no tiene límite de tasa

> **Origen:** [`AUDITORIA-2026-09-11-calidad-del-backend.md`](AUDITORIA-2026-09-11-calidad-del-backend.md) §B-11.
> Nivel 🟡 — toca una superficie sin sesión. **Independiente.** No toca ningún criterio del SOM.

## El problema, en una frase

`GET /public/dossier/:shareToken` (`public.routes.ts:32`) **no está detrás de ningún limiter**, y cada
hit corre `compileDossier`: cuatro queries, **una escritura** si el `masterHash` cambió y, si el
dossier está firmado, **una consulta a Blockfrost** vía `reconciliarParaLectura`.

El token es de 256 bits, así que **enumerar no es el riesgo**. El riesgo es que un link compartido es,
por diseño, público: quien lo tiene puede repetirlo, y cada repetición produce escrituras y consumo de
cuota de un proveedor externo **desde tráfico sin sesión**.

El detalle que lo hace incómodo: **es un `GET` que escribe**, cosa que está justificada (M2-D5 §3 pide
compilación on-demand) pero que cambia el cálculo.

## Qué se cambia

Un `rateLimit` por IP montado en ese router, con el **mismo shape de error** (`{ message }`) que
`loginRateLimiter`. La pieza ya está escrita y parametrizada por env: `middlewares/rateLimit.ts` ya
razona esto para `/login` —y lo razona bien, **incluida la decisión de limitar por IP y no por
email**— pero la conclusión no llegó a la otra ruta sin sesión.

El límite es **más laxo que el del login**: acá el caso legítimo es un escribano que abre el link
varias veces, no un intento de adivinar una credencial. El número concreto va a `render.yaml` en el
mismo commit, o `test/render-config.test.ts` se pone rojo — que es el punto de ese test (D-076).

## Lo que esta spec no cambia

- **La ruta sigue sin sesión y sin middleware de autenticación.** Vive en su propio router
  precisamente porque un `router.use(authenticate)` montado antes la mató una vez (SPEC-015 §4).
  Un limiter **no es** un middleware de sesión y no puede reintroducir ese bug, pero se monta en ese
  router y en ninguno global.
- **Lo que devuelve queda recortado igual**: hashes, TXID y etiquetas de artefacto, nada de la unidad
  ni del investor (regla 2).
- **Un token que no existe sigue siendo 404 sin más detalle.**

## Invariantes

1. **Toda ruta sin sesión está detrás de un limiter.** Hoy son dos: `/auth/login` y esta.
2. **El límite es por IP**, por el mismo argumento ya escrito para el login.
3. **El error tiene la forma que el front ya sabe leer** (`{ message }`).
4. **El límite está declarado en `render.yaml`**, no solo en el código.

## Casos borde (definen los tests)

| Caso | Esperado |
|---|---|
| Un escribano abriendo el link 5 veces en un minuto | pasa; el límite no rompe el caso legítimo |
| Ráfaga muy por encima del límite | 429 con `{ message }`, **sin** correr `compileDossier` |
| 429 alcanzado | ninguna escritura, ninguna llamada a Blockfrost |
| Token inexistente, repetido | cuenta para el límite igual (si no, es un oráculo de "existe/no existe" por costo) |
| Otra ruta con sesión | no afectada |
