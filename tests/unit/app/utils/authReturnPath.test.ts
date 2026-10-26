import { describe, expect, it } from 'vitest'
import { authReturnPath } from '../../../../app/utils/authReturnPath'

describe('authentication return destinations', () => {
  it('preserves invitations, queries, and fragments', () => {
    expect(authReturnPath('/join?code=ABCDEFGH')).toBe('/join?code=ABCDEFGH')
    expect(authReturnPath('/room/one?view=players#rules')).toBe('/room/one?view=players#rules')
  })

  it.each([undefined, null, [], ['/join'], 'https://example.com', '//example.com', '/\\example.com', '/\t/example.com', '/a/..//example.com', '/\\[invalid', 'javascript:alert(1)'])('falls back to Play for unsafe or malformed input %j', value => {
    expect(authReturnPath(value)).toBe('/')
  })
})
