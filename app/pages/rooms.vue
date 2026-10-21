<template>
  <section class="grid gap-4">
    <UPageHeader title="Rooms" description="Play on one device or invite friends anywhere in the world." />
    <UAlert v-if="error || account.error" color="error" :title="error || account.error" />
    <UCard>
      <div class="flex flex-wrap gap-3">
        <UButton :loading="pending" @click="create">Create room</UButton>
        <UButton to="/match/new" color="neutral" variant="soft">One-device match</UButton>
      </div>
      <form class="mt-4 flex flex-wrap gap-3" @submit.prevent="join">
        <UFormField label="Room code"><UInput v-model="code" maxlength="8" placeholder="ABCDEFGH" autocomplete="off" required /></UFormField>
        <UButton type="submit" class="self-end" :loading="pending">Join room</UButton>
      </form>
    </UCard>
    <UCard v-if="account.rooms.length">
      <h2 class="mb-3 font-semibold">Your rooms</h2>
      <div class="flex flex-wrap gap-3"><UButton v-for="item in account.rooms" :key="item.id" :to="`/room/${item.id}`" variant="soft">{{ item.code }}</UButton></div>
    </UCard>
  </section>
</template>

<script setup lang="ts">
import { useAccountStore } from '~/stores/account'
import { useMatchStore } from '~/stores/match'

import type { RoomView } from '~~/shared/types/rooms'
import { apiError } from '~/utils/apiError'
const account = useAccountStore()
const code = ref('')
const error = ref('')
const pending = ref(false)
onMounted(() => account.load())
async function enter(path: '/api/rooms' | '/api/rooms/join', body: object) {
  pending.value = true
  error.value = ''
  try {
    const room = await $fetch<RoomView>(path, { method: 'POST', body })
    useMatchStore().acceptRoom(room)
    await account.load()
    await navigateTo(`/room/${room.id}`)
  } catch (cause) { error.value = apiError(cause) }
  finally { pending.value = false }
}
function create() { return enter('/api/rooms', {}) }
function join() { return enter('/api/rooms/join', { code: code.value.trim().toUpperCase() }) }
</script>
