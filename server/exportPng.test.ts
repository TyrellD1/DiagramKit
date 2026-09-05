import { describe, expect, test } from 'vitest'
import { parseExportTheme, uiOriginCandidates, parseExportChildren } from './exportPng.ts'

describe('uiOriginCandidates', () => {
  test('production only uses the API port', () => {
    expect(uiOriginCandidates({ port: 3001, webPort: 5173, isProd: true })).toEqual([
      'http://127.0.0.1:3001',
    ])
  })

  test('dev prefers Vite, then the API port', () => {
    expect(uiOriginCandidates({ port: 3021, webPort: 5183, isProd: false })).toEqual([
      'http://127.0.0.1:5183',
      'http://127.0.0.1:3021',
    ])
  })
})

test('parseExportTheme defaults to light', () => {
  expect(parseExportTheme('dark')).toBe('dark')
  expect(parseExportTheme('light')).toBe('light')
  expect(parseExportTheme('light-gray')).toBe('light-gray')
  expect(parseExportTheme('dark-gray')).toBe('dark-gray')
  expect(parseExportTheme('nope')).toBe('light')
  expect(parseExportTheme(undefined)).toBe('light')
})

test('parseExportChildren defaults to including nested boards', () => {
  expect(parseExportChildren(undefined)).toBe(true)
  expect(parseExportChildren('1')).toBe(true)
  expect(parseExportChildren('0')).toBe(false)
  expect(parseExportChildren('false')).toBe(false)
})
