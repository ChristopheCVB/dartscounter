<template>
  <section v-if="session?.user" class="page-stack">
    <header class="page-heading"><h1>Let’s play</h1><p>A quick game on one device or a room with friends.</p></header>
    <UAlert v-if="error || account.error" color="error" :title="error || account.error" />
    <div v-if="resumeMatchId" class="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/40 bg-primary/5 p-5">
      <div><h2 class="font-semibold">Your match is waiting</h2><p class="mt-1 text-sm text-muted">Continue your game in room {{ account.activeRoom?.code }}.</p></div>
      <UButton :to="`/match/${resumeMatchId}`" icon="i-lucide-play">Resume match</UButton>
    </div>
    <div class="grid gap-8 lg:grid-cols-2 lg:gap-12">
      <section class="form-section">
        <div class="section-heading"><h2>Play on this device</h2><p>Pass the screen between players. Only you need an account.</p></div>
        <div><UButton to="/match/new" icon="i-lucide-plus" :disabled="pending">New match</UButton></div>
      </section>
      <section class="form-section border-t border-default pt-8 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-12">
        <div class="section-heading"><h2>Play with friends</h2><p>Share a room and score from your own devices.</p></div>
        <div><UButton color="neutral" variant="soft" :loading="pending" @click="create">Create room</UButton></div>
        <form class="flex items-end gap-3" @submit.prevent="join">
          <UFormField label="Room code" class="min-w-0 flex-1"><UInput v-model="code" class="w-full" maxlength="8" minlength="8" placeholder="ABCDEFGH" autocomplete="off" autocapitalize="characters" required /></UFormField>
          <UButton type="submit" color="neutral" variant="outline" :loading="pending">Join room</UButton>
        </form>
      </section>
    </div>
    <section class="form-section border-t border-default pt-8">
      <div class="section-heading"><h2>Your rooms</h2><p>Return to a room to play another match.</p></div>
      <div v-if="account.rooms.length" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="item in account.rooms" :key="item.id" class="grid min-w-0 gap-3 rounded-xl border p-4" :class="item.id === account.activeRoom?.id ? 'border-primary/40' : 'border-default'">
          <NuxtLink :to="`/room/${item.id}`" class="flex min-h-11 flex-wrap items-center justify-between gap-2 hover:text-primary">
            <span class="font-mono font-semibold tracking-widest">{{ item.code }}</span>
            <UBadge :color="item.matchStatus === 'in_progress' ? 'success' : 'neutral'" variant="soft">{{ item.matchStatus === 'in_progress' ? 'Playing' : item.matchStatus === 'finished' ? 'Finished' : item.matchStatus === 'abandoned' ? 'Abandoned' : 'Lobby' }}</UBadge>
          </NuxtLink>
          <p v-if="item.id === account.activeRoom?.id" class="text-sm text-muted">Your active match</p>
          <UButton v-if="item.matchStatus === 'in_progress' && item.matchId" :to="`/match/${item.matchId}`" color="neutral" variant="soft" icon="i-lucide-play">Open match</UButton>
        </div>
      </div>
      <p v-else class="text-sm text-muted">No rooms yet. Create one or join with a friend’s code.</p>
    </section>
  </section>
  <section v-else class="mx-auto grid max-w-2xl gap-6 py-8 sm:py-16">
    <img src="/logo.svg" alt="" class="size-14" width="56" height="56">
    <header class="page-heading"><h1>Your next game starts here.</h1><p class="text-lg leading-relaxed">Score X01 or Around the Clock with friends. Share one screen or play together from your own devices.</p></header>
    <div class="flex flex-wrap gap-3"><UButton to="/signin" icon="i-lucide-arrow-right" trailing>Sign in</UButton><UButton to="/signup" color="neutral" variant="soft">Create account</UButton></div>
    <p class="text-sm text-muted">Your account keeps your players, match history, and statistics together.</p>
  </section>
</template>

<script setup lang="ts">
import { useAccountStore } from '~/stores/account'
import { useMatchStore } from '~/stores/match'
import type { RoomView } from '~~/shared/types/rooms'
import { apiError } from '~/utils/apiError'
const session = useNuxtApp().$authSession
const account = useAccountStore()
const matchStore = useMatchStore()
const code = ref('')
const error = ref('')
const pending = ref(false)
const resumeMatchId = computed(() => account.activeRoom?.match?.id ?? '')
onMounted(() => { if (session.value?.user) void account.load() })
async function enter(path: '/api/rooms' | '/api/rooms/join', body: object) {
  if (pending.value) return
  pending.value = true
  error.value = ''
  try {
    const room = await $fetch<RoomView>(path, { method: 'POST', body })
    matchStore.acceptRoom(room)
    await account.load()
    await navigateTo(`/room/${room.id}`)
  } catch (cause) { error.value = apiError(cause) }
  finally { pending.value = false }
}
function create() { return enter('/api/rooms', {}) }
function join() { return enter('/api/rooms/join', { code: code.value.trim().toUpperCase() }) }
</script>
