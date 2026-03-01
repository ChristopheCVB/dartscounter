<template>
  <UHeader title="DartCounter" to="/">
    <template #right>
      <UButton to="/match/new" icon="i-lucide-circle-plus" color="neutral" variant="ghost" size="sm" class="hidden md:inline-flex">New Match</UButton>
      <UButton to="/history" icon="i-lucide-history" color="neutral" variant="ghost" size="sm" class="hidden md:inline-flex">History</UButton>
      <UButton to="/settings" icon="i-lucide-settings" color="neutral" variant="ghost" size="sm" class="hidden md:inline-flex">Settings</UButton>
    </template>

    <template #body>
      <div class="flex flex-col gap-2 -mx-2">
        <UButton to="/match/new" icon="i-lucide-circle-plus" color="neutral" variant="ghost" block>New Match</UButton>
        <UButton to="/history" icon="i-lucide-history" color="neutral" variant="ghost" block>History</UButton>
        <UButton to="/settings" icon="i-lucide-settings" color="neutral" variant="ghost" block>Settings</UButton>
      </div>
    </template>
  </UHeader>

  <UMain>
    <UContainer>
      <slot />
    </UContainer>
  </UMain>
</template>
