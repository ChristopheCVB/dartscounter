<template>
  <NuxtRouteAnnouncer />
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
import { useHistoryStore } from '~/stores/history'
import { useMatchStore } from '~/stores/match'
import { usePlayersStore } from '~/stores/players'
import { useSettingsStore } from '~/stores/settings'

const settingsStore = useSettingsStore()
const historyStore = useHistoryStore()
const matchStore = useMatchStore()
const playersStore = usePlayersStore()

onMounted(() => {
  settingsStore.load()
  historyStore.load()
  matchStore.loadActiveMatch()
  playersStore.load()
})
</script>
