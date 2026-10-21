<script setup lang="ts">
defineProps<{ url: string, action: string }>()
</script>

<template>
  <EHtml lang="en">
    <EHead />
    <EBody :style="{ backgroundColor: '#fff7ed', fontFamily: 'Arial, sans-serif', color: '#18181b' }">
      <EContainer :style="{ maxWidth: '560px', margin: '32px auto', padding: '32px', backgroundColor: '#ffffff', borderRadius: '12px' }">
        <EText :style="{ fontSize: '24px', fontWeight: 'bold', color: '#f05a28' }">DartsCounter</EText>
        <slot />
        <EButton :href="url" :style="{ backgroundColor: '#f05a28', color: '#ffffff', padding: '12px 20px', borderRadius: '6px', fontWeight: 'bold' }">
          {{ action }}
        </EButton>
        <EText :style="{ marginTop: '24px', fontSize: '14px', color: '#52525b' }">
          If the button doesn't work, copy and paste this link into your browser:
        </EText>
        <ELink :href="url" :style="{ fontSize: '14px', wordBreak: 'break-all' }">{{ url }}</ELink>
      </EContainer>
    </EBody>
  </EHtml>
</template>
