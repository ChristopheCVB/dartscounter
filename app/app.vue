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

const auth = useAuth()
const session = auth.useSession()
const account = useAccountStore()
watch(() => session.value.data?.user.id, id => {
  if (id) void account.load()
  else account.clear()
}, { immediate: true })
</script>
