import {
  attachWorkspace,
  listAttachedWorkspaces,
  probeWorkspace,
  scaffoldWorkspace,
} from '../server/store.ts'
import { helpText } from './help.ts'
import { parseArgv, type CliFlags } from './parse.ts'
import { die, EXIT, formatIssues, hint } from './print.ts'
import { repoRoot } from './root.ts'
import { readVersion } from './version.ts'
import { validateWorkspace } from './schema.ts'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { resolveBoardRef, zipBasename, pngBasename } from '../src/lib/exportTree.ts'
import {
  apiUrl,
  DEFAULT_HOST,
  DEFAULT_PORT,
  DEFAULT_WEB_PORT,
  distIsStale,
  ensureBuilt,
  fetchHealth,
  openInBrowser,
  printLogs,
  printStatus,
  readRunState,
  startServe,
  stopServe,
  type ServeOptions,
} from './serve.ts'

async function version() {
  console.log(await readVersion(repoRoot()))
}

async function detectUiUrl(opts: ServeOptions) {
  const vite = `http://127.0.0.1:${opts.webPort}`
  try {
    const res = await fetch(vite, { signal: AbortSignal.timeout(800) })
    if (res.ok) return vite
  } catch {
    // production serve puts the UI on the API port
  }
  return apiUrl(opts)
}

function serveOpts(flags: CliFlags): ServeOptions {
  return {
    port: flags.port ?? DEFAULT_PORT,
    host: flags.host ?? DEFAULT_HOST,
    webPort: flags.webPort ?? DEFAULT_WEB_PORT,
    dev: flags.dev,
    foreground: flags.foreground,
    openBrowser: flags.open,
  }
}

function requirePath(command: string, args: string[]) {
  const raw = args[0]
  if (!raw) die(`missing path. Usage: diagramkit ${command} <path>`)
  if (args.length > 1) die(`unexpected extra arguments: ${args.slice(1).join(' ')}`)
  return raw
}

function printCreated(dir: string) {
  console.log(`Created workspace: ${dir}`)
  hint(`open it with: diagramkit open ${dir}`)
}

async function cmdCreate(args: string[], flags: CliFlags) {
  const raw = requirePath('create', args)
  let dir: string
  try {
    dir = await scaffoldWorkspace(raw)
  } catch (err) {
    die(err instanceof Error ? err.message : String(err))
  }
  if (!flags.open) {
    printCreated(dir)
    return
  }
  printCreated(dir)
  await cmdOpen([dir], { ...flags, open: false })
}

async function cmdValidate(args: string[], flags: CliFlags) {
  const raw = requirePath('validate', args)
  const probe = await probeWorkspace(raw)
  if (!probe.exists) {
    hint(`create it with: diagramkit create ${raw}`)
    die(`path does not exist: ${probe.path}`, EXIT.notFound)
  }

  const result = await validateWorkspace(raw)
  if (flags.json) {
    console.log(JSON.stringify(result, null, 2))
    process.exit(result.ok ? EXIT.ok : EXIT.error)
  }

  if (result.ok) {
    console.log(`Valid workspace: ${result.path}`)
    console.log(`  ${result.boardCount} board${result.boardCount === 1 ? '' : 's'}`)
    return
  }

  console.error(`Invalid workspace: ${result.path}`)
  console.error('')
  console.error(formatIssues(result.issues))
  console.error('')
  console.error(`${result.issues.length} error${result.issues.length === 1 ? '' : 's'}`)
  process.exit(EXIT.error)
}

async function cmdOpen(args: string[], flags: CliFlags) {
  const raw = requirePath('open', args)
  const probe = await probeWorkspace(raw)

  if (!probe.exists) {
    hint(`create it with: diagramkit create ${raw}`)
    die(`path does not exist: ${probe.path}`, EXIT.notFound)
  }

  if (!probe.isDirectory) {
    die(`${probe.path} is not a directory`)
  }

  const result = await validateWorkspace(raw)
  if (!result.ok) {
    console.error(`Invalid workspace: ${result.path}`)
    console.error('')
    console.error(formatIssues(result.issues))
    console.error('')
    console.error(`${result.issues.length} error${result.issues.length === 1 ? '' : 's'}`)
    if (!probe.isWorkspace) {
      hint(`scaffold a workspace with: diagramkit create ${raw}`)
    }
    process.exit(EXIT.error)
  }

  const list = await attachWorkspace(result.path, flags.name)
  const active = list.workspaces.find(w => w.path === list.activePath)
  console.log(`Opened workspace: ${result.path}`)
  if (active) console.log(`  name  ${active.name}`)

  if (flags.noServe) return

  const opts = serveOpts(flags)
  const existing = await readRunState()
  let url = existing?.url
  let started = false

  if (existing) {
    url = existing.url
  } else {
    const already = await fetchHealth(apiUrl(opts)).catch(() => null)
    if (already?.ok) {
      url = await detectUiUrl(opts)
    } else {
      const state = await startServe({ ...opts, foreground: false, openBrowser: false })
      url = state.url
      started = true
    }
  }

  if (url) {
    console.log(`  url   ${url}`)
    if (started) console.log('  started server')
    if (!flags.noBrowser) openInBrowser(url)
  }
}

async function cmdWorkspaces(flags: CliFlags) {
  const list = await listAttachedWorkspaces()
  if (flags.json) {
    console.log(JSON.stringify(list, null, 2))
    return
  }
  if (list.workspaces.length === 0) {
    console.log('No workspaces.')
    return
  }
  const nameWidth = Math.max(...list.workspaces.map(w => w.name.length), 4)
  for (const w of list.workspaces) {
    const mark = w.path === list.activePath ? '*' : ' '
    console.log(`${mark} ${w.name.padEnd(nameWidth)}  ${w.path}  ${w.kind}`)
  }
}

async function cmdServe(flags: CliFlags) {
  const opts = serveOpts(flags)
  const existing = await readRunState()
  if (existing) {
    if (existing.mode === 'prod' && distIsStale()) {
      ensureBuilt()
      hint('Hard-refresh the browser, or restart: diagramkit stop && diagramkit serve')
    }
    console.log('Already running')
    console.log(`  pid   ${existing.pid}`)
    console.log(`  url   ${existing.url}`)
    console.log(`  mode  ${existing.mode}`)
    hint('stop with: diagramkit stop')
    if (opts.openBrowser) openInBrowser(existing.url)
    return
  }

  if (!opts.foreground) {
    console.log('Starting DiagramKit...')
  }
  const state = await startServe(opts)
  console.log(`Serving ${state.url}`)
  console.log(`  pid   ${state.pid}`)
  console.log(`  mode  ${state.mode}`)
  hint(`stop with: diagramkit stop`)
  hint(`logs: diagramkit logs`)
  if (opts.openBrowser) openInBrowser(state.url)
}

async function ensureApi(flags: CliFlags): Promise<string> {
  const opts = serveOpts(flags)
  const existing = await readRunState()
  if (!existing) {
    const already = await fetchHealth(apiUrl(opts)).catch(() => null)
    if (!already?.ok) {
      await startServe({ ...opts, foreground: false, openBrowser: false })
      console.log('Started server')
    }
  }
  const base = apiUrl(opts)
  const health = await fetchHealth(base).catch(() => null)
  if (!health?.ok) die('server is not reachable. Start it with: diagramkit serve', EXIT.notRunning)
  return base
}

async function cmdExport(args: string[], flags: CliFlags) {
  if (args.length > 1) die(`unexpected extra arguments: ${args.slice(1).join(' ')}`)
  if (flags.theme && flags.theme !== 'light' && flags.theme !== 'dark') {
    die(`invalid --theme ${flags.theme} (expected light or dark)`)
  }
  const theme = flags.theme === 'dark' ? 'dark' : 'light'
  const children = !flags.noChildren
  const base = await ensureApi(flags)

  const listRes = await fetch(`${base}/api/boards`)
  if (!listRes.ok) die(`could not list boards (${listRes.status})`)
  const index = await listRes.json() as { rootBoardId: string; boards: Array<{ id: string; title: string; parentId: string | null }> }

  let root
  try {
    root = resolveBoardRef(index, args[0])
  } catch (err) {
    die(err instanceof Error ? err.message : String(err))
  }

  const nested = children ? ' and nested boards' : ''
  console.log(`Exporting "${root.title}" (${theme})${nested}…`)
  const query = `theme=${theme}&children=${children ? '1' : '0'}`
  const res = await fetch(`${base}/api/boards/${encodeURIComponent(root.id)}/export?${query}`, {
    method: 'POST',
    signal: AbortSignal.timeout(10 * 60 * 1000),
  })
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`
    try {
      const body = await res.json() as { error?: string }
      if (body.error) message = body.error
    } catch {
      // ignore
    }
    die(message)
  }

  const bytes = Buffer.from(await res.arrayBuffer())
  const kind = (res.headers.get('content-type') ?? '').includes('zip') ? 'zip' : 'png'
  const defaultName = kind === 'zip' ? zipBasename(root.title) : pngBasename(root.title)
  const outRaw = flags.out ?? defaultName
  const abs = path.resolve(outRaw)

  if (kind === 'png') {
    if (!flags.out || outRaw.endsWith('.png') || outRaw.endsWith('.zip')) {
      if (outRaw.endsWith('.zip')) {
        const JSZip = (await import('jszip')).default
        const zip = new JSZip()
        zip.file(pngBasename(root.title), bytes)
        await writeFile(abs, await zip.generateAsync({ type: 'nodebuffer' }))
      } else {
        await writeFile(abs, bytes)
      }
      console.log(`Wrote ${abs}`)
      return
    }
    await mkdir(abs, { recursive: true })
    const dest = path.join(abs, pngBasename(root.title))
    await writeFile(dest, bytes)
    console.log(`Wrote 1 PNG to ${abs}`)
    return
  }

  if (!flags.out || outRaw.endsWith('.zip')) {
    await writeFile(abs, bytes)
    console.log(`Wrote ${abs}`)
    return
  }

  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(bytes)
  await mkdir(abs, { recursive: true })
  const names = Object.keys(zip.files)
  for (const name of names) {
    const entry = zip.files[name]
    if (!entry || entry.dir) continue
    await writeFile(path.join(abs, name), await entry.async('nodebuffer'))
  }
  const written = names.filter(n => !zip.files[n]?.dir)
  console.log(`Wrote ${written.length} PNG${written.length === 1 ? '' : 's'} to ${abs}`)
}

async function main() {
  const { command, args, flags } = parseArgv(process.argv.slice(2))

  if (flags.version && command === 'help') {
    await version()
    return
  }

  if (command === 'version') {
    await version()
    return
  }

  if (flags.help || command === 'help') {
    console.log(helpText(command === 'help' ? args[0] : command))
    return
  }

  switch (command) {
    case 'serve':
      await cmdServe(flags)
      break
    case 'stop':
      await stopServe()
      break
    case 'status':
      await printStatus(flags.json)
      break
    case 'logs':
      await printLogs(flags.follow)
      break
    case 'create':
      await cmdCreate(args, flags)
      break
    case 'open':
      await cmdOpen(args, flags)
      break
    case 'validate':
      await cmdValidate(args, flags)
      break
    case 'workspaces':
      await cmdWorkspaces(flags)
      break
    case 'export':
      await cmdExport(args, flags)
      break
    default:
      die(`unknown command "${command}". Run diagramkit help`)
  }
}

main().catch(err => {
  die(err instanceof Error ? err.message : String(err))
})
