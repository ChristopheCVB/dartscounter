// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@pinia/nuxt', '@vueuse/nuxt', '@nuxt/eslint', '@nuxt/test-utils/module'],
  css: ['~/assets/css/main.css'],
  pinia: {
    storesDirs: ['app/stores/**']
  },
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  nitro: { preset: 'bun' },
  typescript: {
    appTsConfig: {
      include: ['../tests/unit/**/*.ts']
    },
    nodeTsConfig: {
      include: ['../tests/e2e/**/*.ts', '../*.ts', '../scripts/**/*'],
      compilerOptions: {
        checkJs: true
      }
    }
  },
  vite: {
    optimizeDeps: {
      include: [
        '@vue/devtools-core',
        '@vue/devtools-kit',
        'canvas-confetti',
        'zod',
      ]
    }
  }
})
