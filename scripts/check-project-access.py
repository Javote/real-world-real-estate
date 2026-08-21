#!/usr/bin/env python3
"""¿Todos los endpoints con alcance de proyecto tienen la segunda capa?

La autorización de esta API son dos capas: rol global (`requireRole`) + membresía
por proyecto (`canAccessProject`). La primera es un middleware — está en la cadena
o no está. La segunda es una **función que hay que acordarse de llamar**, así que
un endpoint nuevo que se la olvide no tiene segunda capa y nada lo detecta: ni el
compilador, ni un test, ni la puerta.

Hoy son 27 endpoints, auditados a mano y sin agujeros; el backlog de M2-D5 son
~80. Esto no arregla la forma —eso es el `requireProjectAccess(...)` del hallazgo
9 de specs/README.md, que es 🔴 y lo lidera el humano— pero convierte "olvidarse"
de silencioso en ruidoso, que era el problema real. Es D-032 aplicado: lo que no
se puede dejar librado al azar es código, no un párrafo.

La regla, en una línea: **una ruta con parámetro en el path, o que liste
proyectos, necesita `canAccessProject`/`projectScope` o ser admin-only.**

Uso:  check-project-access.py [ruta-al-repo]   → exit 0 si todas cumplen, 1 si no.
      check-project-access.py --self-test      → verifica la verificación.
"""
import re
import sys
from pathlib import Path

ROUTES_DIR = Path("packages/api/src/routes")

# `router.get(` … `router.delete(` — el comienzo de cada registro de ruta.
ROUTE_START = re.compile(r"\brouter\.(get|post|put|patch|delete)\s*\(")
# El primer literal del registro es el path.
PATH_LITERAL = re.compile(r"""["'`]([^"'`]*)["'`]""")
# Guardia de archivo entero: router.use(..., requireRole("admin")).
FILE_GUARD = re.compile(r"""\brouter\.use\s*\([^)]*requireRole\s*\(\s*["']admin["']\s*\)""")
# requireRole("admin") con UN solo argumento. requireRole("admin","developer") NO
# cuenta: ahí el developer entra por rol y necesita la segunda capa igual.
ADMIN_ONLY = re.compile(r"""\brequireRole\s*\(\s*["']admin["']\s*\)""")
# Las dos formas de la segunda capa (D-043: la regla es una sola, con dos usos).
SECOND_LAYER = re.compile(r"\b(canAccessProject|projectScope)\b")
# Una ruta que lista proyectos necesita scope aunque no tenga parámetro en el path.
LISTS_PROJECTS = re.compile(r"\bprisma\.project\.findMany\b")

# Excepciones, con motivo. Vacío a propósito: si algo tiene que entrar acá, que
# cueste escribirlo. Una allowlist que hay que editar a mano ya es fail-loud.
ALLOWLIST: dict[str, str] = {}


def routes_of(source: str):
    """(verbo, path, cuerpo) por cada router.X(...) del archivo."""
    starts = [m for m in ROUTE_START.finditer(source)]
    for i, m in enumerate(starts):
        end = starts[i + 1].start() if i + 1 < len(starts) else len(source)
        chunk = source[m.start() : end]
        path = PATH_LITERAL.search(chunk[m.end() - m.start() :])
        yield m.group(1).upper(), (path.group(1) if path else "?"), chunk


def audit(source: str, filename: str):
    """Los endpoints de este archivo que necesitan segunda capa y no la tienen."""
    file_is_admin_only = bool(FILE_GUARD.search(source))
    faltantes = []

    for verb, path, chunk in routes_of(source):
        needs = ":" in path or bool(LISTS_PROJECTS.search(chunk))
        if not needs:
            continue
        if f"{filename}:{verb} {path}" in ALLOWLIST:
            continue
        if file_is_admin_only or ADMIN_ONLY.search(chunk):
            continue
        if SECOND_LAYER.search(chunk):
            continue
        faltantes.append(f"{verb} {path}")

    return faltantes


def main(root: Path) -> int:
    routes = sorted((root / ROUTES_DIR).glob("*.routes.ts"))
    if not routes:
        print(f"no hay rutas en {ROUTES_DIR} — ¿se movieron?")
        return 1

    problemas = []
    for f in routes:
        for ruta in audit(f.read_text(), f.name):
            problemas.append(f"{ROUTES_DIR}/{f.name}: {ruta}")

    if problemas:
        print("endpoints con alcance de proyecto y SIN segunda capa de autorización:")
        for p in problemas:
            print(f"  {p}")
        print("  → agregá canAccessProject(...) con las membresías que acepta, o")
        print("    requireRole(\"admin\") si de verdad es admin-only (M2-D1 §4)")
        return 1
    return 0


# ── Verificar la verificación ────────────────────────────────────────────────
# Un chequeo que no se prueba a sí mismo termina pasando siempre, que es peor que
# no tenerlo: da confianza sin dar cobertura.
CASOS = [
    ("ruta con parámetro y canAccessProject", 0,
     'router.get("/:id", async (req, res) => { const a = await canAccessProject(u, r, p, M); });'),
    ("ruta con parámetro y NADA", 1,
     'router.get("/:id", async (req, res) => { return res.json(await prisma.project.findUnique()); });'),
    ("ruta con parámetro, admin-only", 0,
     'router.delete("/:id", requireRole("admin"), async (req, res) => { return res.json({}); });'),
    ("requireRole('admin','developer') NO alcanza sola", 1,
     'router.patch("/:id", requireRole("admin", "developer"), async (req, res) => { return res.json({}); });'),
    ("requireRole('admin','developer') + canAccessProject", 0,
     'router.patch("/:id", requireRole("admin", "developer"), async (req, res) => { await canAccessProject(a,b,c,d); });'),
    ("ruta sin parámetro que no lista proyectos", 0,
     'router.get("/", async (req, res) => { return res.json({ ok: true }); });'),
    ("listado de proyectos sin scope", 1,
     'router.get("/", async (req, res) => { return res.json(await prisma.project.findMany({})); });'),
    ("listado de proyectos con projectScope", 0,
     'router.get("/", async (req, res) => { await prisma.project.findMany({ where: projectScope(r, u, M) }); });'),
    ("una ruta sin capa contamina al archivo, no la de al lado", 1,
     'router.get("/a/:id", async () => { await canAccessProject(a,b,c,d); });\n'
     'router.get("/b/:id", async () => { return 1; });'),
    ("guardia de archivo entero cubre todas sus rutas", 0,
     'router.use(authenticate, requireRole("admin"));\n'
     'router.get("/:id", async () => { return 1; });\n'
     'router.patch("/:id", async () => { return 1; });'),
]


def self_test() -> int:
    ok = fail = 0
    for desc, esperado, fuente in CASOS:
        got = 1 if audit(fuente, "fixture.ts") else 0
        if got == esperado:
            print(f"  ✔ {desc}")
            ok += 1
        else:
            print(f"  ✘ {desc}  (esperaba {esperado}, dio {got})")
            fail += 1
    print(f"\n{ok} pasaron · {fail} fallaron")
    return 1 if fail else 0


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        sys.exit(self_test())
    sys.exit(main(Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()))
