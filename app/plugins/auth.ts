import { createAuthClient } from 'better-auth/vue'

export default defineNuxtPlugin(async () => {
  const auth = createAuthClient({ baseURL: useRequestURL().origin })
  // Forward SSR cookies and hydrate before subscribing to live session updates.
  const { data: initialSession } = await useFetch<typeof auth.$Infer.Session | null>('/api/auth/get-session', { key: 'auth-session' })
  auth.hydrateSession(initialSession.value ?? null)
  const liveSession = import.meta.client ? auth.useSession() : null
  const authSession = liveSession ? computed(() => liveSession.value.data) : initialSession
  return { provide: { auth, authSession } }
})
