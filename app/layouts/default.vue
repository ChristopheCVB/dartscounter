<template>
  <UHeader
    title="DartCounter"
    to="/"
    class="header-shell"
    :ui="{
      root: 'backdrop-blur-xl border-b border-default/60 bg-[color-mix(in_srgb,var(--ui-bg)_72%,transparent)]',
      title: 'arcade-title text-sm tracking-[0.2em]'
    }"
  >
    <template #right>
      <UButton
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        :icon="item.icon"
        color="neutral"
        :variant="route.path === item.to ? 'solid' : 'ghost'"
        size="sm"
        class="hidden md:inline-flex"
      >
        {{ item.label }}
      </UButton>
    </template>

    <template #body>
      <div class="-mx-2 grid gap-2">
        <UButton
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          :icon="item.icon"
          color="neutral"
          :variant="route.path === item.to ? 'solid' : 'soft'"
          block
        >
          {{ item.label }}
        </UButton>
      </div>
    </template>
  </UHeader>

  <UMain class="pb-8 pt-5 sm:pt-8">
    <UContainer>
      <slot />
    </UContainer>
  </UMain>
</template>

<script setup lang="ts">
const route = useRoute()

const navItems = [
  { label: 'New Match', to: '/match/new', icon: 'i-lucide-circle-plus' },
  { label: 'History', to: '/history', icon: 'i-lucide-history' },
  { label: 'Settings', to: '/settings', icon: 'i-lucide-settings' }
]
</script>

<style scoped>
.header-shell {
  box-shadow: 0 24px 44px -30px rgba(5, 8, 17, 0.85);
}
</style>
