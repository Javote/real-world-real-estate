# contracts/reference — Material de diseño Fase B (NO es código activo)

Validadores de referencia de la guía de implementación (D-008, D-017): el patrón
state-thread con thread token (`milestone_state.ak`), el commit de certificación
(`certification.ak`) y la lib pura (`lib/plataforma/milestone.ak`).

- **No compilan necesariamente** contra la versión de Aiken pineada del proyecto
  (están fuera del árbol que ve `aiken check`).
- **No se despliegan.** El validador V1 vigente es `../validators/milestone.ak`
  (ver D-008 y D-020).
- Cuando la Fase B entre en sprint (ROADMAP Sprint 5), estos archivos se
  promueven a `validators/`/`lib/` en un PR propio, con tests, y esta carpeta
  se elimina.
