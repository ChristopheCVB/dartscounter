// https://nuxt.com/docs/api/configuration/nuxt-config
const description = 'Play 301, 501, Cricket, and Around the Clock with friends. Track scores, share a game room, and follow your darts statistics.'

export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@pinia/nuxt', '@vueuse/nuxt', '@nuxt/eslint', '@nuxt/test-utils/module', '@nuxtjs/turnstile', 'nuxt-email-renderer'],
  nuxtEmailRenderer: { devtools: true, codeHighlighting: false },
  runtimeConfig: {
    resend: { apiKey: '', from: '' },
    public: { turnstile: { siteKey: '' } }
  },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'DartsCounter',
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'description', content: description },
        { property: 'og:site_name', content: 'DartsCounter' },
        { property: 'og:type', content: 'website' },
        { property: 'og:description', content: description },
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:description', content: description },
        { name: 'robots', content: 'noindex, nofollow' },
      ],
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
        { rel: 'icon', href: '/logo.svg', sizes: 'any', type: 'image/svg+xml' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon-180x180.png' },
      ],
    },
  },
  pinia: {
    storesDirs: ['app/stores/**']
  },
  colorMode: { preference: 'dark', fallback: 'dark' },
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  nitro: {
    preset: 'bun',
    typescript: { tsConfig: { include: ['../tests/integration/**/*.ts', '../tests/e2e/fixtures/**/*.ts'] } }
  },
  typescript: {
    appTsConfig: {
      include: ['../tests/unit/**/*.ts']
    },
    nodeTsConfig: {
      include: ['../tests/e2e/**/*.test.ts', '../tests/helpers/**/*.ts', '../*.ts', '../scripts/**/*'],
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
