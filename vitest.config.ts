import { defineVitestProject } from '@nuxt/test-utils/config'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  server: { watch: { ignored: ['**/.nuxt/test/**'] } },
  test: {
    pool: 'threads',
    ...(process.env.CI ? { maxWorkers: 1 } : {}),
    projects: [
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          testTimeout: 30_000,
          sequence: { groupOrder: 2 },
        },
      },
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
          sequence: { groupOrder: 0 },
        },
      },
      await defineVitestProject({
        test: {
          name: 'nuxt',
          pool: 'threads',
          include: ['tests/nuxt/**/*.test.ts'],
          environment: 'nuxt',
          hookTimeout: 90_000,
          testTimeout: 30_000,
          sequence: { groupOrder: 1 },
        },
      }),
      {
        test: {
          name: 'e2e',
          include: ['tests/e2e/**/*.test.ts'],
          environment: 'node',
          sequence: { groupOrder: 3 },
        },
      },
    ],
  },
})
