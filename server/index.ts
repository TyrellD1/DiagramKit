import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import type { BoardDocument } from '../src/types.ts'
import { parseEditSource } from './boardHistory.ts'
import {
  attachWorkspace,
  createBoard,
  dataDir,
  deleteBoard,
  detachWorkspace,
  ensureApp,
  getBoardHistory,
  listAttachedWorkspaces,
  listWorkspace,
  readBoard,
  redoBoard,
  saveBoard,
  switchWorkspace,
  undoBoard,
} from './store.ts'
import { exportBoardTree, parseExportChildren, parseExportTheme, zipExport } from './exportPng.ts'

const PORT = Number(process.env.PORT) || 3001
const HOST = process.env.HOST || '127.0.0.1'
const isProd = process.env.NODE_ENV === 'production'

function statusOf(err: unknown) {
  return typeof err === 'object' && err && 'status' in err
    ? Number((err as { status: number }).status)
    : 500
}

const api = new Hono()

api.get('/health', async (c) => {
  await ensureApp()
  return c.json({ ok: true, workspace: dataDir() })
})

api.get('/workspaces', async (c) => {
  return c.json(await listAttachedWorkspaces())
})

api.post('/workspaces/attach', async (c) => {
  const body = await c.req.json().catch(() => ({})) as { path?: string; name?: string }
  if (!body.path || !body.path.trim()) {
    return c.json({ error: 'path is required' }, 400)
  }
  try {
    return c.json(await attachWorkspace(body.path, body.name), 201)
  } catch (err) {
    const status = statusOf(err)
    return c.json({ error: (err as Error).message }, status === 400 ? 400 : 500)
  }
})

api.post('/workspaces/switch', async (c) => {
  const body = await c.req.json().catch(() => ({})) as { id?: string; path?: string }
  if (!body.id && !body.path) {
    return c.json({ error: 'id or path is required' }, 400)
  }
  try {
    return c.json(await switchWorkspace(body))
  } catch (err) {
    const status = statusOf(err)
    return c.json({ error: (err as Error).message }, status === 404 ? 404 : status === 400 ? 400 : 500)
  }
})

api.delete('/workspaces/:id', async (c) => {
  try {
    return c.json(await detachWorkspace(c.req.param('id')))
  } catch (err) {
    const status = statusOf(err)
    return c.json({ error: (err as Error).message }, status === 400 ? 400 : status === 404 ? 404 : 500)
  }
})

api.get('/boards', async (c) => {
  const workspace = await listWorkspace()
  return c.json(workspace)
})

api.post('/boards', async (c) => {
  const body = await c.req.json().catch(() => ({})) as { title?: string }
  if (!body.title || !body.title.trim()) {
    return c.json({ error: 'title is required' }, 400)
  }
  const board = await createBoard(body.title)
  return c.json(board, 201)
})

api.get('/boards/:id', async (c) => {
  try {
    return c.json(await readBoard(c.req.param('id')))
  } catch (err) {
    const status = statusOf(err)
    return c.json({ error: (err as Error).message }, status === 404 ? 404 : 500)
  }
})

api.put('/boards/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => null) as BoardDocument | null
  if (!body || body.id !== id || !Array.isArray(body.nodes) || !Array.isArray(body.edges)) {
    return c.json({ error: 'Invalid board document' }, 400)
  }
  try {
    const source = parseEditSource(c.req.header('x-diagramkit-source') ?? c.req.query('source'))
    return c.json(await saveBoard(body, source))
  } catch (err) {
    const status = statusOf(err)
    return c.json({ error: (err as Error).message }, status === 404 ? 404 : 500)
  }
})

api.get('/boards/:id/history', async (c) => {
  try {
    return c.json(await getBoardHistory(c.req.param('id')))
  } catch (err) {
    const status = statusOf(err)
    return c.json({ error: (err as Error).message }, status === 404 ? 404 : 500)
  }
})

api.post('/boards/:id/undo', async (c) => {
  try {
    return c.json(await undoBoard(c.req.param('id')))
  } catch (err) {
    const status = statusOf(err)
    return c.json({ error: (err as Error).message }, status === 404 ? 404 : status === 409 ? 409 : 500)
  }
})

api.post('/boards/:id/redo', async (c) => {
  try {
    return c.json(await redoBoard(c.req.param('id')))
  } catch (err) {
    const status = statusOf(err)
    return c.json({ error: (err as Error).message }, status === 404 ? 404 : status === 409 ? 409 : 500)
  }
})

api.delete('/boards/:id', async (c) => {
  try {
    await deleteBoard(c.req.param('id'))
    return new Response(null, { status: 204 })
  } catch (err) {
    const status = statusOf(err)
    return c.json({ error: (err as Error).message }, status === 400 ? 400 : status === 404 ? 404 : 500)
  }
})

api.post('/boards/:id/export', async (c) => {
  const theme = parseExportTheme(c.req.query('theme'))
  const children = parseExportChildren(c.req.query('children'))
  try {
    const result = await exportBoardTree({ boardId: c.req.param('id'), theme, children })
    if (!children) {
      const file = result.files[0]
      if (!file) return c.json({ error: 'Board not found' }, 404)
      const payload = new Uint8Array(file.bytes.buffer, file.bytes.byteOffset, file.bytes.byteLength)
      return c.body(payload, 200, {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${file.filename}"`,
      })
    }
    const zip = await zipExport(result)
    const payload = new Uint8Array(zip.buffer, zip.byteOffset, zip.byteLength)
    return c.body(payload, 200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${result.zipName}"`,
    })
  } catch (err) {
    const status = statusOf(err)
    return c.json({ error: (err as Error).message }, status === 404 ? 404 : status === 409 ? 409 : 500)
  }
})

const app = new Hono()
app.route('/api', api)

if (isProd) {
  app.use('/*', serveStatic({ root: './dist' }))
}

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: err.message }, 500)
})

const server = serve({ fetch: app.fetch, port: PORT, hostname: HOST }, (info) => {
  void ensureApp().then(() => {
    const host = info.address === '::' || info.address === '0.0.0.0' ? 'localhost' : info.address
    console.log(`DiagramKit on http://${host}:${info.port}`)
    console.log(`Workspace: ${dataDir()}`)
    if (isProd) console.log(`Serving UI from ./dist`)
  })
})
if (typeof server === 'object' && server && 'requestTimeout' in server) {
  ;(server as { requestTimeout: number }).requestTimeout = 10 * 60 * 1000
}
