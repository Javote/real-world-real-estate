#!/usr/bin/env python3
"""¿El lockfile declara las mismas versiones que los package.json?

Existe por un verde falso del 2026-08-20: `packages/api/package.json` decía
TypeScript 6.0 y `node_modules` tenía 5.9, porque se editó el package.json sin
correr `pnpm install`. El typecheck local pasó — verificando con la versión
vieja— y recién lo atrapó el CI con ERR_PNPM_OUTDATED_LOCKFILE.

Por qué no `pnpm install --frozen-lockfile --lockfile-only`: **reescribe el
lockfile**, y un verificador que muta el repo que verifica no es un verificador.
Además resuelve contra la red, lo que lo vuelve lento e inestable.

Esto compara texto contra texto: los `specifier:` del bloque `importers:` del
lockfile contra las dependencias declaradas en cada package.json. Es exactamente
la comprobación que hace fallar al CI, sin red y sin efectos.

Uso:  check-lockfile.py [ruta-al-repo]     → exit 0 en sincronía, 1 si no.
"""
import json
import re
import sys
from pathlib import Path

IMPORTER = re.compile(r"^  ([^\s#][^:]*):\s*$")
DEP_NAME = re.compile(r"^      '?([^':]+)'?:\s*$")
SPECIFIER = re.compile(r"^        specifier:\s*(.+?)\s*$")
DEP_FIELDS = ("dependencies", "devDependencies", "optionalDependencies")


def lockfile_specifiers(lock_path):
    """{importer: {dep: specifier}} tal como los registra el lockfile."""
    found, importer, dep, in_importers = {}, None, None, False
    for line in lock_path.read_text().splitlines():
        if line.startswith("importers:"):
            in_importers = True
            continue
        if in_importers and line and not line.startswith(" "):
            break  # empezó otra sección de primer nivel
        if not in_importers:
            continue
        m = IMPORTER.match(line)
        if m:
            importer, dep = m.group(1).strip(), None
            found.setdefault(importer, {})
            continue
        m = DEP_NAME.match(line)
        if m:
            dep = m.group(1)
            continue
        m = SPECIFIER.match(line)
        if m and importer and dep:
            found[importer][dep] = m.group(1)
    return found


def declared_specifiers(root):
    """{importer: {dep: specifier}} tal como los declaran los package.json."""
    declared = {}
    for pkg in list(root.glob("apps/*/package.json")) + list(root.glob("packages/*/package.json")):
        if "node_modules" in pkg.parts:
            continue
        data = json.loads(pkg.read_text())
        importer = pkg.parent.relative_to(root).as_posix()
        deps = {}
        for field in DEP_FIELDS:
            deps.update(data.get(field) or {})
        declared[importer] = deps
    return declared


def main():
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    lock = root / "pnpm-lock.yaml"
    if not lock.exists():
        print("no encuentro pnpm-lock.yaml")
        return 1

    locked = lockfile_specifiers(lock)
    problems = []
    for importer, deps in sorted(declared_specifiers(root).items()):
        in_lock = locked.get(importer)
        if in_lock is None:
            problems.append(f"{importer}: no figura en el lockfile")
            continue
        for name, spec in sorted(deps.items()):
            got = in_lock.get(name)
            if got is None:
                problems.append(f"{importer} · {name}: declarado {spec}, ausente del lockfile")
            elif got != spec:
                problems.append(f"{importer} · {name}: declarado {spec}, lockfile {got}")

    if problems:
        for p in problems:
            print(p)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
