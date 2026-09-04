import JSZip from 'jszip'
import { chromium, type Browser } from 'playwright'
import { namedBoardTree, resolveBoardRef, zipBasename } from '../src/lib/exportTree.ts'
import { activeWorkspaceId, exportPageUrl } from '../src/lib/route.ts'
import { listAttachedWorkspaces, listWorkspace } from './store.ts'

export type ExportTheme = 'light' | 'dark'

export interface ExportPng {
  filename: string
  bytes: Buffer
}

export interface ExportResult {
  files: ExportPng[]
  zipName: string
}

function fail(message: string, status = 500): never {
  throw Object.assign(new Error(message), { status })
}

/** Production serves the UI on the API port. Dev serves Vite on WEB_PORT. Never
 *  fall through to a different process's default 5173 while this server is prod. */
export function uiOriginCandidates(opts?: {
  port?: number
  webPort?: number
  isProd?: boolean
}): string[] {
  const webPort = opts?.webPort ?? Number(process.env.WEB_PORT || 5173)
  const port = opts?.port ?? Number(process.env.PORT || 3001)
  const isProd = opts?.isProd ?? process.env.NODE_ENV === 'production'
  const api = `http://127.0.0.1:${port}`
  const web = `http://127.0.0.1:${webPort}`
  return isProd ? [api] : [web, api]
}

export async function resolveUiOrigin(opts?: {
  port?: number
  webPort?: number
  isProd?: boolean
}): Promise<string> {
  for (const origin of uiOriginCandidates(opts)) {
    try {
      const res = await fetch(origin, { signal: AbortSignal.timeout(1200) })
      if (res.ok) return origin
    } catch {
      // try the next bind
    }
  }
  fail('UI is not reachable on 127.0.0.1. Start the app with diagramkit serve.')
}

let exportChain: Promise<unknown> = Promise.resolve()

export function exportBoardTree(opts: {
  boardId: string
  theme?: ExportTheme
  uiOrigin?: string
  port?: number
  webPort?: number
}): Promise<ExportResult> {
  const run = exportChain.then(() => runExport(opts), () => runExport(opts))
  exportChain = run.then(() => undefined, () => undefined)
  return run
}

async function runExport(opts: {
  boardId: string
  theme?: ExportTheme
  uiOrigin?: string
  port?: number
  webPort?: number
}): Promise<ExportResult> {
  const theme: ExportTheme = opts.theme === 'dark' ? 'dark' : 'light'
  const index = await listWorkspace()
  const root = resolveBoardRef(index, opts.boardId)
  const named = namedBoardTree(index, root.id)
  if (named.length === 0) fail(`Board not found: ${opts.boardId}`, 404)

  const spaces = await listAttachedWorkspaces()
  const workspaceId = activeWorkspaceId(spaces)
  const uiOrigin = opts.uiOrigin ?? await resolveUiOrigin({ port: opts.port, webPort: opts.webPort })

  let browser: Browser | null = null
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage'],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    fail(
      `Could not launch Chromium for export. ${message}. Run: npx playwright install chromium`,
      500,
    )
  }

  const files: ExportPng[] = []
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      colorScheme: theme,
    })
    await context.addInitScript((next: ExportTheme) => {
      try {
        localStorage.setItem('diagramkit-theme', next)
      } catch {
        // ignore
      }
      document.documentElement.setAttribute('data-theme', next)
    }, theme)

    const page = await context.newPage()
    page.setDefaultTimeout(45_000)

    for (const item of named) {
      const url = exportPageUrl({
        origin: uiOrigin,
        workspaceId,
        boardId: item.board.id,
        theme,
      })
      await page.goto(url, { waitUntil: 'load' })
      await page.waitForSelector('html[data-export-ready="1"]')
      await page.evaluate(() => document.fonts.ready)
      await new Promise(resolve => setTimeout(resolve, 200))
      const flow = page.locator('.react-flow')
      await flow.waitFor({ state: 'visible' })
      const bytes = Buffer.from(await flow.screenshot({ type: 'png', animations: 'disabled' }))
      files.push({ filename: item.filename, bytes })
    }

    await context.close()
  } finally {
    await browser.close()
  }

  return { files, zipName: zipBasename(root.title) }
}

export async function zipExport(result: ExportResult): Promise<Buffer> {
  const zip = new JSZip()
  for (const file of result.files) {
    zip.file(file.filename, file.bytes)
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

export function parseExportTheme(value: string | null | undefined): ExportTheme {
  return value === 'dark' ? 'dark' : 'light'
}
