import { fileURLToPath, URL } from 'node:url'

import { createVitestConfig } from '@doscientos/configs/vitest'
import { defineConfig, loadEnv } from 'vitest/config'

Object.assign(process.env, loadEnv('test', process.cwd(), ''))

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: createVitestConfig({
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: { include: ['src/features/**/{domain,application}/**/*.ts', 'src/shared/**/*.ts'] },
  }),
})
