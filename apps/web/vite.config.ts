import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

// La API (packages/api) corre en :8787 — ver CLAUDE.md §Comandos.
// El proxy va por routeRules de nitro (server.proxy de Vite no aplica:
// nitro atiende las requests antes que el middleware de Vite).
const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:8787'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    nitro({
      rollupConfig: { external: [/^@sentry\//] },
      routeRules: {
        '/api/**': { proxy: `${API_ORIGIN}/api/**` },
        '/health': { proxy: `${API_ORIGIN}/health` },
      },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
