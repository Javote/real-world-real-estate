---
name: run-app
description: Levantar PropNexus (web + api), navegarla y sacar capturas. Usar cuando pidan correr, arrancar, screenshotear o verificar un cambio en la app real y no solo en los tests.
---

# Correr PropNexus

Dos servicios: `apps/web` (TanStack Start) y `packages/api` (Express). `pnpm dev` levanta los dos
en paralelo. La web proxea `/api/**` a la API por `routeRules` de nitro (**no** por `server.proxy`
de Vite — nitro atiende las requests antes que el middleware de Vite).

**Los puertos dependen del árbol** (D-031): 3000/8787 en el principal, otros en cada worktree.
Los tuyos te los dice `scripts/worktree.sh list`. Abajo se escriben `$WEB` y `$API`.

## Arranque en frío

El arranque completo (install, `.env`, migrate, seed) está en el `README.md` §Arranque rápido, y
`scripts/worktree.sh create` lo hace solo para un árbol nuevo. Si ya está sembrado:

```bash
pnpm dev        # correr en background
```

El seed imprime los usuarios. Hoy son `admin@example.com/admin123`,
`developer@example.com/dev123`, `buyer@example.com/buyer123`, `verifier@example.com/verifier123`,
más un proyecto `torre-a`. **Ojo:** no son los cuatro roles de M2-D1 (INV/DEV/NOT/CER) — el
backend todavía no tiene `notary` y usa `buyer`/`verifier`. Si el modelo de roles ya se rehizo,
releé el seed en vez de asumir estas credenciales.

## Esperar a que estén listos

`sleep` en foreground está bloqueado. Usá Bash en background con un `until`:

```bash
until curl -sf -o /dev/null http://localhost:$WEB/; do sleep 1; done; echo listo
```

## Smoke mínimo

```bash
curl -s -X POST http://localhost:$API/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"developer@example.com","password":"dev123"}'      # 200 + token
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:$WEB/    # 200
```

## Navegar y sacar capturas

Ya está armado con Playwright. **No improvises un driver:**

```bash
pnpm e2e                          # walkthrough completo, mobile + desktop
pnpm --filter web e2e:ui          # interactivo
pnpm --filter web e2e:report      # reporte HTML de la última corrida
pnpm --filter web exec playwright test --project=desktop -g "AUTH-LOGIN-001"   # un test suelto
```

Config en `apps/web/playwright.config.ts` (toma el puerto del árbol), tests en `apps/web/e2e/`.
Salida en `apps/web/e2e/.artifacts/` (gitignoreado): `screenshots/`, videos `.webm`, traces,
reporte. El `webServer` de Playwright levanta `pnpm dev` solo y **reusa** el que ya esté corriendo.

Solo está instalado **Chromium**. El proyecto `mobile` usa el perfil iPhone 13 (390×844, touch)
pero forzando `browserName: 'chromium'`, porque el `defaultBrowserType` de ese perfil es webkit y
bajar un segundo navegador de ~100 MB no aporta. Si un test falla con `Executable doesn't exist at
.../webkit-*/pw_run.sh`, es eso.

**Mirá las capturas.** Un frame en blanco es una falla de arranque, no un test que pasó.

## Antes de debuggear

Las trampas de este frente —el `502` del proxy en dev, la hidratación en los E2E, el badge de
devtools en las capturas— están en **`apps/web/CLAUDE.md` §Trampas verificadas**, que se carga
solo al tocar ese subárbol. No se duplican acá.

Y si la app no se parece al catálogo de pantallas de M2: **eso es lo esperado**. Ver
`apps/web/CLAUDE.md`, y el estado medido en `specs/README.md`.

## Bajar todo

```bash
lsof -ti :$WEB -ti :$API | sort -u | xargs kill
```

Si se lanzó con Bash en background, además pararlo con TaskStop: matar el PID no cierra la task.
