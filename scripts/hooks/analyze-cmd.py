#!/usr/bin/env python3
"""Analiza un comando de shell para los guardias: ¿escribe donde no debe? ¿pushea?

La lección que este archivo encapsula, aprendida dos veces el 2026-08-20:

    un comando de shell contiene DATOS además de código.

Un `cat > x.md <<EOF ... EOF` cuyo cuerpo menciona `docs/` o `git push` no está
escribiendo en docs/ ni pusheando: está escribiendo texto que los nombra. La
primera versión del guardia matcheaba la mención y (a) se bloqueó a sí misma al
escribirse, y (b) disparó la puerta al escribir un skill que documenta el push.

Por eso acá: primero se sacan los cuerpos de heredoc, después se matchea, y solo
en posición de invocación.

Uso:  analyze-cmd.py "<comando>"
Sale: líneas `WRITE=<ruta protegida>`, `PUSH=1`, `FORCE=1` (las que apliquen).
"""
import os
import re
import sys

WRITERS = r"(?:sed\s+-i|tee|truncate|rm|mv|cp|dd|install|chmod|chown|touch|mkdir)"
HEREDOC_START = re.compile(r"<<-?\s*(['\"]?)([A-Za-z_][A-Za-z_0-9]*)\1")


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


def protected_paths():
    paths = ["packages/api/prisma/migrations/", "contracts/build/"]
    if os.environ.get("GATE_ALLOW_DOCS", "0") != "1":
        paths.insert(0, "docs/")
    return paths


def write_target(code):
    """Ruta protegida hacia la que este comando ESCRIBE, o None."""
    for path in protected_paths():
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
    """(pushea, es_forzado) — solo si `git push` está en posición de invocación."""
    invocation = re.compile(
        r"(?:^|[;&|]|\n)\s*(?:[A-Za-z_][A-Za-z_0-9]*=\S*\s+)*git\s+(?:-\S+\s+)*push\b"
    )
    m = invocation.search(code)
    if not m:
        return False, False
    segment = re.split(r"[;&|\n]", code[m.start():])[0]
    forced = bool(re.search(r"--force(?!-with-lease)\b|(?:^|\s)-f(?=\s|$)", segment))
    return True, forced


if __name__ == "__main__":
    raw = sys.argv[1] if len(sys.argv) > 1 else ""
    code = strip_heredocs(raw)
    hit = write_target(code)
    if hit:
        print("WRITE=%s" % hit)
    pushes, forced = push_info(code)
    if pushes:
        print("PUSH=1")
    if forced:
        print("FORCE=1")
