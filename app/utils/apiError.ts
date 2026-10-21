export function apiError(error: unknown) {
  const value = error as { data?: { statusMessage?: string }, message?: string }
  return value?.data?.statusMessage || value?.message || 'Unable to reach the server'
}
