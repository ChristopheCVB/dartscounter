export const PLAYER_COLORS = ['#f05a28', '#24a8ff', '#30c981', '#ffd166', '#ff6f91', '#7f8cff'] as const

function toHex(value: number): string {
  return Math.round(value).toString(16).padStart(2, '0')
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100
  const l = lightness / 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = hue / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))

  let r1 = 0
  let g1 = 0
  let b1 = 0

  if (hp >= 0 && hp < 1) {
    r1 = c
    g1 = x
  } else if (hp < 2) {
    r1 = x
    g1 = c
  } else if (hp < 3) {
    g1 = c
    b1 = x
  } else if (hp < 4) {
    g1 = x
    b1 = c
  } else if (hp < 5) {
    r1 = x
    b1 = c
  } else {
    r1 = c
    b1 = x
  }

  const m = l - c / 2
  const r = (r1 + m) * 255
  const g = (g1 + m) * 255
  const b = (b1 + m) * 255

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export function fallbackPlayerColor(index: number): string {
  if (index < PLAYER_COLORS.length) {
    return PLAYER_COLORS[index] ?? PLAYER_COLORS[0]
  }

  const hue = (index * 137.508) % 360
  return hslToHex(hue, 74, 57)
}

export function complementaryColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min

  let h = 0
  if (d !== 0) {
    if (max === r) {
      h = ((g - b) / d) % 6
    } else if (max === g) {
      h = (b - r) / d + 2
    } else {
      h = (r - g) / d + 4
    }
    h = ((h * 60) + 360) % 360
  }

  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))

  const compHue = (h + 180) % 360
  return hslToHex(compHue, s * 100, l * 100)
}

export function normalizePlayerColor(color: string | undefined, index = 0): string {
  if (!color) {
    return fallbackPlayerColor(index)
  }

  const normalized = color.trim()
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return fallbackPlayerColor(index)
  }

  return normalized.toLowerCase()
}
