<template>
  <div :class="isMatch ? 'match-shell' : 'app-shell'">
    <UHeader v-model:open="menuOpen" title="DartsCounter" to="/" :ui="{ root: 'border-b border-default bg-default', title: 'items-center text-base font-bold tracking-tight', toggle: 'md:hidden', content: 'md:hidden', overlay: 'md:hidden' }">
      <template #title>
        <img src="/logo.svg" alt="" width="32" height="32" class="size-8 shrink-0">
        DartsCounter
      </template>
      <template #right>
        <nav v-if="session?.user" aria-label="Main navigation" class="hidden items-center gap-1 md:flex">
          <UButton v-for="item in navItems" :key="item.to" :to="item.to" :icon="item.icon" :color="active(item.to) ? 'primary' : 'neutral'" :variant="active(item.to) ? 'soft' : 'ghost'" :aria-current="active(item.to) ? 'page' : undefined">{{ item.label }}</UButton>
        </nav>
        <USeparator orientation="vertical" class="mx-2 hidden h-6 md:block" />
        <UButton v-if="session?.user" color="neutral" variant="ghost" @click="signOut">Sign out</UButton>
        <UButton v-else to="/signin" color="neutral" variant="ghost">Sign in</UButton>
      </template>
      <template #body>
        <nav aria-label="Mobile navigation" class="grid gap-2">
          <UButton v-for="item in session?.user ? navItems : [{ label: 'Welcome', to: '/', icon: 'i-lucide-house' }, { label: 'Create account', to: '/signup', icon: 'i-lucide-user-plus' }]" :key="item.to" :to="item.to" :icon="item.icon" :variant="active(item.to) ? 'soft' : 'ghost'" color="neutral" class="min-h-11" @click="menuOpen = false">{{ item.label }}</UButton>
        </nav>
      </template>
    </UHeader>
    <UMain :class="isMatch ? 'pb-8 pt-5 sm:pt-8' : 'py-6 sm:py-10'">
      <UContainer><slot /></UContainer>
    </UMain>
  </div>
</template>

<script setup lang="ts">
import { useAccountStore } from '~/stores/account'
const route = useRoute()
const auth = useAuth()
const session = useNuxtApp().$authSession
const menuOpen = ref(false)
const isMatch = computed(() => /^\/match\/(?!new$)[^/]+$/.test(route.path))
const navItems = [
  { label: 'Play', to: '/', icon: 'i-lucide-play' },
  { label: 'Players', to: '/players', icon: 'i-lucide-users' },
  { label: 'History', to: '/history', icon: 'i-lucide-history' },
  { label: 'Settings', to: '/settings', icon: 'i-lucide-settings' }
]
function active(path: string) { return path === '/' ? route.path === '/' || route.path.startsWith('/match/') || route.path.startsWith('/room/') : route.path === path }
async function signOut() {
  const result = await auth.signOut()
  if (!result.error) { useAccountStore().clear(); await navigateTo('/signin') }
}
</script>
