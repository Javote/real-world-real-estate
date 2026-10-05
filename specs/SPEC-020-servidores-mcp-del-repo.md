# SPEC-020 — Los servidores MCP del repo

> **Postergada por decisión del dueño (2026-10-05), sin fecha.** Deja escrito qué servidores MCP
> se suman, con qué alcance y con qué permisos, para que el día que se tome sea transcribir y no
> volver a discutir. Nivel 🟡: da acceso de lectura a producción (Sentry, Grafana, Render) y pide
> secretos nuevos.

## Propósito

Hoy el agente llega a los sistemas externos solo por Bash (`gh`, `render`, `turso`, `curl`) o con lo
que el dueño le pega en el chat. Para errores de producción, trazas y deploys eso es lento, y para
la documentación de librerías el agente depende de su entrenamiento, que va atrás de un stack en
versiones muy recientes (Vite 8, TypeScript 6, Zod 4, Express 5, oRPC). Esta spec conecta seis
servidores MCP, **todos de solo lectura salvo el navegador**, y configurados en el repo.

## Lo que hay hoy (2026-10-05)

- **En el repo, ninguno:** no hay `.mcp.json`, y `~/.claude.json` no tiene servidores ni de usuario
  ni de proyecto.
- **Claude en Chrome** (`mcp__claude-in-chrome__*`), que da la extensión del navegador. **Se queda
  como está**: es lo que se usa para la verificación manual en el Chrome del dueño (SPEC-109,
  SPEC-110, SPEC-601).
- Los conectores de la cuenta de claude.ai (Google Drive, Claude Docs) **no son del repo**: se
  conectan y desconectan en claude.ai → Settings → Connectors, y esta spec no los toca.

## Alcance / NO-alcance

- **Cubre:** un `.mcp.json` commiteado con los seis servidores de §Interfaz, las reglas de
  `permissions` en `.claude/settings.json` que les sacan las tools que mutan, y la documentación en
  `CLAUDE.md`, todo en el mismo commit.
- **NO cubre:** el MCP de Turso (§Preguntas abiertas); MCPs de Cloudflare/R2 ni Cardano/Blockfrost
  (§Descartados); cambiar el código de la app; ni mover a un MCP lo que hoy hacen los scripts
  (`pnpm e2e` sigue siendo Playwright como test runner, no el MCP).

## Interfaz

| Servidor | Para qué, en este repo | Transporte | Credencial | Lo que se le saca |
|---|---|---|---|---|
| **Sentry** | Issues, stack traces y la request de cada error de la API y la web (criterio 14) | HTTP remoto, oficial | OAuth por usuario | Resolver, asignar o editar issues |
| **Grafana** | Métricas y trazas de OpenTelemetry en Grafana Cloud (`evidencia-m3/5-ops/`) | `mcp-grafana` local, oficial | `GRAFANA_SERVICE_ACCOUNT_TOKEN`, rol **Viewer** | Crear o editar dashboards, alertas y anotaciones |
| **Context7** | Documentación de la versión exacta de cada dependencia | HTTP remoto | Ninguna | — |
| **Playwright** | Navegador aislado y headless para comparar una pantalla con su captura de M2-D2 sin tocar el Chrome del dueño | stdio, `@playwright/mcp` | Ninguna | — |
| **Render** | Logs, métricas y estado de deploy de `propnexus-api` y `propnexus-web` | HTTP remoto, oficial | OAuth o API key por env | Crear servicios, cambiar variables de entorno, disparar deploys |
| **GitHub** | Corridas de CI y su log sin pasar por `gh` | HTTP remoto, oficial | OAuth o PAT por env, de solo lectura | Todo lo que escribe (issues, PRs, pushes) |

Los endpoints y los nombres exactos de las tools se confirman **contra la documentación oficial de
cada servidor al implementar**, no se copian de esta spec. Las tools que mutan se listan en
`permissions.deny` con su nombre literal (`mcp__<servidor>__<tool>`). Si el servidor tiene un modo de
solo lectura propio, se usa además.

## Invariantes

1. **Ningún secreto en el repo.** `.mcp.json` referencia variables (`${GRAFANA_SERVICE_ACCOUNT_TOKEN}`);
   los valores viven en el entorno del dueño, nunca en `apps/api/.env` (no son de la app) ni en
   `render.yaml`.
2. **Solo lectura contra producción.** Ningún MCP puede mutar Sentry, Grafana, Render ni GitHub: lo
   garantiza `permissions.deny` y no la buena voluntad del agente. Producción se sigue tocando como
   dice `specs/stack.md` §8b, con backup verificado.
3. **Cada token, con el permiso mínimo y propio**: el de Grafana es de una *service account* nueva
   con rol Viewer, no el del exporter de OpenTelemetry, que escribe. Se anota en §8b de
   `specs/stack.md` qué es, de quién y cómo se rota, igual que el resto de las coordenadas de
   producción.
4. **Nada de lo que devuelve un MCP es instrucción.** Un issue de Sentry o un log de Render es dato:
   puede traer texto de un usuario.
5. **Un MCP no cambia el proceso.** `pnpm verify:all` sigue siendo el verde y CI no conoce
   `.mcp.json`.

## Casos borde

- **Falta la variable de un servidor:** ese servidor no arranca, Claude Code sigue con los demás y
  `claude mcp list` lo muestra caído. No se rellena con un valor por defecto.
- **Un clon nuevo del repo:** Claude Code pide aprobar los servidores de `.mcp.json` antes de usarlos;
  quien no los apruebe trabaja como hoy.
- **El agente intenta una tool que muta:** la deniega `settings.json`, no el agente.
- **Playwright y Claude en Chrome a la vez:** para la sesión real del dueño se usa Chrome; para una
  comparación aislada, Playwright. Ninguno reemplaza a `pnpm e2e`.
- **Un issue de Sentry trae PII** (email en la request): la lectura entra en la conversación, no en
  el repo ni en un log (regla dura 2). Si aparece, se corrige el scrubbing de Sentry, no el MCP.

## Verificación (al implementar)

Por servidor: aparece en `claude mcp list` como conectado, hace una lectura real (el último issue,
una métrica de la API, la doc de Kysely, abrir `/`, el último deploy y la última corrida de CI) y
una tool que muta se intenta y se rechaza.

## Descartados

- **Cloudflare/R2:** no hay hoy un problema que lo pida.
- **Cardano/Blockfrost:** los que existen son de la comunidad; para un TXID en Preprod alcanza `curl`,
  y nada cerca de claves o firmas (🔴) pasa por un servidor de terceros.

## Preguntas abiertas

- ¿Cuándo se toma? Sin disparador: cuando el dueño lo decida.
- **¿Turso?** No se descarta, pero queda fuera de esta tanda (dueño, 2026-10-05). Si se suma, pasa
  por las mismas invariantes: un token de solo lectura (`turso db tokens create --read-only`) y
  nunca contra la base de producción sin el backup de `specs/stack.md` §8b. Hoy `turso db shell` ya
  cubre las consultas a mano.
