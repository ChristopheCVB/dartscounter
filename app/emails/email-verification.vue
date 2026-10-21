<script setup lang="ts">
import type { EmailProps } from '~~/shared/types/email'
import EmailLayout from '~/emails/layouts/default.vue'

defineProps<EmailProps['email-verification']>()
</script>

<template>
  <EmailLayout :url="url" action="Verify email">
    <ESubject>Verify your DartsCounter email</ESubject>
    <EHeading>Verify your email</EHeading>
    <EText>Hi {{ name }},</EText>
    <EText>Confirm your email address to save your matches and play darts with friends anywhere.</EText>
    <EText>If you didn't create an account, you can ignore this email.</EText>
  </EmailLayout>
</template>
