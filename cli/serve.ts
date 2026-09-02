import { spawn, spawnSync, type ChildProcess, type StdioOptions } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync } from 'node:fs'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { appDir } from '../server/store.ts'
import { die, EXIT, hint } from './print.ts'
import { repoBin, repoRoot } from './root.ts'

export const DEFAULT_PORT = 3001
export const DEFAULT_WEB_PORT = 5173
export const DEFAULT_HOST = '127.0.0.1'

export interface RunState {
  pid: number
  port: number
  webPort: number | null
  host: string
  mode: 'prod' | 'dev'
  url: string
  startedAt: string
}

export interface ServeOptions {
  port: number
  host: string
  webPort: number
  dev: boolean
  foreground: boolean
  openBrowser: boolean
}

export function runStatePath() {
  return path.join(appDir(), 'run.json')
}

export function serveLogPath() {
  return path.join(appDir(), 'serve.log')
}

export function uiUrl(opts: { host: string; port: number; webPort: number; dev: boolean }) {
  const host = opts.host === '0.0.0.0' || opts.host === '::' ? '127.0.0.1' : opts.host
  const port = opts.dev ? opts.webPort : opts.port
  return `http://${host}:${port}`
}

export function apiUrl(opts: { host: string; port: number }) {
  const host = opts.host === '0.0.0.0' || opts.host === '::' ? '127.0.0.1' : opts.host
  return `http://${host}:${opts.port}`
}

function pidAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export async function readRunState(): Promise<RunState | null> {
  try {
    const raw = JSON.parse(await readFile(runStatePath(), 'utf8')) as RunState
    if (!raw || typeof raw.pid !== 'number') return null
    if (!pidAlive(raw.pid)) {
      await unlink(runStatePath()).catch(() => {})
      return null
    }
    return raw
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

async function writeRunState(state: RunState) {
  await mkdir(appDir(), { recursive: true })
  await writeFile(runStatePath(), JSON.stringify(state, null, 2) + '\n', 'utf8')
}

async function removeRunState() {
  await unlink(runStatePath()).catch(() => {})
}

export async function fetchHealth(base: string) {
  const url = `${base.replace(/\/$/, '')}/api/health`
  const res = await fetch(url)
  if (!res.ok) return null
  return await res.json() as { ok?: boolean; workspace?: string }
}

export async function waitForHealth(base: string, timeoutMs = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const health = await fetchHealth(base)
      if (health?.ok) return health
    } catch {
      // still booting
    }
    await new Promise(r => setTimeout(r, 150))
  }
  return null
}

function ensureBuilt() {
  const index = path.join(repoRoot(), 'dist', 'index.html')
  if (existsSync(index)) return
  console.error('UI not built yet. Running npm run build...')
  const result = spawnSync('npm', ['run', 'build'], { cwd: repoRoot(), stdio: 'inherit' })
  if (result.status !== 0) {
    die('build failed. Fix that, or run: diagramkit serve --dev')
  }
}

function tsxBin() {
  const bin = repoBin('tsx')
  if (!existsSync(bin)) die(`tsx not found at ${bin}. Run npm install in ${repoRoot()}`)
  return bin
}

function concurrentlyBin() {
  const bin = repoBin('concurrently')
  if (!existsSync(bin)) die(`concurrently not found at ${bin}. Run npm install in ${repoRoot()}`)
  return bin
}

export function openInBrowser(url: string) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open'
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url]
  spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref()
}

function spawnServe(opts: ServeOptions, inherit: boolean): ChildProcess {
  const env = {
    ...process.env,
    PATH: `${path.join(repoRoot(), 'node_modules', '.bin')}${path.delimiter}${process.env.PATH ?? ''}`,
    PORT: String(opts.port),
    HOST: opts.host,
    WEB_PORT: String(opts.webPort),
  }

  const cwd = repoRoot()
  let logFd: number | undefined
  if (!inherit) {
    mkdirSync(appDir(), { recursive: true })
    logFd = openSync(serveLogPath(), 'a')
  }

  const stdio: StdioOptions = inherit ? 'inherit' : ['ignore', logFd!, logFd!]

  let child: ChildProcess
  if (opts.dev) {
    child = spawn(
      concurrentlyBin(),
      [
        '-k',
        '-n', 'web,api',
        `vite --host --port ${opts.webPort}`,
        'tsx watch --exclude ./data --exclude ./dist server/index.ts',
      ],
      {
        cwd,
        env,
        detached: !inherit,
        stdio,
      },
    )
  } else {
    ensureBuilt()
    child = spawn(
      tsxBin(),
      [path.join(repoRoot(), 'server', 'index.ts')],
      {
        cwd,
        env: { ...env, NODE_ENV: 'production' },
        detached: !inherit,
        stdio,
      },
    )
  }

  if (logFd !== undefined) closeSync(logFd)
  return child
}

export async function startServe(opts: ServeOptions): Promise<RunState> {
  const existing = await readRunState()
  if (existing) return existing

  const url = uiUrl(opts)
  const child = spawnServe(opts, opts.foreground)
  if (!child.pid) die('failed to start server process')

  const state: RunState = {
    pid: child.pid,
    port: opts.port,
    webPort: opts.dev ? opts.webPort : null,
    host: opts.host,
    mode: opts.dev ? 'dev' : 'prod',
    url,
    startedAt: new Date().toISOString(),
  }
  await writeRunState(state)

  if (opts.foreground) {
    child.on('exit', async (code) => {
      await removeRunState()
      process.exit(code ?? 0)
    })
    process.on('SIGINT', () => {
      child.kill('SIGINT')
    })
    process.on('SIGTERM', () => {
      child.kill('SIGTERM')
    })
    await new Promise(() => {})
  }

  let exited: number | null = null
  child.once('exit', code => {
    exited = code ?? 1
  })

  const health = await waitForHealth(apiUrl(opts))
  if (health?.ok) {
    child.unref()
    return state
  }

  if (exited !== null) {
    await removeRunState()
    hint(`logs: ${serveLogPath()}`)
    die(`server exited before becoming ready (code ${exited})`)
  }

  hint(`logs: ${serveLogPath()}`)
  hint('stop with: diagramkit stop')
  die(`server started (pid ${state.pid}) but /api/health did not respond`)
}

export async function stopServe() {
  const state = await readRunState()
  if (!state) die('server is not running', EXIT.notRunning)

  try {
    process.kill(-state.pid, 'SIGTERM')
  } catch {
    try {
      process.kill(state.pid, 'SIGTERM')
    } catch {
      await removeRunState()
      die(`could not signal pid ${state.pid}`, EXIT.notRunning)
    }
  }

  const start = Date.now()
  while (Date.now() - start < 3000) {
    if (!pidAlive(state.pid)) break
    await new Promise(r => setTimeout(r, 50))
  }
  if (pidAlive(state.pid)) {
    try {
      process.kill(-state.pid, 'SIGKILL')
    } catch {
      try {
        process.kill(state.pid, 'SIGKILL')
      } catch {
        // already gone
      }
    }
  }

  await removeRunState()
  console.log(`Stopped pid ${state.pid}`)
}

export async function printStatus(asJson: boolean) {
  const state = await readRunState()
  if (asJson) {
    console.log(JSON.stringify(state ? { running: true, ...state } : { running: false }, null, 2))
    if (!state) process.exit(EXIT.notRunning)
    return
  }
  if (!state) die('not running', EXIT.notRunning)
  console.log('running')
  console.log(`  pid   ${state.pid}`)
  console.log(`  url   ${state.url}`)
  console.log(`  api   ${apiUrl(state)}`)
  console.log(`  mode  ${state.mode}`)
}

export async function printLogs(follow: boolean) {
  const log = serveLogPath()
  if (!existsSync(log)) die(`no log file at ${log}`, EXIT.notRunning)
  if (follow) {
    const child = spawn('tail', ['-f', log], { stdio: 'inherit' })
    await new Promise<void>((resolve, reject) => {
      child.on('exit', () => resolve())
      child.on('error', reject)
    })
    return
  }
  process.stdout.write(readFileSync(log, 'utf8'))
}
