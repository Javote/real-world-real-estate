import { createRootRoute, Outlet } from '@tanstack/react-router'

// La raíz solo compone. Los providers viven en `main.tsx` y el documento en
// `index.html`: sin SSR no hay shell que renderizar desde el servidor (D-065).
export const Route = createRootRoute({ component: () => <Outlet /> })
