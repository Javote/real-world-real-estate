# SPEC-114 — Lo que un lector de pantalla no puede nombrar ni ubicar

> **Origen:** [`SPEC-112`](SPEC-112-pasada-de-accesibilidad-con-voiceover.md) §2 y §3, las capas
> de `axe-core`: `pnpm --filter web test:a11y` sobre los 1596 tests de Vitest y
> `e2e/a11y.spec.ts` en el navegador real, las dos medidas el 2026-09-28. Nivel 🟢.
> **Independiente** de `SPEC-113`. No toca ningún criterio del SOM.
>
> Seis defectos chicos, todos de marca y ninguno de diseño. Van en una sola spec porque cada uno
> es de pocas líneas y se verifica con la misma herramienta: separarlos daría seis specs de diez
> renglones que se leen igual.

## Los seis

| # | Regla de axe | Impacto | Dónde | Qué pasa | Arreglo |
|---|---|---|---|---|---|
| 1 | `aria-progressbar-name` | serious | `components/domain/ProgressBar.tsx` — en cada `ProjectCard`, los listados del developer y del investor, la cola del notario (69 tests, 15 archivos; en el navegador, `/developer/projects`) | el `role="progressbar"` no tiene nombre: VoiceOver dice "barra de progreso, 40%" sin decir de qué | prop `label` **obligatoria** en `ProgressBar`, que pasa a `aria-label`. Cada llamador ya tiene el texto al lado (el nombre del proyecto o "Avance") |
| 2 | `button-name` | critical | `routes/project.$projectId.stage.$stageId.tsx:214` — miniaturas de fotos de la etapa | mientras la URL firmada no llegó, el botón solo contiene un ícono `aria-hidden`: botón sin nombre | `aria-label` en el botón con la misma clave que el `alt` de la imagen, independiente de si la imagen cargó |
| 3 | `button-name` | critical, **latente** | `components/domain/ProjectCard.tsx:206` — el favorito | `favoriteAriaLabel` es opcional y cae en `''`. Hoy los dos llamadores (`investor.buy`, `investor.favorites`) lo pasan, así que no se ve en ninguna pantalla | que `onToggleFavorite` y `favoriteAriaLabel` vayan juntos en el tipo: si hay favorito, el label es obligatorio. Se borra el `?? ''` y el test de `cards.test.tsx` que lo fija |
| 4 | `aria-valid-attr-value` | critical | `TextArea`, `NumberInput`, `SelectDropdown` y el monto de `developer.project.$projectId.invite.tsx` | `aria-errormessage` apunta a un `<p>` que no es live region ni está en `aria-describedby`. Axe lo marca, y VoiceOver en la práctica no lo lee al enfocar el campo | hacer lo que ya hace `TextInput` (`TextInput.tsx:62`): `aria-describedby` apuntando al `<p>` de error, en vez de `aria-errormessage`. `TextInput` no aparece en ninguna violación, así que el modelo ya está medido en este mismo repo |
| 5 | `heading-order` | moderate | `routes/developer.audit-log.tsx` | el header da `h1` y cada `AuditEventCard` es `h3`, sin `h2` en el medio: al navegar por encabezados parece que falta una sección | un `h2` (visible o `sr-only`) sobre la lista, con una clave existente del diccionario. **No** bajar la card a `h2`: se usa en otras pantallas debajo de un `h2` real |
| 6 | `landmark-one-main` + `region` | moderate | `routes/login.tsx` | no tiene `<main>` y todo su contenido queda fuera de landmarks: el rotor de VoiceOver no ofrece a dónde saltar | envolver el contenido en `<main>`, como hace `PanelLayout` en las pantallas autenticadas |

## Lo que la medición descartó

- **`landmark-unique`** (333 tests en Vitest): el `Sidebar` y el `BottomNav` comparten
  `aria-label` y jsdom los muestra juntos porque no aplica `hidden md:flex`. **En el navegador no
  aparece en ninguna de las 10 corridas** (mobile y desktop): nunca coexisten visibles. Es un
  artefacto de jsdom y `a11y/vitest-setup.ts` lo apaga con esa razón escrita.
- **`region`** en Vitest (179 tests): componentes montados sin `<main>` alrededor. Lo mismo: en el
  navegador solo aparece en `/login`, que es el ítem 6.

## Cómo se cierra

Por cada ítem arreglado se **borra su fila** en `apps/web/a11y/hallazgos.ts`, y
`pnpm --filter web test:a11y` y `pnpm --filter web e2e a11y` tienen que quedar en verde sin
ella. La fila borrada es la prueba de que el arreglo cubre lo que axe encontró. Si queda, deja de
proteger contra una regresión de lo que se acaba de arreglar.
