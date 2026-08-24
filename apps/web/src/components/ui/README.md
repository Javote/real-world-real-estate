# components/ui — primitivos de shadcn/ui

**Acá NO viven los componentes de M2-D3.** Esos van en `components/domain/`, uno por ficha del
entregable, y son los que la app usa.

Acá van los primitivos accesibles que shadcn genera sobre Radix —`Dialog`, `Select`, `Switch`,
`Popover`— y que los componentes de dominio usan por dentro. La división importa: M2-D3 define
**qué es** un `ObserveStageModal`; Radix resuelve **cómo se comporta** un diálogo accesible (foco
atrapado, Escape, `aria-modal`). Reimplementar eso a mano es la forma más cara de introducir bugs
de accesibilidad, y M2-D3 §Accessibility pide WCAG 2.1 AA.

**Se agregan de a uno, cuando su componente de dominio los necesita:**

```bash
pnpm dlx shadcn@latest add dialog
```

`components.json` ya apunta a `src/styles.css` y a `cn()`, así que lo generado usa los tokens de
M2-D3 sin tocar nada. Instalar los 40 primitivos "por las dudas" es superficie que nadie revisó.
