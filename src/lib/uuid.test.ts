import { expect, test } from 'vitest'
import { uuid } from './uuid'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

test('returns a UUID v4', () => {
  expect(uuid()).toMatch(UUID_V4)
})

test('returns a distinct value each call', () => {
  expect(uuid()).not.toBe(uuid())
})
