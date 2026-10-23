<template>
  <NuxtRouteAnnouncer />
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
import { useAccountStore } from '~/stores/account'

const route = useRoute()
const title = computed(() => route.meta.title ? `${route.meta.title} - DartsCounter` : 'DartsCounter')
useSeoMeta({
  title,
  description: () => route.meta.description,
  ogTitle: title,
  ogDescription: () => route.meta.description,
  twitterTitle: title,
  twitterDescription: () => route.meta.description,
  robots: () => route.path === '/' ? 'index, follow' : 'noindex, nofollow'
})

const session = useNuxtApp().$authSession
const account = useAccountStore()
watch(() => session.value?.user.id, id => {
  if (!id) account.clear()
  else if (import.meta.client && (!account.loaded || account.userId !== id)) void account.load()
}, { immediate: true })
if (import.meta.server && session.value?.user) await account.load()
</script>
