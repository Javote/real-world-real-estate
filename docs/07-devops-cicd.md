# 07 — DevOps y CI/CD

## Filosofía

- **Deploy = git push a `main`.** Nadie despliega a mano.
- **GitHub Actions NO despliega:** solo es la barrera de calidad (typecheck, lint, tests, build, `aiken check`). El deploy lo dispara la plataforma al detectar el push. Cero secrets de deploy en GitHub, cero SSH, cero scripts propios.
- **Migraciones automáticas:** el entrypoint de la API corre `drizzle migrate` (idempotente) antes de arrancar. Regla: migraciones siempre aditivas; una columna se deja de usar en un deploy y se borra en el siguiente.
- **Un entorno por ahora:** `main` → Preprod. Mainnet será un entorno nuevo (`release` branch + variables propias), no un cambio de código.
- **CI nunca toca Cardano:** el anclaje se mockea (`CARDANO_E2E=0`). Preprod se prueba a mano o en un job manual.

## Archivos de esta carpeta

```
devops/
├── .github/workflows/ci.yml        → copiar a la raíz del repo
├── apps/web/Dockerfile             → idem
├── packages/api/Dockerfile         → idem
├── packages/api/docker-entrypoint.sh
└── docker-compose.prod.yml         → raíz del repo (solo camino VPS)
```

Requisito de código: crear `packages/api/src/migrate.ts` (compila a `dist/migrate.js`) que corre el migrator de drizzle-orm contra `DATABASE_URL` y sale con código 0/1. Y exponer `GET /health` (ya está en la spec).

---

## Camino A — Railway (recomendado para arrancar)

1. **Crear proyecto** en railway.app → "Deploy from GitHub repo".
2. **Servicio `api`:** Settings → Build: Dockerfile path `packages/api/Dockerfile`, contexto raíz. Networking: puerto 8787, generar dominio.
3. **Servicio `web`:** Dockerfile path `apps/web/Dockerfile`. Build arg `PUBLIC_API_URL` = URL pública de la API. Puerto 3000, generar dominio.
4. **Postgres:** "New → Database → PostgreSQL". Copiar la `DATABASE_URL` que genera a las variables del servicio `api`.
5. **Storage:** crear bucket en Cloudflare R2 → API token → setear `S3_ENDPOINT` (endpoint de la cuenta R2), `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` en `api`.
6. **Resto de variables** en `api`: `JWT_SECRET` (generar con `openssl rand -hex 32`), `BLOCKFROST_API_KEY`, `SERVICE_WALLET_SEED`, `CARDANO_NETWORK=Preprod`, `EXPLORER_BASE`, `ANCHOR_METADATA_LABEL`.
7. **Auto-deploy:** ya está activo por defecto sobre `main`. En Settings → Deploy, activar "Wait for CI" para que Railway espere el verde de GitHub Actions antes de desplegar.
8. Push a `main` → migra → despliega → healthcheck → tráfico. Rollback: un click en el deploy anterior.

Render es equivalente (Web Services desde Dockerfile + Postgres administrado); elegir por precio/preferencia.

## Camino B — VPS + Coolify (más barato, self-hosted)

1. VPS Ubuntu (Hetzner CX22 o similar, 2 vCPU / 4 GB alcanza de sobra).
2. Instalar Coolify: `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash` → abrir el panel, conectar el repo de GitHub.
3. Crear recurso "Docker Compose" apuntando a `docker-compose.prod.yml`. Coolify levanta web+api+db+backup, pone HTTPS (Let's Encrypt) delante de `web` (:3000) y `api` (:8787) con los dominios que definas.
4. Cargar las variables de entorno en el panel (mismas del camino A + `POSTGRES_PASSWORD`).
5. Activar auto-deploy on push (webhook de GitHub que Coolify configura solo).
6. Backups: el servicio `db-backup` del compose hace `pg_dump` diario con retención de 14 días; para off-site, agregar un cron que sincronice `/backups` a R2 (`rclone`). **Probar una restauración antes de darlo por hecho.**

## Checklist de salida a producción (cuando toque)

- [ ] `JWT_SECRET` rotado y único por entorno
- [ ] Wallet de servicio nueva para mainnet, seed guardada en gestor de secretos (no en un chat, no en un doc compartido)
- [ ] `CARDANO_NETWORK=Mainnet`, `EXPLORER_BASE=https://cardanoscan.io`, API key de Blockfrost mainnet
- [ ] Restauración de backup ensayada
- [ ] Rate limiting activo en `/auth/*` y endpoints públicos
- [ ] Dominio con HTTPS forzado y HSTS
- [ ] Alertas mínimas: healthcheck externo (UptimeRobot/BetterStack) sobre `/health` y la home
