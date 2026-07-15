# specs/ — Registro

> Reglas: número bajo demanda; la fila se agrega **en el mismo PR** que crea la spec. Las specs se escriben un sprint antes de su código. Máx. 2 páginas ([TEMPLATE.md](TEMPLATE.md)). Precedencia: DECISIONS.md > CLAUDE.md > specs. La numeración nunca se recicla.
>
> **Nota de consolidación (2026-07-15):** SPEC-006 y SPEC-007 vienen del repo backend (donde eran SPEC-003 y SPEC-001); se renumeraron para no reciclar números de este registro. Describen código que ya existe y funciona en `packages/api`.

## Registro

| # | Spec | Estado | Dueño | Código en |
|---|---|---|---|---|
| SPEC-001 | [Anclaje de evidencia (hash → Merkle → AnchorPort → verificación)](SPEC-001-anclaje-evidencia.md) | Escrita | — asignar | Sprint 1 (script) y 2 (integración) |
| SPEC-002 | [Validador milestone FSM (Aiken) — V1 vigente](SPEC-002-validador-milestone-fsm.md) | Escrita (código existente en `contracts/`) | — asignar | Hecho (V1); Fase B en Sprints 3 y 5 |
| SPEC-003 | Dossier: compilación, export y share token público | Pendiente (escribir en Sprint 3) | — asignar | Sprint 4 |
| SPEC-004 | [Demo local: frontend (login, proyectos, evidencia)](SPEC-004-demo-frontend.md) | Escrita | — asignar | Sprint 1 |
| SPEC-005 | [API de la demo (adoptada: la API existente de `packages/api`)](SPEC-005-api-demo.md) | Escrita | — asignar | Hecho (D-016); costurón de anclaje en Sprint 2 |
| SPEC-006 | [Autenticación y permisos](SPEC-006-auth-y-permisos.md) | Vigente (código existente) | — asignar | Hecho |
| SPEC-007 | [Flujo de evidencia](SPEC-007-flujo-de-evidencia.md) | Vigente (código existente) | — asignar | Hecho |

## Mapa de dependencias y paralelización (Sprint 1, actualizado tras la consolidación)

Los frentes B (API demo) y parte del A (pantallas) ya existen por la consolidación (D-016 + port de la maqueta). Queda:

```
  FRENTE A                FRENTE C                  FRENTE UX/UI
  Completar front         Walking skeleton          Identidad visual
  (adaptador mock,        (SPEC-001: script         (shadcn/ui sobre las
  SPEC-004; hoy solo      anclaje, spike D-005;     pantallas ya portadas;
  existe el modo real)    no depende de A ni B)     no toca ApiPort)
       │                        │
       └───────────┬────────────┘
                   ▼
     INTEGRACIÓN (Sprint 2): anchorQueue real → AnchorPort:
     evidencia pending → anchored + txid. El front ya
     muestra el estado sin tocarlo.
```

**Reglas de paralelización:**
- Los frentes son independientes: cada persona (o agente, confinado a su frente) avanza sin pisar a los demás. Ningún frente edita archivos de otro.
- C (skeleton) es además el spike de D-005 y puede terminar primero.
- El frente de contratos (tests de SPEC-002, consolidación D-017) también corre en paralelo: no está conectado a nada todavía.
- SPEC-003 se escribe cuando su código está a un sprint de distancia — no antes (documentar contra realidad).
