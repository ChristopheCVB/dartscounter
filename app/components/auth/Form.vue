<template>
  <section class="mx-auto grid max-w-md gap-8 py-4 sm:py-8">
    <header class="page-heading"><h1>{{ title }}</h1><p>{{ description }}</p></header>
    <form class="grid gap-5" @submit.prevent="submit">
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
      <UButton type="submit" :loading="pending" class="w-full justify-center" :disabled="pending || (needsCaptcha && !token)">{{ title }}</UButton>
      <div class="grid gap-3 border-t border-default pt-5 text-sm">
        <p v-if="mode === 'signin'">New to DartsCounter? <NuxtLink :to="authLink('/signup')" class="font-medium text-primary hover:underline">Create account</NuxtLink></p>
        <NuxtLink v-else :to="authLink('/signin')" class="text-primary hover:underline">Back to sign in</NuxtLink>
        <NuxtLink v-if="mode === 'signin' || mode === 'reset'" :to="authLink('/forgot-password')" class="text-primary hover:underline">Forgot password?</NuxtLink>
        <NuxtLink v-if="mode === 'signin' || mode === 'signup'" :to="authLink('/verify-email')" class="text-muted hover:underline">Resend verification email</NuxtLink>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { authReturnPath } from '~/utils/authReturnPath'

const props = defineProps<{ mode: 'signin' | 'signup' | 'forgot' | 'reset' | 'verify' }>()
const auth = useAuth()
const route = useRoute()
const next = computed(() => authReturnPath(route.query.next))
function authLink(path: string) { return next.value === '/' ? path : `${path}?${new URLSearchParams({ next: next.value })}` }
const title = computed(() => ({ signin: 'Sign in', signup: 'Create account', forgot: 'Send password reset', reset: 'Reset password', verify: 'Resend verification email' })[props.mode])
const description = computed(() => ({ signin: 'Welcome back. Your next game is waiting.', signup: 'Keep your players, matches, and statistics together.', forgot: 'Enter your email and we’ll send a password reset link.', reset: 'Choose a new password with at least 8 characters.', verify: 'Enter your email to request a fresh verification link.' })[props.mode])
const needsCaptcha = computed(() => !['reset', 'verify'].includes(props.mode))
const name = ref('')
const email = ref('')
const password = ref('')
const token = ref('')
const captchaKey = ref(0)
const pending = ref(false)
const error = ref('')
const message = ref('')
if (route.query.error) error.value = 'The link is invalid or expired. Request a new one.'

async function submit() {
  if (pending.value) return
  pending.value = true
  error.value = ''
  message.value = ''
  const fetchOptions = { headers: { 'x-captcha-response': token.value } }
  try {
    let result
    if (props.mode === 'signin') {
      result = await auth.signIn.email({ email: email.value, password: password.value, callbackURL: next.value, fetchOptions })
    } else if (props.mode === 'signup') {
      result = await auth.signUp.email({ name: name.value.trim(), email: email.value, password: password.value, callbackURL: next.value, fetchOptions })
      if (!result.error) message.value = 'Check your inbox to verify your account before signing in.'
    } else if (props.mode === 'forgot') {
      result = await auth.requestPasswordReset({ email: email.value, redirectTo: authLink('/reset-password'), fetchOptions })
      if (!result.error) message.value = 'If the account exists, a reset link has been sent.'
    } else if (props.mode === 'reset') {
      if (typeof route.query.token !== 'string') throw new Error('Missing reset token. Request a new link.')
      result = await auth.resetPassword({ newPassword: password.value, token: route.query.token })
      if (!result.error) { password.value = ''; message.value = 'Password updated. You can now sign in.' }
    } else {
      result = await auth.sendVerificationEmail({ email: email.value, callbackURL: next.value })
      if (!result.error) message.value = 'If verification is needed, check your inbox for the link.'
    }
    if (result.error) error.value = result.error.message || 'Unable to complete this request'
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Unable to reach the server' }
  finally { pending.value = false; token.value = ''; captchaKey.value++ }
}
</script>
