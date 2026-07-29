# Playbook: de whitepaper a proyecto ejecutándose (con LLMs)

Método extraído de un proyecto real (plataforma RWA, 3 repos, 90 días). Es una secuencia de **7 fases** con principios transversales y una guía de escalado: un PoC de un repo usa la versión mínima de cada fase, no menos fases.

---

## Principios transversales (lo que hace funcionar todo lo demás)

1. **Una sola fuente de verdad por cosa.** Cada dato vive en un lugar; el resto linkea, nunca copia. La duplicación diverge en silencio; el link roto es un fallo ruidoso — preferí siempre el fallo ruidoso.
2. **Jerarquía de precedencia explícita:** DECISIONS > CLAUDE.md > specs > roadmap/contexto (históricos). El documento en conflicto se corrige en el mismo PR en que se detecta la contradicción.
3. **Decidir rápido con defaults, refutar con spikes cortos** (≤2-3 días). Toda decisión abierta arranca con una opción por defecto; el spike existe para refutarla, no para explorar infinito. Reabrir una decisión aceptada requiere evidencia, no preferencia.
4. **El repo es la memoria; los chats son descartables.** Toda decisión, gotcha o convención que emerja en una sesión con un LLM se persiste (DECISIONS, spec, sección de gotchas) en el mismo PR.
5. **Documentar contra realidad, no intenciones.** Las specs y runbooks se escriben cuando hay código/procedimiento real que documentar, un paso antes de necesitarlos. Generar documentación especulativa produce archivos que nadie corrige.
6. **Vertical primero (walking skeleton):** antes de pulir capas, un hilo mínimo que atraviesa todo el sistema de punta a punta. Después se engorda ese hilo. La primera demo es ese hilo — como *script* primero; la UI es bonus.
7. **Dependencias externas detrás de interfaces propias** con modo real/simulado conmutables por configuración. Los simuladores son producto, no stubs. (En proyectos chicos: al menos la dependencia más lenta/incierta — el banco, la API de terceros, la testnet.)
8. **Redefinir "listo" según lo que controlás.** Si el deadline depende de terceros, el hito propio es "listo para activar": todo lo bloqueado detrás de configuración, activación en días y no semanas.
9. **LLMs para volumen, humanos para juicio,** con niveles de autonomía explícitos (verde/amarillo/rojo) según riesgo del código. Nada de lógica crítica que el revisor no pueda explicar sin mirar el chat.
10. **CI desde el primer PR** ("nada mergea en rojo" se instala con el segundo commit o nunca). **Documentación antes que código** en el primer commit, para que toda sesión LLM tenga contexto desde el minuto uno.

---

## Las 7 fases

### Fase 1 — Feedback brutal al documento fuente
Antes de planificar, someter el whitepaper/pitch/idea a una lectura honesta: qué afirma sin evidencia, qué promesas dependen de terceros, qué contradicciones internas tiene, qué plazo es realista. Salida: lista de problemas en orden de gravedad + las restricciones REALES del proyecto (mandato, plazo, qué controlás y qué no).
> *Prompt tipo:* "Leé este documento entero y dame el feedback más objetivo posible. Honesto y realista, no complaciente."

### Fase 2 — Roadmap técnico
Traducir el mandato a un plan propio: (a) redefinición de "listo" en criterios binarios verificables; (b) principios de ejecución; (c) tabla de decisiones abiertas **con default + spike** cada una; (d) arquitectura de desacople de lo que no controlás; (e) plan por sprints con objetivo, entregables y **criterios de salida binarios**; (f) riesgos con señal temprana y plan B. Regla: la fecha no se mueve; el alcance sí.
> *Prompt tipo:* "Mi mandato es X con plazo Y; controlo A, no controlo B. Dame el roadmap más detallado posible para un equipo asistido por LLMs."

### Fase 3 — Cerrar decisiones de stack + DECISIONS.md
Sesión de sí/no sobre cada decisión abierta (el humano trae preferencias; el LLM aporta trade-offs honestos y aclara confusiones de capas). Todo queda en **DECISIONS.md**: formato ADR liviano (contexto, decisión, alternativas descartadas, cómo se revierte), índice con estados (Aceptada / Default→spike / Abierta), numeración secuencial que nunca se recicla, jerarquía de precedencia en el encabezado.

### Fase 4 — CLAUDE.md (por repo) + plantillas
- **CLAUDE.md:** contexto del proyecto en 3 líneas, stack cerrado, estructura, reglas duras innegociables (las de datos primero: dinero jamás float, PII, idempotencia — las que aplican a tu dominio), comandos reales, prohibiciones explícitas ("qué NO hacer aunque parezca buena idea"), y método LLM (spec-driven, PRs chicos con tests, checks antes de proponer).
- **specs/TEMPLATE.md:** plantilla ≤2 págs (propósito, alcance/NO-alcance, interfaz, invariantes, casos borde que definen los tests, preguntas abiertas) + índice-registro: número bajo demanda, fila agregada en el mismo PR que crea la spec.
- **COMMITS.md:** conventional commits con tipos y scopes CERRADOS, tabla de autonomía LLM verde/amarillo/rojo, versionado según qué es el artefacto (CalVer para servicios desplegados; enteros para contratos on-chain; nada para IaC). SemVer solo si publicás una librería con consumidores externos.
- **runbooks/TEMPLATE.md:** solo si el proyecto se opera en producción ("un runbook que no se ensayó es una hipótesis").

### Fase 5 — Estructura de repos y hogar documental
Decidir mono vs multi-repo por **ciclo de vida del código** (los contratos se congelan y auditan → repo aparte; si todo vive y muere junto → un repo). Definir el hogar documental único (en multi-repo: el repo que todos abren a diario; los demás linkean vía layout de hermanos + guard para LLMs: "si ../X/docs no existe, avisar y no continuar"). La raíz compartida no lleva archivos. El material fuente oficial (whitepaper, entregables aprobados) entra **congelado y de solo lectura** en `docs/`; lo que alimenta las specs se re-deriva hacia `specs/`, nunca se edita en origen. *(En este repo: `docs/` = entregables Catalyst, inmutable por D-022.)*

### Fase 6 — Bootstrap (el orden importa)
1. `.gitignore` correcto por stack (los secretos bloqueados ANTES del primer add).
2. `mkdir -p` de toda la estructura + `.gitkeep` en carpetas vacías.
3. `git init -b main` + identidad (config local por repo si difiere).
4. **Primer commit = la documentación** (CLAUDE.md, docs/, plantillas). Nunca código primero.
5. Scaffold de framework/toolchain. Auditar lo que trae: dependencias que no pediste se van (regla: toda dependencia se justifica), configs de lint con listas de archivos cerradas se abren a "todo menos generado", build-approvals de package manager al lugar vigente, versiones pineadas (`packageManager`, pragma/solc, lockfiles committeados).
6. **CI en el segundo commit** (lint+typecheck+tests, por barato que sea). Toolchain verificada con un smoke test real (que compile/importe la dependencia gorda, no un hello world vacío).
7. Remotos + protección de rama ("requiere checks en verde") apenas existan.

### Fase 7 — Ejecución y mantenimiento del sistema
- Sprint 1 = walking skeleton; specs se escriben un sprint antes de su código.
- Agentes en paralelo: uno por repo/frente, cada uno confinado al suyo (jamás "ayuda" editando el otro); las decisiones cruzadas las arbitra el humano; los merges los secuencia el humano. Dos agentes por revisor es el punto dulce.
- Cada sorpresa va a una **sección de gotchas viva** el mismo día.
- **Pase de coherencia** periódico (grep de términos superados en todos los docs) y al final de cada tanda grande de decisiones.
- Toda demo es primero un script E2E; staging/entorno demo siempre presentable.

---

## Guía de escalado: proyecto chico (PoC, un repo, 1-2 personas)

| Pieza | Proyecto grande | PoC de un repo |
|---|---|---|
| Fases | Las 7 | Las 7 — versión mínima de cada una |
| Feedback al doc fuente | Sesión completa | 30 min; salida: 5 riesgos + el mandato en una frase |
| Roadmap | Sprints × frentes | 1 página: "listo" binario + 3-4 hitos + tabla de decisiones con defaults |
| DECISIONS.md | 20+ entradas ADR | Mismo formato, quizás 6-10 entradas. **Nunca se omite** — es el documento de mayor valor por línea |
| CLAUDE.md | Uno por repo | Uno solo. Tampoco se omite: es lo que hace útil a cada sesión LLM |
| Specs | Registro + template | Template + 2-3 specs (la del smart contract y la del flujo crítico); mismo registro |
| COMMITS.md | Doc propio | Una sección dentro de CLAUDE.md (tipos, scopes, tabla de autonomía) |
| Runbooks | 12 ensayados | Omitir hasta que exista producción; entonces: deploy, rollback, incidente |
| Hogar documental | Multi-repo + links | Trivial: `docs/` del único repo |
| Extracto del whitepaper | 2 págs desde 50 | Si el whitepaper ya es ≤5 págs, el snapshot alcanza sin extracto |
| Walking skeleton | 7-10 días, 2 agentes | 1-3 días: subir doc → hash → tx en testnet → verificar on-chain. Sigue siendo la primera demo |
| Puertos/adaptadores | 8 puertos, doble modo | Al menos 1: la blockchain (nodo/API real vs. simulado) — es tu dependencia lenta e incierta |

**Anti-patrón a evitar al escalar hacia abajo:** recortar DECISIONS o CLAUDE.md "porque es un PoC". Los PoC exitosos se convierten en productos, y ese es exactamente el momento en que agradecés tener el registro. Lo que se recorta es *volumen* (menos entradas, menos specs), nunca *categorías*.

## Checklist del día 1 (imprimible)

☐ Feedback honesto al doc fuente → mandato + restricciones en claro
☐ Roadmap de 1-N páginas con "listo" binario y decisiones-con-default
☐ Sesión de cierre de decisiones → DECISIONS.md con jerarquía de precedencia
☐ CLAUDE.md con reglas duras, prohibiciones y método LLM
☐ Template de specs + las 1-3 primeras identificadas con dueño
☐ Estructura de carpetas + .gitignore + git init + identidad
☐ Commit 1: docs · Commit 2: scaffold auditado · Commit 3: CI
☐ Material fuente oficial congelado en docs/ (solo lectura)
☐ Primer objetivo declarado: el walking skeleton, como script
