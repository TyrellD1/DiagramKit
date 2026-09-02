import { describe, expect, test } from 'vitest'
import { formatVersion } from './version.ts'

describe('formatVersion', () => {
  test('includes git revision and checkout path', () => {
    expect(formatVersion('0.1.0', '6cc6d82-dirty', '/repo')).toBe(
      '0.1.0 (6cc6d82-dirty)\n/repo',
    )
  })

  test('omits git when the checkout has no revision', () => {
    expect(formatVersion('0.1.0', null, '/repo')).toBe('0.1.0\n/repo')
  })
})
