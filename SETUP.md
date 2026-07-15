# SETUP — Comandos exactos, en orden

> **Histórico (2026-07-15):** el bootstrap de este repo ya se ejecutó siguiendo este orden (commit 1 = docs, commit 2 = consolidación de código, commit 3 = CI), con una diferencia: `packages/api` no se scaffoldeó con Hono+Drizzle (§2.2) sino que se adoptó el backend existente (D-016). Se conserva como referencia del método y para los pasos aún pendientes (§2.3 capa Cardano, wallet de servicio, Blockfrost). El arranque rápido actual está en README.md.
>
> Requisitos previos: Node.js ≥ 20 LTS, pnpm ≥ 9 (`corepack enable && corepack prepare pnpm@latest --activate`), Docker, Git, Rust/cargo no hace falta (Aiken se instala con `aikup`).
> Nota: si algún comando de scaffolding cambió de nombre en su versión más reciente, verificá con `pnpm create @tanstack/start --help` y la doc oficial; el resto de la guía no depende del scaffolder.

## Orden de bootstrap (innegociable — Fase 6 del playbook)

**Commit 1 = documentación. Commit 2 = scaffold auditado. Commit 3 = CI.** Nunca código primero: toda sesión LLM necesita el contexto desde el minuto uno, y los secretos deben estar bloqueados por `.gitignore` ANTES del primer `git add`.

---

## 1. Raíz, docs y primer commit (solo documentación)

```bash
mkdir plataforma && cd plataforma
git init -b main
git config user.name "Tu Nombre" && git config user.email "tu@email"   # identidad local si difiere

# .gitignore ANTES que cualquier otra cosa:
cp <guia>/starter/.gitignore .gitignore

# Documentación completa (la memoria del proyecto):
cp <guia>/CLAUDE.md <guia>/DECISIONS.md <guia>/ROADMAP.md ./
cp -r <guia>/docs ./docs
cp -r <guia>/specs ./specs
# Snapshot congelado del material fuente:
mkdir -p docs/context && cp <ruta-a-tus-pdfs>/*.pdf docs/context/   # + el extracto ya incluido

# Estructura vacía con .gitkeep:
mkdir -p apps packages/api/src packages/db/src packages/shared/src packages/cardano/src scripts
find apps packages scripts -type d -empty -exec touch {}/.gitkeep \;

git add -A
git commit -m "docs(repo): documentación fundacional (CLAUDE, DECISIONS, ROADMAP, specs, context)"
```

## 2. Scaffold auditado y segundo commit

Configs raíz del workspace (auditar lo copiado: `packageManager` pineado, sin dependencias no justificadas):

```bash
# desde donde tengas esta guía descomprimida:
cp starter/pnpm-workspace.yaml starter/package.json starter/tsconfig.base.json \
   starter/.env.example starter/.npmrc ./plataforma/
```

### 2.1 Frontend — TanStack Start + shadcn/ui

```bash
cd apps
pnpm create @tanstack/start@latest web
cd web
```

Cuando el scaffolder pregunte: **TypeScript sí**, **Tailwind sí**, ESLint según preferencia del equipo.

shadcn/ui:

```bash
pnpm dlx shadcn@latest init
# Componentes base que usa todo el diseño (D3 §5):
pnpm dlx shadcn@latest add button card badge input textarea select dialog \
  dropdown-menu tabs toast skeleton avatar separator switch table sheet sonner
```

Dependencias del frontend:

```bash
pnpm add @tanstack/react-query zod lucide-react date-fns
pnpm add -D @playwright/test
```

---

### 2.2 Backend — Hono + Drizzle + PostgreSQL

```bash
cd ../../packages/api
pnpm init
pnpm add hono @hono/node-server @hono/zod-validator zod jose bcryptjs
pnpm add -D tsx typescript vitest @types/node
```

```bash
cd ../db
pnpm init
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit typescript tsx
```

```bash
cd ../shared
pnpm init
pnpm add zod
pnpm add -D typescript
```

PostgreSQL local:

```bash
docker run -d --name plataforma-pg \
  -e POSTGRES_USER=app -e POSTGRES_PASSWORD=app -e POSTGRES_DB=plataforma \
  -p 5432:5432 postgres:16
```

Almacenamiento de archivos local (S3-compatible) para evidencia:

```bash
docker run -d --name plataforma-minio \
  -e MINIO_ROOT_USER=minio -e MINIO_ROOT_PASSWORD=minio12345 \
  -p 9000:9000 -p 9001:9001 minio/minio server /data --console-address ":9001"
```

```bash
cd ../api
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

---

### 2.3 Capa Cardano en TypeScript

```bash
cd ../cardano
pnpm init
pnpm add @lucid-evolution/lucid
pnpm add -D typescript vitest
```

> Alternativa equivalente: `@meshsdk/core`. Elegir una y documentarlo en el CLAUDE.md. Esta guía asume Lucid Evolution + Blockfrost.

Crear cuenta en Blockfrost (https://blockfrost.io), proyecto **Preprod**, y setear `BLOCKFROST_API_KEY` en `.env`.

Wallet de servicio (para firmar transacciones de anclaje del backend):

```bash
# Generar una seed nueva SOLO para preprod/desarrollo. Nunca commitear.
# Fondearla con el faucet: https://docs.cardano.org/cardano-testnets/tools/faucet
```

---

### 2.4 Smart contracts — Aiken

```bash
cd ../../   # raíz del monorepo
# Instalar aiken:
curl --proto '=https' --tlsv1.2 -LsSf https://install.aiken-lang.org | sh
aikup            # instala la última versión estable

aiken new plataforma/contracts   # crea ./contracts con aiken.toml, lib/, validators/
cd contracts
aiken check      # debe pasar en verde con el proyecto vacío
```

Copiar `starter/contracts/validators/certification.ak` como validador de referencia y correr:

```bash
aiken check
aiken build      # genera plutus.json (blueprint) para consumir desde packages/cardano
```

---

### 2.5 Auditoría del scaffold y segundo commit

Antes de commitear, **auditar lo que el scaffolder trajo** (regla: toda dependencia se justifica):

- Dependencias que no pediste → afuera.
- `packageManager` pineado en el `package.json` raíz (ya viene en el de `starter/`); lockfiles committeados; versión de Aiken anotada para pinear en CI.
- Configs de lint con listas cerradas de archivos → abrirlas a "todo menos generado".

Smoke test real (que compile e importe la dependencia gorda, no un hello world vacío):

```bash
cd plataforma
pnpm install
pnpm typecheck
pnpm contracts:check                    # aiken compila el validador de referencia
node -e "import('@lucid-evolution/lucid').then(()=>console.log('lucid ok'))"
pnpm dev                                # frontend en :3000, API en :8787
curl localhost:8787/health              # → {"ok":true}

git add -A
git commit -m "chore(repo): scaffold auditado (web, api, db, shared, cardano, contracts)"
```

---

## 3. CI en el tercer commit + deploy

Los archivos ya están en `starter/` con la ruta correcta; al copiarlos quedan en su lugar:

```bash
# desde donde tengas esta guía:
cp -r starter/.github            ./plataforma/.github
cp starter/apps/web/Dockerfile   ./plataforma/apps/web/Dockerfile
cp starter/packages/api/Dockerfile           ./plataforma/packages/api/Dockerfile
cp starter/packages/api/docker-entrypoint.sh ./plataforma/packages/api/docker-entrypoint.sh
cp starter/docker-compose.prod.yml           ./plataforma/docker-compose.prod.yml
cp -r starter/contracts/lib        ./plataforma/contracts/lib
cp -r starter/contracts/validators ./plataforma/contracts/validators
```

Dos piezas de código que el CI/deploy asumen (crearlas en Sprint 0):

1. `packages/api/src/migrate.ts` → compila a `dist/migrate.js`; corre el migrator de drizzle-orm contra `DATABASE_URL` y sale 0/1. El entrypoint del contenedor lo ejecuta antes de arrancar el server.
2. `GET /health` en la API → `{"ok":true}`. Lo usan los HEALTHCHECK de Docker y el monitoreo externo.

Probar el build de producción localmente:

```bash
docker build -f packages/api/Dockerfile -t plataforma-api .
docker build -f apps/web/Dockerfile -t plataforma-web .
# o todo junto:
docker compose -f docker-compose.prod.yml up --build
```

Deploy real: seguir `docs/07-devops-cicd.md` (camino A: Railway con "Wait for CI"; camino B: VPS + Coolify). En ambos, **deploy = push a `main`**; GitHub Actions solo valida calidad, no despliega.

Tercer commit y protección:

```bash
git add -A
git commit -m "chore(ci): workflow de calidad + dockerfiles + compose de producción"
git remote add origin <url> && git push -u origin main
# En GitHub: Settings → Branches → proteger main con "Require status checks to pass"
# (quality + contracts) apenas exista el remoto — no después.
```

A partir de acá: nada mergea en rojo, y el primer objetivo declarado es el **walking skeleton** (Sprint 1 del ROADMAP, SPEC-001).

## 4. Variables de entorno (`.env.example` incluido en starter/)

```
DATABASE_URL=postgres://app:app@localhost:5432/plataforma
JWT_SECRET=cambiame-en-produccion
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minio
S3_SECRET_KEY=minio12345
S3_BUCKET=evidence
CARDANO_NETWORK=Preprod
BLOCKFROST_API_KEY=preprod_xxx
SERVICE_WALLET_SEED=palabra1 palabra2 ... palabra24
EXPLORER_BASE=https://preprod.cardanoscan.io
ANCHOR_METADATA_LABEL=1904
```
