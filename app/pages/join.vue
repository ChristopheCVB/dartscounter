<template>
  <section class="mx-auto grid max-w-xl gap-6 py-8">
    <header class="page-heading"><h1>Join a room</h1><p>Join your friends to play darts or watch their match.</p></header>
    <p v-if="pending" role="status">Joining the room…</p>
    <UAlert v-if="error" color="error" :title="error" />
    <section v-if="leavingRoom" class="form-section">
      <p>You’re already in another room. Leave it to join this invitation. You’ll join automatically once leaving succeeds.</p>
      <p class="text-sm text-muted">If the invitation expires or changes while you switch, you may leave your current room without joining the new one.</p>
      <RoomLeaveButton :room="leavingRoom" :navigate-on-leave="false" @left="join" />
      <UButton :to="`/room/${leavingRoom.id}`" color="neutral" variant="ghost">Return to current room</UButton>
      <p v-if="store.uncertain && store.uncertain.action.type !== 'leave'" role="status">Return to your current room to resolve its pending action before leaving.</p>
    </section>
    <div v-if="!pending" class="flex flex-wrap gap-3">
      <UButton v-if="store.uncertain && !leavingRoom" :loading="store.pending" @click="resolvePending">Resolve pending action</UButton>
      <UButton v-if="retryable" @click="join">Retry joining</UButton>
      <UButton to="/" color="neutral" variant="soft">Return to Play</UButton>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useAccountStore } from '~/stores/account'
import { useMatchStore } from '~/stores/match'
import { apiError } from '~/utils/apiError'
import type { RoomView } from '~~/shared/types/rooms'

definePageMeta({
  title: 'Join a room',
  description: 'Join a DartsCounter room to play darts with friends or watch their match.',
  key: route => route.fullPath
})

const route = useRoute()
const account = useAccountStore()
const store = useMatchStore()
const code = typeof route.query.code === 'string' ? route.query.code.trim().toUpperCase() : ''
const pending = ref(false)
const error = ref('')
const retryable = ref(false)
const switchRoom = ref<RoomView | null>(null)
const leavingRoom = computed(() => account.currentRoom?.id === switchRoom.value?.id ? account.currentRoom : switchRoom.value)
let active = true

async function resolvePending() {
  if (await store.retryUncertain()) await join()
  else { error.value = store.error; retryable.value = !store.uncertain }
}

async function join() {
  if (pending.value || !active) return
  switchRoom.value = null
  retryable.value = false
  error.value = ''
  if (!/^[A-Z2-9]{8}$/.test(code)) {
    error.value = 'This invitation is invalid. Ask your friend for a fresh link.'
    return
  }
  if (store.uncertain) {
    switchRoom.value = account.currentRoom ?? store.room
    error.value = 'Resolve your pending room action before joining this invitation.'
    return
  }
  pending.value = true
  try {
    const room = await $fetch<RoomView>('/api/rooms/join', { method: 'POST', body: { code }, retry: 0 })
    if (!active) return
    store.acceptRoom(room)
    await navigateTo(room.match?.status === 'in_progress' ? `/match/${room.match.id}` : `/room/${room.id}`, { replace: true })
  } catch (cause) {
    if (!active) return
    const status = (cause as { statusCode?: number }).statusCode
    if (status === 409) {
      const data = await account.load()
      if (!active) return
      switchRoom.value = data?.currentRoom ?? null
      error.value = switchRoom.value ? '' : apiError(cause)
      retryable.value = !switchRoom.value
    } else if (status === 404 || status === 400) {
      error.value = 'This invitation is no longer available. The room may have closed or its invite code changed. Ask your friend for a fresh link.'
    } else {
      error.value = apiError(cause)
      retryable.value = true
    }
  } finally { pending.value = false }
}

onMounted(join)
onBeforeUnmount(() => { active = false })
</script>
