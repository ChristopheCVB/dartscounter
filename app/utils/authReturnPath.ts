export function authReturnPath(value: unknown) {
  if (typeof value !== 'string' || !/^\/(?!\/)/.test(value)) return '/'
  const origin = 'https://dartscounter.invalid'
  try {
    const destination = new URL(value, origin)
    const path = `${destination.pathname}${destination.search}${destination.hash}`
    return destination.origin === origin && /^\/(?!\/)/.test(path) ? path : '/'
  } catch { return '/' }
}
