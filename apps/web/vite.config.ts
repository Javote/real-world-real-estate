import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

import { API_ORIGIN, WEB_PORT } from './ports.ts'
import { completarServiceWorker } from './src/lib/swPrecache.ts'

// `public/sw.js` se copia tal cual a `dist/`; recién acá se sabe qué hay en `assets/` (SPEC-222).
const precacheDelServiceWorker: Plugin = {
  name: 'precache-del-service-worker',
  apply: 'build',
  writeBundle(opciones, bundle) {
    const sw = join(opciones.dir ?? 'dist', 'sw.js')
    writeFileSync(sw, completarServiceWorker(readFileSync(sw, 'utf8'), Object.keys(bundle)))
  }
}

export default defineConfig({
  server: {
    port: WEB_PORT,
    proxy: {
      '/api': { target: API_ORIGIN, changeOrigin: true },
      '/health': { target: API_ORIGIN, changeOrigin: true }
    }
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    tailwindcss(),
    viteReact(),
    precacheDelServiceWorker
  ],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules\/(react|react-dom|scheduler)\// },
            { name: 'vendor-tanstack', test: /node_modules\/@tanstack\// },
            { name: 'vendor-observability', test: /node_modules\/(@sentry|posthog-js)\// },
            { name: 'vendor-radix', test: /node_modules\/radix-ui\// }
          ]
        }
      }
    }
  }
})
