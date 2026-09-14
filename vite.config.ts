import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // Vite solo expone VITE_* al bundle; el servidor de Start lee process.env,
  // así que el .env local también debe llegar allí.
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)

  // Las credenciales de pruebas tienen un prefijo que evita utilizarlas por
  // accidente fuera de este modo. La aplicación conserva sus nombres de
  // ejecución habituales tanto en navegador como en servidor.
  const testSupabaseEnvironment =
    mode === 'test'
      ? {
          SUPABASE_PUBLISHABLE_KEY: env.SUPABASE_TEST_PUBLISHABLE_KEY,
          SUPABASE_SECRET_KEY: env.SUPABASE_TEST_SECRET_KEY,
          SUPABASE_URL: env.SUPABASE_TEST_URL,
          VITE_SUPABASE_PUBLISHABLE_KEY: env.SUPABASE_TEST_PUBLISHABLE_KEY,
          VITE_SUPABASE_URL: env.SUPABASE_TEST_URL,
        }
      : {}
  for (const [name, value] of Object.entries(testSupabaseEnvironment)) {
    if (value) process.env[name] = value
  }

  // Identifica el despliegue para que el service worker use una caché nueva por
  // build y las pestañas abiertas no se queden con el bundle anterior.
  const buildId = process.env.VERCEL_GIT_COMMIT_SHA ?? Date.now().toString(36)

  return {
    define: {
      'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId),
      ...(mode === 'test'
        ? {
            'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(
              env.SUPABASE_TEST_PUBLISHABLE_KEY ?? '',
            ),
            'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.SUPABASE_TEST_URL ?? ''),
          }
        : {}),
    },
    plugins: [tailwindcss(), tanstackStart(), react(), nitro({ preset: 'vercel' })],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      rollupOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: 'vendor-react', test: /node_modules.*react(?:-dom)?/ },
              { name: 'vendor-ui', test: /node_modules.*@doscientos(?:\+|[/\\])ui/ },
              { name: 'vendor-icons', test: /node_modules.*lucide-react/ },
              { name: 'vendor-supabase', test: /node_modules.*@supabase(?:\+|[/\\])/ },
            ],
          },
        },
      },
    },
    server: {
      port: 3000,
    },
  }
})
