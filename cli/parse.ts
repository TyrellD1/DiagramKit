import { die } from './print.ts'

const COMMANDS = new Set([
  'serve',
  'stop',
  'status',
  'logs',
  'create',
  'open',
  'validate',
  'workspaces',
  'export',
  'help',
  'version',
])

const BOOLEAN = new Set([
  'help',
  'version',
  'json',
  'dev',
  'foreground',
  'follow',
  'open',
  'no-browser',
  'no-serve',
  'no-children',
])

const VALUE = new Set(['port', 'host', 'web-port', 'name', 'out', 'theme'])

const SHORT: Record<string, string> = {
  h: 'help',
  V: 'version',
  p: 'port',
  f: 'foreground',
}

export interface CliFlags {
  help: boolean
  version: boolean
  json: boolean
  dev: boolean
  foreground: boolean
  follow: boolean
  open: boolean
  noBrowser: boolean
  noServe: boolean
  noChildren: boolean
  port?: number
  host?: string
  webPort?: number
  name?: string
  out?: string
  theme?: string
}

export interface ParsedCli {
  command: string
  args: string[]
  flags: CliFlags
}

function emptyFlags(): CliFlags {
  return {
    help: false,
    version: false,
    json: false,
    dev: false,
    foreground: false,
    follow: false,
    open: false,
    noBrowser: false,
    noServe: false,
    noChildren: false,
  }
}

function camel(name: string): keyof CliFlags | 'webPort' | 'noBrowser' | 'noServe' | 'noChildren' {
  if (name === 'web-port') return 'webPort'
  if (name === 'no-browser') return 'noBrowser'
  if (name === 'no-serve') return 'noServe'
  if (name === 'no-children') return 'noChildren'
  return name as keyof CliFlags
}

function parseNumber(flag: string, raw: string) {
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0 || n > 65535) {
    die(`invalid ${flag}: ${raw} (expected a port 1–65535)`)
  }
  return n
}

export function parseArgv(argv: string[]): ParsedCli {
  const flags = emptyFlags()
  const positionals: string[] = []

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!

    if (arg === '--') {
      positionals.push(...argv.slice(i + 1))
      break
    }

    if (arg.startsWith('--')) {
      const body = arg.slice(2)
      const eq = body.indexOf('=')
      const name = eq === -1 ? body : body.slice(0, eq)
      const inline = eq === -1 ? undefined : body.slice(eq + 1)

      if (BOOLEAN.has(name)) {
        if (inline === 'false') setBool(flags, name, false)
        else setBool(flags, name, true)
        continue
      }
      if (VALUE.has(name)) {
        const value = inline ?? argv[++i]
        if (!value || value.startsWith('-')) die(`missing value for --${name}`)
        setValue(flags, name, value)
        continue
      }
      die(`unknown option --${name}`)
    }

    if (arg.startsWith('-') && arg.length > 1 && arg !== '-') {
      const letters = arg.slice(1)
      for (let c = 0; c < letters.length; c++) {
        const short = letters[c]!
        const name = SHORT[short]
        if (!name) die(`unknown option -${short}`)
        if (BOOLEAN.has(name)) {
          setBool(flags, name, true)
          continue
        }
        const rest = letters.slice(c + 1)
        const value = rest.startsWith('-') ? undefined : rest || argv[++i]
        if (!value || String(value).startsWith('-')) die(`missing value for -${short}`)
        setValue(flags, name, String(value))
        break
      }
      continue
    }

    positionals.push(arg)
  }

  let command = 'help'
  const args = [...positionals]
  if (args[0] && COMMANDS.has(args[0])) {
    command = args.shift()!
  } else if (args[0]) {
    die(`unknown command "${args[0]}". Run diagramkit help`)
  }

  if (command === 'logs' && flags.foreground) {
    flags.follow = true
  }

  return { command, args, flags }
}

function setBool(flags: CliFlags, name: string, value: boolean) {
  const key = camel(name)
  ;(flags as unknown as Record<string, boolean>)[key] = value
}

function setValue(flags: CliFlags, name: string, value: string) {
  if (name === 'port') flags.port = parseNumber('--port', value)
  else if (name === 'web-port') flags.webPort = parseNumber('--web-port', value)
  else if (name === 'host') flags.host = value
  else if (name === 'name') flags.name = value
  else if (name === 'out') flags.out = value
  else if (name === 'theme') flags.theme = value
}

