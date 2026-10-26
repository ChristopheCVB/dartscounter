export default defineNuxtRouteMiddleware(async to => {
  if (['/', '/signin', '/signup', '/forgot-password', '/reset-password', '/verify-email'].includes(to.path)) return
  const session = await useRequestFetch()<{ user: { emailVerified: boolean } } | null>('/api/auth/get-session').catch(() => null)
  if (!session?.user.emailVerified) return navigateTo({ path: '/signin', query: { next: to.fullPath } })
})
