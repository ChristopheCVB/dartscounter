<template><span data-allow-mismatch="text" :class="connected ? 'text-muted' : 'text-warning'">{{ connected ? 'Connected' : `Reconnecting · ${remaining}` }}</span></template>

<script setup lang="ts">
import type { RoomMember } from '~~/shared/types/rooms'
import { ROOM_CONNECTED_MS, ROOM_GRACE_MS } from '~~/shared/types/rooms'

const props = defineProps<{ member: RoomMember }>()
const now = useNow({ interval: 1000 })
const milliseconds = computed(() => Math.max(0, props.member.expiresAt - now.value.getTime()))
const connected = computed(() => props.member.connected && milliseconds.value > ROOM_GRACE_MS - ROOM_CONNECTED_MS)
const remaining = computed(() => {
  const seconds = Math.ceil(milliseconds.value / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
})
</script>
