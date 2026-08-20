#!/usr/bin/env python3
"""Analiza un comando de shell para los guardias: ¿escribe donde no debe? ¿pushea?

La lección que este archivo encapsula, aprendida varias veces el 2026-08-20:

    un comando de shell contiene DATOS además de código.

Un `cat > x.md <<EOF ... EOF` cuyo cuerpo menciona una ruta protegida o un push
no está escribiendo ahí ni pusheando: está escribiendo texto que los nombra. La
primera versión del guardia matcheaba la mención y (a) se bloqueó a sí misma al
escribirse, y (b) disparó la puerta al escribir un skill que documenta el push.

Por eso acá: primero se sacan los cuerpos de heredoc, después se matchea, y solo
en posición de invocación.

Uso:  analyze-cmd.py "<comando>"
Sale: líneas `WRITE=<ruta protegida>`, `PUSH=1`, `FORCE=1`, `ENV=<VAR>=<valor>`
      (las que apliquen).
"""
import os
import re
import sys

WRITERS = r"(?:sed\s+-i|tee|truncate|rm|mv|cp|dd|install|chmod|chown|touch|mkdir)"
HEREDOC_START = re.compile(r"<<-?\s*(['\"]?)([A-Za-z_][A-Za-z_0-9]*)\1")

# Lista CERRADA a propósito: reenviar cualquier variable sería un canal para
# inyectarle entorno al gate.
ESCAPES = ("GATE_ALLOW_DOCS", "GATE_SKIP_CONTRACTS")

INLINE_ASSIGN = re.compile(r"(?:^|[;&|]|\n)\s*(?P<env>(?:[A-Za-z_][A-Za-z_0-9]*=\S*\s+)+)")

PUSH_INVOCATION = re.compile(
    r"(?:^|[;&|]|\n)\s*(?P<env>(?:[A-Za-z_][A-Za-z_0-9]*=\S*\s+)*)git\s+(?:-\S+\s+)*push\b"
)


def strip_heredocs(cmd):
    """Devuelve el comando sin los cuerpos de heredoc — solo el código."""
    out, pending = [], []
    for line in cmd.split("\n"):
        if pending:
            if line.strip() == pending[0]:
                pending.pop(0)
            continue
        out.append(line)
        pending.extend(m.group(2) for m in HEREDOC_START.finditer(line))
    return "\n".join(out)


def inline_escapes(code):
    """Escapes reconocidos escritos como prefijo de un comando.

    Un escape escrito en la línea de comando vale lo mismo que uno del entorno:
    el hook corre en su propio proceso y no hereda el primero. Tiene que valer
    igual para escrituras y para el push, o el mecanismo se vuelve impredecible
    según qué check lo consulte.
    """
    found = {}
    for m in INLINE_ASSIGN.finditer(code):
        for assign in m.group("env").split():
            name, _, value = assign.partition("=")
            if name in ESCAPES:
                found[name] = value
    return found


def escape_active(name, code):
    return os.environ.get(name, "0") == "1" or inline_escapes(code).get(name) == "1"


def protected_paths(code=""):
    paths = ["packages/api/prisma/migrations/", "contracts/build/"]
    if not escape_active("GATE_ALLOW_DOCS", code):
        paths.insert(0, "docs/")
    return paths


def write_target(code):
    """Ruta protegida hacia la que este comando ESCRIBE, o None."""
    for path in protected_paths(code):
        q = re.escape(path)
        # a) redirección hacia la ruta. El [^\s>|] inicial descarta el `>` de
        #    citas markdown a principio de línea.
        redirect = re.search(r"[^\s>|][ \t]*>>?[ \t]*['\"]?" + q, code)
        # b) comando que escribe con la ruta entre sus argumentos, misma línea
        writer = re.search(r"(?:^|[;&|]|\s)" + WRITERS + r"\b[^;|&\n]*" + q, code)
        if redirect or writer:
            return path
    return None


def push_info(code):
    """(pushea, es_forzado, escapes) — solo si `git push` está en invocación."""
    m = PUSH_INVOCATION.search(code)
    if not m:
        return False, False, []
    segment = re.split(r"[;&|\n]", code[m.start():])[0]
    forced = bool(re.search(r"--force(?!-with-lease)\b|(?:^|\s)-f(?=\s|$)", segment))
    escapes = [a for a in m.group("env").split() if a.split("=", 1)[0] in ESCAPES]
    return True, forced, escapes


if __name__ == "__main__":
    raw = sys.argv[1] if len(sys.argv) > 1 else ""
    code = strip_heredocs(raw)
    hit = write_target(code)
    if hit:
        print("WRITE=%s" % hit)
    pushes, forced, escapes = push_info(code)
    if pushes:
        print("PUSH=1")
    if forced:
        print("FORCE=1")
    for assign in escapes:
        print("ENV=%s" % assign)
