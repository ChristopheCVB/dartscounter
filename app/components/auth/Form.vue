<template>
  <UCard class="mx-auto max-w-md arcade-glow">
    <template #header><h1 class="text-xl font-semibold">{{ title }}</h1></template>
    <form class="grid gap-4" @submit.prevent="submit">
      <UFormField v-if="mode === 'signup'" label="Name" required>
        <UInput v-model="name" autocomplete="name" required maxlength="24" class="w-full" />
      </UFormField>
      <UFormField v-if="mode !== 'reset'" label="Email" required>
        <UInput v-model="email" type="email" autocomplete="email" required class="w-full" />
      </UFormField>
      <UFormField v-if="mode !== 'forgot' && mode !== 'verify'" label="Password" required>
        <UInput v-model="password" type="password" :autocomplete="mode === 'signin' ? 'current-password' : 'new-password'" required minlength="8" maxlength="128" class="w-full" />
      </UFormField>
      <ClientOnly><NuxtTurnstile v-if="mode !== 'reset' && mode !== 'verify'" :key="captchaKey" v-model="token" /></ClientOnly>
      <UAlert v-if="error" color="error" :title="error" />
      <UAlert v-if="message" color="success" :title="message" />
      <UButton type="submit" :loading="pending" :disabled="pending || (needsCaptcha && !token)">{{ title }}</UButton>
      <div class="flex flex-wrap gap-3">
        <NuxtLink to="/signin">Sign in</NuxtLink>
        <NuxtLink to="/signup">Create account</NuxtLink>
        <NuxtLink to="/forgot-password">Forgot password?</NuxtLink>
        <NuxtLink to="/verify-email">Resend verification</NuxtLink>
      </div>
    </form>
  </UCard>
</template>

<script setup lang="ts">
import { useAccountStore } from '~/stores/account'

const props = defineProps<{ mode: 'signin' | 'signup' | 'forgot' | 'reset' | 'verify' }>()
const auth = useAuth()
const route = useRoute()
const title = computed(() => ({ signin: 'Sign in', signup: 'Create account', forgot: 'Send password reset', reset: 'Reset password', verify: 'Resend verification email' })[props.mode])
const needsCaptcha = computed(() => !['reset', 'verify'].includes(props.mode))
const name = ref('')
const email = ref('')
const password = ref('')
const token = ref('')
const captchaKey = ref(0)
const pending = ref(false)
const error = ref('')
const message = ref(route.query.error ? 'The link is invalid or expired. Request a new one.' : '')

async function submit() {
  pending.value = true
  error.value = ''
  message.value = ''
  const fetchOptions = { headers: { 'x-captcha-response': token.value } }
  try {
    let result
    if (props.mode === 'signin') {
      result = await auth.signIn.email({ email: email.value, password: password.value, fetchOptions })
      if (!result.error) {
        await useAccountStore().load()
        const next = typeof route.query.next === 'string' && /^\/(?!\/)/.test(route.query.next) ? route.query.next : '/rooms'
        await navigateTo(next)
      }
    } else if (props.mode === 'signup') {
      result = await auth.signUp.email({ name: name.value.trim(), email: email.value, password: password.value, callbackURL: '/rooms', fetchOptions })
      if (!result.error) message.value = 'Check your inbox to verify your account before signing in.'
    } else if (props.mode === 'forgot') {
      result = await auth.requestPasswordReset({ email: email.value, redirectTo: '/reset-password', fetchOptions })
      if (!result.error) message.value = 'If the account exists, a reset link has been sent.'
    } else if (props.mode === 'reset') {
      if (typeof route.query.token !== 'string') throw new Error('Missing reset token. Request a new link.')
      result = await auth.resetPassword({ newPassword: password.value, token: route.query.token })
      if (!result.error) { password.value = ''; message.value = 'Password updated. You can now sign in.' }
    } else {
      result = await auth.sendVerificationEmail({ email: email.value, callbackURL: '/rooms' })
      if (!result.error) message.value = 'If verification is needed, check your inbox for the link.'
    }
    if (result.error) error.value = result.error.message || 'Unable to complete this request'
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Unable to reach the server' }
  finally { pending.value = false; token.value = ''; captchaKey.value++ }
}
</script>
