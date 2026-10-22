import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

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
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      // La pantalla y sus estados comparten el marco: en grupos distintos, el marco queda en el
      // archivo de la ruta, que es JS inicial.
      codeSplittingOptions: {
        defaultBehavior: [['component', 'pendingComponent', 'errorComponent', 'notFoundComponent']]
      }
    }),
    tailwindcss(),
    viteReact()
  ],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules\/(react|react-dom|scheduler)\// },
            { name: 'vendor-tanstack', test: /node_modules\/@tanstack\// },
            { name: 'vendor-sentry', test: /node_modules\/@sentry\// },
            { name: 'vendor-posthog', test: /node_modules\/posthog-js\// },
            { name: 'vendor-radix', test: /node_modules\/radix-ui\// }
          ]
        }
      }
    }
  }
})
