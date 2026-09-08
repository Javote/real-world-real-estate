import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// SPA, sin SSR (D-065). Se fue Nitro y con él el proxy por `routeRules`: ahora
// alcanza el proxy de Vite, que antes no aplicaba porque nitro atendía las
// requests antes que el middleware de Vite.
import { API_ORIGIN, WEB_PORT } from './ports.ts'

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
    viteReact()
  ],
  build: {
    rolldownOptions: {
      output: {
        // Separa vendors pesados del bundle de la app: cachean aparte y no
        // se re-descargan en cada deploy que solo cambia código propio.
        advancedChunks: {
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
