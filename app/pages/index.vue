<template>
  <section v-if="session?.user" class="page-stack">
    <header class="page-heading"><h1>Let’s play</h1><p>Create or join a room. Share one screen or play from your own devices.</p></header>
    <UAlert v-if="error || account.error" color="error" :title="error || account.error" />
    <section v-if="account.currentRoom" class="form-section rounded-xl border border-primary/40 bg-primary/5 p-5">
      <div class="section-heading"><h2>Current room</h2><p>{{ roomStatus }} · Invite code <span class="font-mono font-semibold tracking-widest">{{ account.currentRoom.code }}</span></p></div>
      <ul class="grid gap-2 text-sm">
        <li v-for="member in account.currentRoom.members" :key="member.userId" class="flex flex-wrap justify-between gap-2">
          <span class="min-w-0 flex-1 break-words">{{ member.name }}{{ member.userId === account.currentRoom.ownerId ? ' · owner' : '' }} · {{ member.roster.map(player => player.name).join(', ') || 'Watching' }}</span>
          <RoomPresence :member="member" />
        </li>
      </ul>
      <MatchRulesSummary :settings="account.currentRoom.settings" embedded />
      <p class="text-sm text-muted">Return to the lobby or match within five minutes to stay in the room. Finished results stay in History after everyone leaves.</p>
      <div class="flex flex-wrap gap-3">
        <UButton :to="`/room/${account.currentRoom.id}`" :variant="resumeMatchId ? 'soft' : 'solid'">Return to room</UButton>
        <UButton v-if="resumeMatchId" :to="`/match/${resumeMatchId}`" icon="i-lucide-play">Open match</UButton>
        <RoomLeaveButton :room="account.currentRoom" />
      </div>
    </section>
    <div class="grid gap-8 lg:grid-cols-2 lg:gap-12">
      <section class="form-section">
        <div class="section-heading"><h2>Create a room</h2><p>Choose players and rules in the lobby. Guests sharing your screen don’t need an account.</p></div>
        <div><UButton icon="i-lucide-plus" :loading="pending" :disabled="!!account.currentRoom" @click="create">Create room</UButton></div>
      </section>
      <section class="form-section border-t border-default pt-8 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-12">
        <div class="section-heading"><h2>Join a room</h2><p>Enter an invite code to play with friends or watch their match.</p></div>
        <form class="flex items-end gap-3" @submit.prevent="join">
          <UFormField label="Room code" class="min-w-0 flex-1"><UInput v-model="code" class="w-full" maxlength="8" minlength="8" placeholder="ABCDEFGH" autocomplete="off" autocapitalize="characters" required /></UFormField>
          <UButton type="submit" color="neutral" variant="outline" :loading="pending" :disabled="!!account.currentRoom">Join room</UButton>
        </form>
      </section>
    </div>
    <p class="text-sm text-muted">{{ account.currentRoom ? 'Leave your current room before creating or joining another.' : 'Rooms last while you play together. Choose your players and rules, mark Ready, then the owner starts the match.' }}</p>
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

definePageMeta({
  title: 'Play',
  description: 'Play 301, 501, and Around the Clock with friends. Track scores, share a game room, and follow your darts statistics.'
})

const session = useNuxtApp().$authSession
const account = useAccountStore()
const matchStore = useMatchStore()
const code = ref('')
const error = ref('')
const pending = ref(false)
const resumeMatchId = computed(() => account.currentRoom?.match?.status === 'in_progress' ? account.currentRoom.match.id : '')
const roomStatus = computed(() => account.currentRoom?.match?.status === 'in_progress' ? 'Playing' : 'Between matches')
onMounted(() => { if (session.value?.user) void account.load() })
useIntervalFn(() => { if (session.value?.user && account.currentRoom && !pending.value && !matchStore.pending) void account.load() }, 5_000)
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
