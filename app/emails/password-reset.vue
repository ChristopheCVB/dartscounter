<script setup lang="ts">
import type { EmailProps } from '~~/shared/types/email'
import EmailLayout from '~/emails/layouts/default.vue'

defineProps<EmailProps['password-reset']>()
</script>

<template>
  <EmailLayout :url="url" action="Reset password">
    <ESubject>Reset your DartsCounter password</ESubject>
    <EHeading>Reset your password</EHeading>
    <EText>Hi {{ name }},</EText>
    <EText>Use the link below to choose a new password. This link expires in one hour.</EText>
    <EText>If you didn't request a password reset, you can ignore this email.</EText>
  </EmailLayout>
</template>
