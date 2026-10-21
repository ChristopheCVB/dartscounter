import type { EmailProps } from '../../shared/types/email'

// Nuxt 4's server tsconfig does not include the module's generated hook declaration.
declare module 'nitropack/types' {
  interface NitroRuntimeHooks {
    'nuxt-email-renderer:devtools:resolveProps': (context: {
      templateName: string
      props: Record<string, unknown>
    }) => void
  }
}

export default defineNitroPlugin(nitro => {
  if (!import.meta.dev) return
  const fixtures = {
    'email-verification': { name: 'Alex', url: 'https://example.com/verify?token=preview&callbackURL=%2Frooms' },
    'password-reset': { name: 'Alex', url: 'https://example.com/reset-password?token=preview' }
  } satisfies EmailProps
  nitro.hooks.hook('nuxt-email-renderer:devtools:resolveProps', context => {
    const fixture = fixtures[context.templateName as keyof EmailProps]
    if (fixture) context.props = { ...fixture, ...context.props }
  })
})
