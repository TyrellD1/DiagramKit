import { describe, expect, test } from 'vitest'
import { parseArgv } from './parse.ts'

describe('parseArgv', () => {
  test('defaults to help', () => {
    expect(parseArgv([]).command).toBe('help')
  })

  test('parses serve flags', () => {
    const parsed = parseArgv(['serve', '-p', '4000', '--host', '0.0.0.0', '--dev', '--open'])
    expect(parsed.command).toBe('serve')
    expect(parsed.flags.port).toBe(4000)
    expect(parsed.flags.host).toBe('0.0.0.0')
    expect(parsed.flags.dev).toBe(true)
    expect(parsed.flags.open).toBe(true)
  })

  test('parses open path and no-browser', () => {
    const parsed = parseArgv(['open', '~/.diagram-kit-local1', '--no-browser', '--name', 'local1'])
    expect(parsed.command).toBe('open')
    expect(parsed.args).toEqual(['~/.diagram-kit-local1'])
    expect(parsed.flags.noBrowser).toBe(true)
    expect(parsed.flags.name).toBe('local1')
  })

  test('maps logs -f to follow', () => {
    const parsed = parseArgv(['logs', '-f'])
    expect(parsed.flags.follow).toBe(true)
  })
})
