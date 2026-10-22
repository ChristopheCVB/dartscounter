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

const session = useNuxtApp().$authSession
const account = useAccountStore()
watch(() => session.value?.user.id, id => {
  if (!id) account.clear()
  else if (import.meta.client && (!account.loaded || account.userId !== id)) void account.load()
}, { immediate: true })
if (import.meta.server && session.value?.user) await account.load()
</script>
