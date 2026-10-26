<template>
  <div class="flex min-w-0 flex-wrap items-center gap-2">
    <UButton v-if="isSupported" icon="i-lucide-share-2" color="neutral" variant="soft" @click="shareRoom">Share</UButton>
    <UButton icon="i-lucide-link" color="neutral" variant="soft" @click="copyLink">Copy link</UButton>
    <UInput v-if="manualCopy" :model-value="inviteUrl" aria-label="Room invite link" readonly class="w-full" @focus="($event.target as HTMLInputElement).select()" />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ code: string }>()
const origin = useRequestURL().origin
const inviteUrl = computed(() => `${origin}/join?code=${encodeURIComponent(props.code)}`)
const mounted = useMounted()
const isSupported = computed(() => mounted.value && typeof navigator.share === 'function')
const toast = useToast()
const manualCopy = ref(false)

async function copyLink() {
  try {
    await navigator.clipboard.writeText(inviteUrl.value)
    manualCopy.value = false
    toast.add({ title: 'Invite link copied', color: 'success' })
  } catch {
    manualCopy.value = true
    toast.add({ title: 'Could not copy the link', description: 'Select the invite link and copy it manually.', color: 'error' })
  }
}
async function shareRoom() {
  try { await navigator.share({ title: 'Join my DartsCounter room', url: inviteUrl.value }) }
  catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') return
    toast.add({ title: 'Could not share the invitation', description: 'Use Copy link to send the invitation.', color: 'error' })
  }
}
</script>
