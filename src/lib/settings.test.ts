import { afterEach, expect, test, vi } from 'vitest'
import {
  DEFAULT_SIDEBAR_OPACITY,
  SETTINGS_STORAGE_KEY,
  clampOpacity,
  normalizeSettings,
  parseOpacity,
  readStoredSettings,
} from './settings'

const memory = new Map<string, string>()

vi.stubGlobal('localStorage', {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memory.set(key, value)
  },
  removeItem: (key: string) => {
    memory.delete(key)
  },
})

afterEach(() => {
  memory.clear()
})

test('clampOpacity keeps values in 0–100', () => {
  expect(clampOpacity(0)).toBe(0)
  expect(clampOpacity(100)).toBe(100)
  expect(clampOpacity(47.4)).toBe(47)
  expect(clampOpacity(-12)).toBe(0)
  expect(clampOpacity(140)).toBe(100)
  expect(clampOpacity(Number.NaN)).toBe(DEFAULT_SIDEBAR_OPACITY)
})

test('parseOpacity reads integers and falls back', () => {
  expect(parseOpacity('80')).toBe(80)
  expect(parseOpacity('  4 ')).toBe(4)
  expect(parseOpacity('', 55)).toBe(55)
  expect(parseOpacity('nope', 12)).toBe(12)
})

test('normalizeSettings fills defaults', () => {
  expect(normalizeSettings(null)).toEqual({
    sidebarLeftOpacity: 100,
    sidebarRightOpacity: 100,
  })
  expect(normalizeSettings({ sidebarLeftOpacity: 40 })).toEqual({
    sidebarLeftOpacity: 40,
    sidebarRightOpacity: 100,
  })
})

test('readStoredSettings uses localStorage when present', () => {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ sidebarRightOpacity: 25 }))
  expect(readStoredSettings()).toEqual({
    sidebarLeftOpacity: 100,
    sidebarRightOpacity: 25,
  })
})
