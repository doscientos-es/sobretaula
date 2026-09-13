import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // Vite solo expone VITE_* al bundle; el servidor de Start lee process.env,
  // así que el .env local también debe llegar allí.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  // Identifica el despliegue para que el service worker use una caché nueva por
  // build y las pestañas abiertas no se queden con el bundle anterior.
  const buildId = process.env.VERCEL_GIT_COMMIT_SHA ?? Date.now().toString(36)

  return {
    define: { 'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId) },
    plugins: [tailwindcss(), tanstackStart(), react(), nitro({ preset: 'vercel' })],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 3000,
    },
  }
})
