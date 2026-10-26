<template>
  <UButton color="neutral" variant="soft" icon="i-lucide-log-out" :disabled="store.pending || (!!store.uncertain && !retryingLeave)" @click="open = true">Leave room</UButton>
  <UModal v-model:open="open" title="Leave this room?" :description="description" :dismissible="!store.pending && !store.uncertain" :close="!store.pending && !store.uncertain">
    <template #body><UAlert v-if="store.error" color="error" :title="store.error" /></template>
    <template #footer>
      <UButton color="neutral" variant="soft" :disabled="store.pending || !!store.uncertain" @click="open = false">Cancel</UButton>
      <UButton color="error" :loading="store.pending" @click="leave">{{ retryingLeave ? 'Retry leaving' : 'Leave room' }}</UButton>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { RoomView } from '~~/shared/types/rooms'
import { useAccountStore } from '~/stores/account'
import { useMatchStore } from '~/stores/match'

const props = withDefaults(defineProps<{ room: RoomView, navigateOnLeave?: boolean }>(), { navigateOnLeave: true })
const emit = defineEmits<{ left: [] }>()
const store = useMatchStore()
const account = useAccountStore()
const open = ref(false)
const retryingLeave = computed(() => store.uncertain?.action.type === 'leave' && store.uncertain.roomId === props.room.id)
const description = computed(() => {
  const messages = ['Finished results stay in History.']
  if (props.room.match?.status === 'in_progress' && props.room.participantIds.includes(account.userId)) messages.unshift('Leaving ends this unfinished match without a winner for everyone.')
  if (props.room.members.length === 1) messages.push('You are the last person here. The room and its invite code will be deleted.')
  else if (props.room.ownerId === account.userId) messages.push('Ownership will pass to someone remaining in the room.')
  return messages.join(' ')
})
async function leave() {
  const target = account.currentRoom?.id === props.room.id ? account.currentRoom : props.room
  const left = retryingLeave.value ? await store.retryUncertain() : await store.leaveRoom(target)
  if (left) {
    open.value = false
    emit('left')
    if (props.navigateOnLeave) await navigateTo('/')
  }
}
</script>
