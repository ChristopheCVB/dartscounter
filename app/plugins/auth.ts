import { createAuthClient } from 'better-auth/vue'

export default defineNuxtPlugin(() => ({
  provide: { auth: createAuthClient({ baseURL: useRequestURL().origin }) }
}))
