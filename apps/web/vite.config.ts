import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

// La API (packages/api) corre en :8787 en el árbol principal — ver CLAUDE.md §Comandos.
// El proxy va por routeRules de nitro (server.proxy de Vite no aplica:
// nitro atiende las requests antes que el middleware de Vite).
// Puerto y origen salen de ports.ts para que cada worktree tenga los suyos (D-031).
import { API_ORIGIN, WEB_PORT } from './ports.ts'

const config = defineConfig({
  server: { port: WEB_PORT },
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    nitro({
      rollupConfig: { external: [/^@sentry\//] },
      routeRules: {
        '/api/**': { proxy: { to: `${API_ORIGIN}/api/**`, fetchOptions: { credentials: 'omit' } } },
        '/health': { proxy: { to: `${API_ORIGIN}/health`, fetchOptions: { credentials: 'omit' } } },
      },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
