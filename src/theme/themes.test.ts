import { expect, test } from 'vitest'
import { colorModeOf, isTheme, parseTheme, toggleTheme } from './themes'

test('isTheme accepts the four palettes', () => {
  expect(isTheme('light')).toBe(true)
  expect(isTheme('dark-gray')).toBe(true)
  expect(isTheme('sepia')).toBe(false)
})

test('parseTheme ignores unknown values', () => {
  expect(parseTheme('light-gray')).toBe('light-gray')
  expect(parseTheme('nope')).toBeNull()
  expect(parseTheme(undefined)).toBeNull()
})

test('colorModeOf maps gray themes onto light or dark', () => {
  expect(colorModeOf('light-gray')).toBe('light')
  expect(colorModeOf('dark-gray')).toBe('dark')
})

test('toggleTheme stays in color or grayscale', () => {
  expect(toggleTheme('light')).toBe('dark')
  expect(toggleTheme('dark')).toBe('light')
  expect(toggleTheme('light-gray')).toBe('dark-gray')
  expect(toggleTheme('dark-gray')).toBe('light-gray')
})
