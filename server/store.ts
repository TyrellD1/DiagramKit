import { mkdir, readFile, writeFile, rename, unlink, cp, stat } from 'node:fs/promises'
import path from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'
import type {
  BoardDocument,
  StoredIndex,
  WorkspaceIndex,
  WorkspaceList,
  WorkspaceRecord,
} from '../src/types.ts'

interface WorkspaceRegistry {
  activePath: string
  workspaces: WorkspaceRecord[]
}

const DEFAULT_WORKSPACE_ID = 'default'

let activeWorkspaceDir: string | null = null

function fail(message: string, status: number): never {
  const err = new Error(message) as Error & { status: number }
  err.status = status
  throw err
}

export function appDir() {
  return process.env.DIAGRAMKIT_HOME || process.env.DIAGRAMKIT_DATA_DIR || path.join(homedir(), '.diagramkit')
}

export function dataDir() {
  return activeWorkspaceDir || appDir()
}

export function expandPath(input: string) {
  const trimmed = input.trim()
  if (!trimmed) fail('path is required', 400)
  if (trimmed === '~') return homedir()
  if (trimmed.startsWith('~/')) return path.join(homedir(), trimmed.slice(2))
  return path.resolve(trimmed)
}

function registryPath() {
  return path.join(appDir(), 'workspaces.json')
}

function indexPathFor(root: string) {
  return path.join(root, 'index.json')
}

function boardsDirFor(root: string) {
  return path.join(root, 'boards')
}

function boardPathFor(root: string, id: string) {
  return path.join(boardsDirFor(root), `${id}.json`)
}

function indexPath() {
  return indexPathFor(dataDir())
}

function boardsDir() {
  return boardsDirFor(dataDir())
}

function boardPath(id: string) {
  return boardPathFor(dataDir(), id)
}

async function writeJsonAtomic(file: string, data: unknown) {
  await mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.${randomUUID()}.tmp`
  await writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8')
  await rename(tmp, file)
}

async function readJson<T>(file: string): Promise<T> {
  const raw = await readFile(file, 'utf8')
  return JSON.parse(raw) as T
}

function emptyBoard(id: string, title: string): BoardDocument {
  return { id, title, nodes: [], edges: [] }
}

function defaultRecord(): WorkspaceRecord {
  const dir = appDir()
  return {
    id: DEFAULT_WORKSPACE_ID,
    path: dir,
    name: 'Default',
    kind: 'default',
    attachedAt: new Date().toISOString(),
  }
}

async function maybeMigrateLegacy() {
  if (process.env.DIAGRAMKIT_HOME || process.env.DIAGRAMKIT_DATA_DIR) return

  const destIndex = indexPathFor(appDir())
  try {
    await readFile(destIndex)
    return
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }

  const legacyIndex = path.join(process.cwd(), 'data', 'index.json')
  try {
    await readFile(legacyIndex)
  } catch {
    return
  }

  await mkdir(appDir(), { recursive: true })
  await cp(path.join(process.cwd(), 'data'), appDir(), { recursive: true })
}

async function seedWorkspace(root: string) {
  await mkdir(boardsDirFor(root), { recursive: true })
  try {
    await readFile(indexPathFor(root))
    return
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }

  const id = randomUUID()
  const board = emptyBoard(id, 'Home')
  await writeJsonAtomic(boardPathFor(root, id), board)
  await writeJsonAtomic(indexPathFor(root), { rootBoardId: id, boards: [{ id, title: board.title }] })
}

export async function probeWorkspace(rawPath: string) {
  const resolved = expandPath(rawPath)
  try {
    const info = await stat(resolved)
    if (!info.isDirectory()) {
      return { path: resolved, exists: true, isDirectory: false, isWorkspace: false }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { path: resolved, exists: false, isDirectory: false, isWorkspace: false }
    }
    throw err
  }

  try {
    await readFile(indexPathFor(resolved))
    return { path: resolved, exists: true, isDirectory: true, isWorkspace: true }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    return { path: resolved, exists: true, isDirectory: true, isWorkspace: false }
  }
}

export async function scaffoldWorkspace(rawPath: string) {
  const probe = await probeWorkspace(rawPath)
  if (probe.exists && !probe.isDirectory) {
    fail(`${probe.path} exists and is not a directory`, 400)
  }
  if (probe.isWorkspace) {
    fail(`Already a DiagramKit workspace. Open it with: diagramkit open ${probe.path}`, 400)
  }
  await mkdir(probe.path, { recursive: true })
  await seedWorkspace(probe.path)
  return probe.path
}

async function readRegistry(): Promise<WorkspaceRegistry> {
  try {
    const raw = await readJson<WorkspaceRegistry>(registryPath())
    if (!raw || !Array.isArray(raw.workspaces) || raw.workspaces.length === 0) {
      throw Object.assign(new Error('missing'), { code: 'ENOENT' })
    }
    return raw
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    const record = defaultRecord()
    const registry: WorkspaceRegistry = { activePath: record.path, workspaces: [record] }
    await writeJsonAtomic(registryPath(), registry)
    return registry
  }
}

async function writeRegistry(registry: WorkspaceRegistry) {
  await writeJsonAtomic(registryPath(), registry)
  activeWorkspaceDir = registry.activePath
}

function toList(registry: WorkspaceRegistry): WorkspaceList {
  return {
    homeDir: homedir(),
    appDir: appDir(),
    activePath: registry.activePath,
    workspaces: registry.workspaces,
  }
}

export async function ensureApp() {
  await mkdir(appDir(), { recursive: true })
  await maybeMigrateLegacy()
  const registry = await readRegistry()
  let dirty = false

  let def = registry.workspaces.find(w => w.id === DEFAULT_WORKSPACE_ID)
  if (!def) {
    def = defaultRecord()
    registry.workspaces.unshift(def)
    dirty = true
  }
  if (def.path !== appDir()) {
    if (registry.activePath === def.path) registry.activePath = appDir()
    def.path = appDir()
    def.kind = 'default'
    dirty = true
  }
  if (!registry.workspaces.some(w => w.path === registry.activePath)) {
    registry.activePath = def.path
    dirty = true
  }

  await seedWorkspace(def.path)
  if (registry.activePath !== def.path) await seedWorkspace(registry.activePath)

  if (dirty) await writeRegistry(registry)
  else activeWorkspaceDir = registry.activePath

  return registry
}

export async function ensureSeed() {
  await ensureApp()
}

async function readIndex(): Promise<StoredIndex> {
  return readJson<StoredIndex>(indexPath())
}

async function writeIndex(index: StoredIndex) {
  await writeJsonAtomic(indexPath(), index)
}

export async function listAttachedWorkspaces(): Promise<WorkspaceList> {
  const registry = await ensureApp()
  return toList(registry)
}

export async function attachWorkspace(rawPath: string, name?: string): Promise<WorkspaceList> {
  const registry = await ensureApp()
  const resolved = expandPath(rawPath)

  try {
    const info = await stat(resolved)
    if (!info.isDirectory()) fail('path must be a directory', 400)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    await mkdir(resolved, { recursive: true })
  }

  const existing = registry.workspaces.find(w => w.path === resolved)
  if (existing) {
    if (name?.trim()) existing.name = name.trim()
    registry.activePath = existing.path
    await seedWorkspace(existing.path)
    await writeRegistry(registry)
    return toList(registry)
  }

  if (resolved === appDir()) {
    registry.activePath = appDir()
    await writeRegistry(registry)
    return toList(registry)
  }

  const record: WorkspaceRecord = {
    id: randomUUID(),
    path: resolved,
    name: name?.trim() || path.basename(resolved).replace(/^\./, '') || resolved,
    kind: 'attached',
    attachedAt: new Date().toISOString(),
  }
  registry.workspaces.push(record)
  registry.activePath = record.path
  await seedWorkspace(record.path)
  await writeRegistry(registry)
  return toList(registry)
}

export async function switchWorkspace(target: { id?: string; path?: string }): Promise<WorkspaceList> {
  const registry = await ensureApp()
  const resolved = target.path ? expandPath(target.path) : undefined
  const found = registry.workspaces.find(w =>
    (target.id && w.id === target.id) || (resolved && w.path === resolved),
  )
  if (!found) fail('Workspace not found', 404)
  registry.activePath = found.path
  await seedWorkspace(found.path)
  await writeRegistry(registry)
  return toList(registry)
}

export async function detachWorkspace(id: string): Promise<WorkspaceList> {
  const registry = await ensureApp()
  const found = registry.workspaces.find(w => w.id === id)
  if (!found) fail('Workspace not found', 404)
  if (found.kind === 'default' || found.id === DEFAULT_WORKSPACE_ID) {
    fail('Cannot detach the default workspace', 400)
  }
  registry.workspaces = registry.workspaces.filter(w => w.id !== id)
  if (registry.activePath === found.path) {
    const def = registry.workspaces.find(w => w.kind === 'default') ?? defaultRecord()
    registry.activePath = def.path
  }
  await writeRegistry(registry)
  return toList(registry)
}

export async function readBoard(id: string): Promise<BoardDocument> {
  await ensureSeed()
  try {
    return await readJson<BoardDocument>(boardPath(id))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') fail('Board not found', 404)
    throw err
  }
}

export async function saveBoard(board: BoardDocument): Promise<BoardDocument> {
  await ensureSeed()
  const index = await readIndex()
  const known = index.boards.some(b => b.id === board.id)
  if (!known) fail('Board not found', 404)

  await writeJsonAtomic(boardPath(board.id), board)
  index.boards = index.boards.map(b =>
    b.id === board.id ? { id: b.id, title: board.title } : b,
  )
  await writeIndex(index)
  return board
}

export async function createBoard(title: string): Promise<BoardDocument> {
  await ensureSeed()
  const id = randomUUID()
  const board = emptyBoard(id, title.trim() || 'Untitled')
  const index = await readIndex()
  index.boards.push({ id, title: board.title })
  await writeJsonAtomic(boardPath(id), board)
  await writeIndex(index)
  return board
}

export async function deleteBoard(id: string): Promise<void> {
  await ensureSeed()
  const index = await readIndex()
  if (id === index.rootBoardId) fail('Cannot delete the root board', 400)
  if (!index.boards.some(b => b.id === id)) fail('Board not found', 404)

  index.boards = index.boards.filter(b => b.id !== id)
  await writeIndex(index)
  try {
    await unlink(boardPath(id))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
}

export async function listWorkspace(): Promise<WorkspaceIndex> {
  await ensureSeed()
  const index = await readIndex()
  const parentById = new Map<string, string>()

  for (const entry of index.boards) {
    try {
      const doc = await readJson<BoardDocument>(boardPath(entry.id))
      for (const node of doc.nodes) {
        if (node.enterBoardId) parentById.set(node.enterBoardId, doc.id)
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }
  }

  return {
    rootBoardId: index.rootBoardId,
    boards: index.boards.map(b => ({
      id: b.id,
      title: b.title,
      parentId: parentById.get(b.id) ?? null,
    })),
  }
}
