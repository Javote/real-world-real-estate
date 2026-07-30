---
name: run-app
description: Levantar PropNexus (web :3000 + api :8787), navegarla y sacar capturas. Usar cuando pidan correr, arrancar, screenshotear o verificar un cambio en la app real y no solo en los tests.
---

# Correr PropNexus

Dos servicios: `apps/web` (TanStack Start, `:3000`) y `packages/api` (Express, `:8787`).
`pnpm dev` levanta los dos en paralelo. La web proxea `/api/**` a la API por `routeRules` de nitro
(**no** por `server.proxy` de Vite — nitro atiende las requests antes que el middleware de Vite).

## Arranque en frío

```bash
pnpm install
cp packages/api/.env.example packages/api/.env      # completar JWT_SECRET
pnpm --filter @plataforma/api db:generate
pnpm --filter @plataforma/api db:migrate            # crea packages/api/prisma/dev.db
pnpm --filter @plataforma/api db:seed
pnpm dev                                            # correr en background
```

El seed imprime los usuarios. Hoy son `admin@example.com/admin123`,
`developer@example.com/dev123`, `buyer@example.com/buyer123`, `verifier@example.com/verifier123`,
más un proyecto `torre-a`. **Ojo:** no son los cuatro roles de M2-D1 (INV/DEV/NOT/CER) — el backend
todavía no tiene `notary` y usa `buyer`/`verifier`. Si el modelo de roles ya se rehizo, releer el
seed en vez de asumir estas credenciales.

## Esperar a que estén listos

`sleep` en foreground está bloqueado. Usar Bash en background con un `until`:

```bash
until curl -sf -o /dev/null http://localhost:3000/; do sleep 1; done; echo listo
```

## Smoke mínimo

```bash
curl -s -X POST http://localhost:8787/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"developer@example.com","password":"dev123"}'          # 200 + token
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/        # 200
```

## Navegar y sacar capturas

Ya está armado con Playwright. **No improvisar un driver:**

```bash
pnpm e2e                          # walkthrough completo, mobile + desktop
pnpm --filter web e2e:ui          # interactivo
pnpm --filter web e2e:report      # reporte HTML de la última corrida
pnpm --filter web exec playwright test --project=desktop -g "AUTH-LOGIN-001"   # un test suelto
```

Config en `apps/web/playwright.config.ts`, tests en `apps/web/e2e/`. Salida en
`apps/web/e2e/.artifacts/` (gitignoreado): `screenshots/`, videos `.webm`, traces, reporte.
El `webServer` de Playwright levanta `pnpm dev` solo y **reusa** el que ya esté corriendo.

Solo está instalado **Chromium**. El proyecto `mobile` usa el perfil iPhone 13 (390×844, touch) pero
forzando `browserName: 'chromium'`, porque el `defaultBrowserType` de ese perfil es webkit y bajar un
segundo navegador de ~100 MB no aporta. Si algún test falla con
`Executable doesn't exist at .../webkit-*/pw_run.sh`, es eso.

**Mirá las capturas.** Un frame en blanco es una falla de arranque, no un test que pasó.

## Trampas verificadas

**El proxy de dev convierte `POST` + `401` en `502 Bad Gateway`.** Reproducible al 100%, y solo esa
combinación: `GET 401`, `POST 400` y `POST 200` pasan bien. Es de `h3@2.0.1-rc.25` dentro de
`nitro-nightly`, solo en el dev-worker de Vite. **Antes de debuggear un error de auth, comparar
contra `:8787` directo** — si directo da 401 y por `:3000` da 502, es esto y no tu código.

**Los tests E2E tienen que esperar la hidratación, no el DOM.** La app llega por SSR con formularios
controlados por React: un click antes de que React monte hace submit nativo del `<form>`, nunca corre
el `preventDefault`, y la página recarga sin llamar a la API. Falla intermitente que parece de
backend. Ver `waitForHydration` en `apps/web/e2e/walkthrough.spec.ts`: sondea con una interacción que
solo React puede satisfacer.

**`test.fail()` a nivel `describe` aplica a todos los tests que siguen**, no solo al próximo. Para
marcar uno suelto va **dentro** del cuerpo del test.

**Usar selectores accesibles** (`getByLabel`, `getByRole`). Fallan cuando la accesibilidad está mal,
que es justo lo que se quiere: así se encontró que los `<label>` del login no tenían `htmlFor`.

**El badge flotante de TanStack Devtools sale en las capturas.** El helper `shot()` lo esconde con
`addStyleTag`; si se agregan capturas nuevas, usar ese helper y no `page.screenshot` pelado.

**Un `*.test.tsx` dentro de `src/routes/`** lo escanea el router y avisa "does not export a Route":
prefijar con `-` o configurar `routeFileIgnorePattern`. Y `vitest` excluye `e2e/` explícitamente
porque su `include` por defecto matchea `spec` además de `test`.

## Bajar todo

```bash
lsof -ti :3000 -ti :8787 | sort -u | xargs kill
```

Si se lanzó con Bash en background, además pararlo con TaskStop; matar el PID no cierra la task.

## Estado del frontend

`apps/web` está a ~2% de conformidad con el diseño aprobado (M2): sin `GradientHeader`, sin
`BottomNav`, paleta equivocada, textos hardcodeados. Es una semilla, no la app. Al correr y ver algo
que no se parece a `docs/milestone-2-diseno/M2-D2-Screenshots-catalog/`, **eso es lo esperado** — no
es un bug que haya que arreglar de paso. Ver `specs/README.md` §Conformidad actual.
