# SPEC-220 — El perfil del desarrollador

> Nace de una auditoría del 2026-09-21: cruzar el **catálogo de capturas** (M2-D2) contra las rutas
> implementadas, en vez del backlog (M2-D5) contra las rutas. De las 63 capturas, 61 estaban
> construidas y 2 no — `59-DEVELOPER-REPUTATION-A.png` y `60-DEVELOPER-REPUTATION-B.png`.

## Propósito

Construir la única superficie que `docs/` diseña y el backlog de M3 nunca recogió: el perfil de la
organización desarrolladora, enlazado desde el detalle de obra
(`M2-D1-Information-architecture-and-navigation-map.md:109`).

**Por qué la métrica no lo veía.** `pnpm testids` mide cobertura de los test IDs que declara
`UI-implementation-plan.md` (M2-D5). Las capturas 59-60 no tienen fila ahí, así que no tienen test
IDs, así que la cobertura podía dar 100% con la pantalla sin construir. La métrica no estaba mal —
medía lo que dice medir— pero su denominador no es el catálogo de lo diseñado.

## Alcance / NO-alcance

- **Cubre:** la entidad `Organization`; el endpoint `GET /projects/:id/developer`; la pantalla
  `/project/:projectId/developer`; el link desde el detalle de obra; el seed de la demo.
- **NO cubre — el rating (D-094).** La captura muestra "4.8 / 5.0 · 127 investors" junto al nombre.
  No se construye ni el campo ni el mecanismo: un rating es una afirmación sobre la calidad de un
  tercero y D-026 limita lo que la plataforma sostiene a cuatro afirmaciones sobre documentos y
  atestaciones. El argumento completo está en D-094.
- **NO cubre:** logo o imagen de la organización (la captura usa un ícono genérico), ni imágenes de
  portada de las obras — `Project` no tiene `imageUrl` y `ProjectCard` ya dibuja la ausencia como
  superficie neutra.
- **NO cubre:** un directorio público de desarrolladores. Se entra desde una obra de la que ya se
  es miembro.

## Interfaz

### Esquema — migración `0010_organization.sql`

| Tabla / columna | Tipo | Nota |
|---|---|---|
| `Organization.id` | `text` PK | |
| `Organization.name` | `text` | "Grupo Alpine" |
| `Organization.slug` | `text` UNIQUE | |
| `Organization.bio` | `text?` | El párrafo con "see more" de la captura |
| `Organization.foundedYear` | `integer?` | Los "20+ years" se derivan contra el año actual |
| `Project.organizationId` | `text?` FK | **Anulable**: los 7 proyectos anteriores no tienen |

Aditiva y sin backfill. `projectSchema` suma `organizationId` porque es `strictObject`: una columna
nueva en `Project` es, por construcción, un campo nuevo en ese contrato.

### `GET /api/v1/projects/:id/developer`

`authorize({ roles: CUALQUIER_ROL, acceso: { proyecto: { param: "id" }, membresias: ANY_MEMBERSHIP } })`.

```
{ organization: { id, name, slug, bio, foundedYear } | null,
  stats: { projectsDelivered, unitsSold, investors, yearsInBusiness },
  previousProjects: [...], activeProjects: [...] }
```

**Cuelga de `/projects/:id` y no de `/developer/:orgId`** por tres razones, y la tercera decide:
M2-D1 la describe como *"linked from project"*; `/developer/*` ya es el área autenticada del
developer; y la autorización **ya está resuelta** — no hay que inventar una regla de permisos nueva
para una entidad nueva.

## Invariantes

1. **Todas las estadísticas se derivan; ninguna se guarda.** Obras entregadas, unidades vendidas,
   compradores y los dos listados salen de `Project` y `Unit` en cada lectura.
2. **`yearsInBusiness` es `null` y no `0` cuando no hay `foundedYear`.** "Cero años en el rubro" es
   una afirmación; "no lo declaró" no lo es.
3. **No existe `rating` en ninguna capa** — ni columna, ni campo del schema, ni elemento de UI.
4. **Un proyecto sin organización da 404**, y el front no dibuja el link. Una pantalla de perfil
   vacía dice menos que no ofrecerla.
5. **El "desde" de una obra con dos monedas es `null`.** Heredada de `agregadosDeProyectos`: comparar
   unidades mínimas de monedas distintas da un número sin significado (regla 17).

## Casos borde (definen los tests)

`apps/api/test/developer-profile.test.ts`:

| Caso | Esperado |
|---|---|
| Dos unidades vendidas al mismo comprador | `unitsSold: 2`, `investors: 1` |
| Obra `completed` + obra `in_progress` | una en `previousProjects`, una en `activeProjects` |
| Unidades de 60 y 150 m², de 30.000 y 45.000 USD | `sizeMin 60`, `sizeMax 150`, `priceFrom 30.000.000` |
| Respuesta completa | **sin** `rating` en `organization` ni en `stats` |
| Proyecto sin `organizationId` | 404 |
| Usuario sin membresía | 403 |
| Sin sesión | 401 |

## Los test IDs son nuestros, y eso necesitó tocar el verificador

M2-D5 no declara ninguno para esta superficie, así que `INV-DEVELOPER-PROFILE-001`,
`-PREVIOUS-002`, `-ACTIVE-003` y `-LINK-004` los pusimos nosotros. `scripts/check-testids.mjs`
fallaba ante ellos —un ID que el entregable no declara es, casi siempre, un typo— y ahora tiene una
tercera categoría, `FUERA_DEL_BACKLOG`, con la captura de origen al lado de cada uno.

**No entran al denominador de la cobertura**: la vara del ≥95% que fija M2-D5 §8 mide el backlog
contra sí mismo, y sumarle IDs que el backlog no pidió la volvería incomparable. Y un ID declarado
ahí que nadie reclama también falla, para que la lista describa lo construido y no una lista de
deseos.

## Preguntas abiertas

- **La organización no tiene pantalla de edición.** `Organization` se puebla por seed o por SQL. La
  superficie que correspondería —el developer editando su propio perfil— tampoco está en M2-D5.
- **Un proyecto, una organización.** No hay obras entre dos desarrolladores. Ningún entregable las
  menciona; el día que aparezcan, es una tabla de unión, no una columna.
