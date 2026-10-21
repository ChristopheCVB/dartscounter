export default defineNuxtRouteMiddleware(async to => {
  if (['/', '/signin', '/signup', '/forgot-password', '/reset-password', '/verify-email'].includes(to.path)) return
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
  const session = await $fetch<{ user: { emailVerified: boolean } } | null>('/api/auth/get-session', { headers }).catch(() => null)
  if (!session?.user.emailVerified) return navigateTo({ path: '/signin', query: { next: to.fullPath } })
})
