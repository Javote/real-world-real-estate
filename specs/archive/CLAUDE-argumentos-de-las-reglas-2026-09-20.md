# El argumento largo detrás de tres reglas del `CLAUDE.md` raíz — archivado 2026-09-20

Las tres reglas siguen **vigentes** y viven en `CLAUDE.md` §Commits y ramas y §Fuera de alcance.
Lo que se movió acá es el *por qué*: el razonamiento y las mediciones que las establecieron, que ya
convencieron y solo hacen falta el día que alguien quiera revertirlas. Se archivó junto con el
saneamiento del 2026-09-20, que bajó la raíz de 597 a ~370 líneas.

---

## 1. Por qué testear, commitear y pushear son una sola unidad

Un commit local no existe para nadie más, y el remoto queda afirmando un estado que no es el real —
el mismo modo de falla que el push contra un servicio suspendido y que el TXID simulado en
producción. **No falla: miente.**

Si pushear tiene una consecuencia que el dueño debería saber —el deploy automático de Render, que el
`buildFilter` no filtra—, se pushea igual y se avisa; no se retiene el push por eso.

## 2. Por qué la excepción del `.md` la decide `git` y no el criterio de quien commitea

La regla es mecánica a propósito: *"esto es solo documentación"* clasificado a ojo es el mismo verde
falso que editar un `package.json` sin `pnpm install` (`CLAUDE.md` §Trampas), y el día que el commit
arrastre un `.ts` chico se saltea igual. El pathspec no tiene ese problema.

**Y es `git` solo, sin `grep`, por una razón medida.** La primera versión era
`... | grep -qv '\.md$'`, y es correcta con el `grep` del sistema. Pero **bajo `ugrep` —el `grep` que
shimea Claude Code en su shell— contesta al revés: un commit con `.md` + un `.ts` da "saltea"**, que
es exactamente la dirección peligrosa. Comprobado en los dos binarios, no supuesto. El pathspec de
`git` no depende de qué `grep` haya en el PATH. Verificado en seis casos: solo `.md`, mixto, solo
`.ts`, nada staged, `.md` anidado, y `.MD` en mayúscula — este último manda a correr todo, que es el
lado seguro del error.

Lo que la sostiene, medido el 2026-09-11 y no estimado:

- **Nada del pipeline lee los `.md` que editamos.** Biome no parsea Markdown, y `typecheck`, `test`
  y `build` tampoco los miran. El único check que abre un `.md` es `pnpm testids`
  (`scripts/check-testids.mjs`), y lee `docs/milestone-3-implementacion/UI-implementation-plan.md`
  — que es **inmutable** por D-022. **Si algún día se tocara algo dentro de `docs/`, el skip no
  aplica**: ahí sí hay un check que lee. (Esa condición sigue escrita en la regla, en la raíz.)
- **La red sigue puesta.** `ci.yml` dispara en `push: [main]` sin filtro de paths, así que corre
  igual en CI. Saltearlo local no saca la verificación: la mueve 98s más tarde a otra máquina.
- **Son 98s.** Ese es el ahorro completo, y por eso la excepción es una línea de `git` y no un
  `verify:docs` en el `package.json` ni un flag: infraestructura nueva para 98s es el patrón que ya
  se revirtió una vez con el cron.

## 3. Por qué la documentación viaja en el mismo commit que el código que la causa

El 2026-08-27 el commit de R2 salió sin cerrar D-051, y durante tres commits `DECISIONS.md` afirmó
que la evidencia era efímera mientras la evidencia ya vivía en R2. La ventana entre el código y su
documentación es una ventana en la que el repo miente, y quien lea en el medio no tiene forma de
saberlo.

---

## Anexo: el diseño del upload directo del navegador a R2, y por qué espera

Está en `CLAUDE.md` §Fuera de alcance como una línea; el detalle es este.

Hoy el archivo hace escala en `UPLOAD_DIR` (Multer a disco → `storage.put()` → R2 → se borra,
`apps/api/src/lib/storage.ts`) antes de llegar al bucket. Eso es lo que hace que `MAX_FILE_SIZE_MB`
(subido de 10 a 50 el 2026-09-10) le pese a la RAM del proceso de Render, no solo al límite de R2
(5 GiB por PUT simple).

Un presigned URL lo evitaría, pero es un cambio de forma real:

- CORS nuevo en el bucket.
- El front pasa de un POST a un flujo de 3 pasos.
- **El hash sigue teniendo que calcularse releyendo el objeto desde R2 después** (D-027) — esa parte
  no se simplifica, que es lo que hace que el ahorro sea menor de lo que parece.

**Después de mainnet**, cuando el volumen de uploads reales lo justifique frente al costo de tocar
`storage.ts` (🟡) y el único endpoint que hoy usa `uploadSingleEvidence`.
