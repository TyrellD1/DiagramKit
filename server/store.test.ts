import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import {
  attachWorkspace,
  createBoard,
  detachWorkspace,
  ensureSeed,
  listAttachedWorkspaces,
  listWorkspace,
  probeWorkspace,
  readBoard,
  saveBoard,
  scaffoldWorkspace,
  switchWorkspace,
} from './store.ts'
import { currentSchemaVersion } from '../migrations/run.ts'

describe('json board store', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'diagramkit-'))
    process.env.DIAGRAMKIT_HOME = dir
    delete process.env.DIAGRAMKIT_DATA_DIR
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
    delete process.env.DIAGRAMKIT_HOME
  })

  test('seeds a Home board on first use', async () => {
    await ensureSeed()
    const workspace = await listWorkspace()
    expect(workspace.boards).toHaveLength(1)
    expect(workspace.boards[0].title).toBe('Home')
    expect(workspace.rootBoardId).toBe(workspace.boards[0].id)

    const board = await readBoard(workspace.rootBoardId)
    expect(board.schemaVersion).toBe(currentSchemaVersion())
    expect(board.nodes).toEqual([])
    expect(board.edges).toEqual([])
  })

  test('creates a board and derives parent from enterBoardId', async () => {
    const workspace = await listWorkspace()
    const child = await createBoard('Projects')
    const home = await readBoard(workspace.rootBoardId)
    home.nodes.push({
      id: 'node-1',
      title: 'Projects',
      description: null,
      x: 40,
      y: 80,
      enterBoardId: child.id,
      childLink: null,
      refs: [],
      color: 'default',
      borderStyle: 'solid',
    })
    await saveBoard(home)

    const listed = await listWorkspace()
    const projects = listed.boards.find(b => b.id === child.id)
    expect(projects?.parentId).toBe(workspace.rootBoardId)
  })

  test('writes JSON atomically', async () => {
    const workspace = await listWorkspace()
    const board = await readBoard(workspace.rootBoardId)
    board.title = 'HQ'
    await saveBoard(board)
    const raw = await readFile(path.join(dir, 'index.json'), 'utf8')
    expect(raw).toContain('HQ')
    expect(raw).not.toContain('.tmp')
  })

  test('attach switches board files without writing into the default workspace', async () => {
    const original = await listWorkspace()
    const other = await mkdtemp(path.join(os.tmpdir(), 'diagramkit-ws-'))
    try {
      const attached = await attachWorkspace(other, 'Sandbox')
      expect(attached.activePath).toBe(other)
      expect(attached.workspaces).toHaveLength(2)

      await createBoard('OnlyInSandbox')
      const sandboxBoards = await listWorkspace()
      expect(sandboxBoards.boards.some(b => b.title === 'OnlyInSandbox')).toBe(true)

      const defaultIndex = await readFile(path.join(dir, 'index.json'), 'utf8')
      expect(defaultIndex).not.toContain('OnlyInSandbox')

      await switchWorkspace({ id: 'default' })
      const back = await listWorkspace()
      expect(back.rootBoardId).toBe(original.rootBoardId)
      expect(back.boards.some(b => b.title === 'OnlyInSandbox')).toBe(false)
    } finally {
      await rm(other, { recursive: true, force: true })
    }
  })

  test('scaffoldWorkspace creates files without attaching', async () => {
    await ensureSeed()
    const other = await mkdtemp(path.join(os.tmpdir(), 'diagramkit-scaffold-'))
    try {
      const created = await scaffoldWorkspace(other)
      const index = JSON.parse(await readFile(path.join(created, 'index.json'), 'utf8')) as { boards: Array<{ title: string }> }
      expect(index.boards[0]?.title).toBe('Home')
      const list = await listAttachedWorkspaces()
      expect(list.workspaces).toHaveLength(1)
      expect(list.workspaces[0]?.kind).toBe('default')
      await expect(scaffoldWorkspace(other)).rejects.toThrow(/Already a DiagramKit workspace/)
    } finally {
      await rm(other, { recursive: true, force: true })
    }
  })

  test('probeWorkspace distinguishes missing, empty, and seeded dirs', async () => {
    const missing = path.join(dir, 'nope')
    expect(await probeWorkspace(missing)).toMatchObject({ exists: false, isWorkspace: false })

    const empty = await mkdtemp(path.join(os.tmpdir(), 'diagramkit-empty-'))
    try {
      expect(await probeWorkspace(empty)).toMatchObject({ exists: true, isDirectory: true, isWorkspace: false })
      await scaffoldWorkspace(empty)
      expect(await probeWorkspace(empty)).toMatchObject({ isWorkspace: true })
    } finally {
      await rm(empty, { recursive: true, force: true })
    }
  })

  test('cannot detach the default workspace', async () => {
    await ensureSeed()
    await expect(detachWorkspace('default')).rejects.toThrow('Cannot detach the default workspace')
    const list = await listAttachedWorkspaces()
    expect(list.workspaces.some(w => w.id === 'default')).toBe(true)
  })

  test('migrates a legacy board on read and persists schemaVersion', async () => {
    const workspace = await listWorkspace()
    const file = path.join(dir, 'boards', `${workspace.rootBoardId}.json`)
    await writeFile(file, JSON.stringify({
      id: workspace.rootBoardId,
      title: 'Home',
      nodes: [{
        id: 'n1',
        title: 'A',
        description: null,
        x: 0,
        y: 0,
        enterBoardId: null,
        childLink: null,
        refs: [],
      }],
      edges: [],
    }, null, 2) + '\n')

    const board = await readBoard(workspace.rootBoardId)
    expect(board.schemaVersion).toBe(currentSchemaVersion())
    expect(board.nodes[0]).toMatchObject({ color: 'default', borderStyle: 'solid' })

    const raw = JSON.parse(await readFile(file, 'utf8')) as { schemaVersion: number }
    expect(raw.schemaVersion).toBe(currentSchemaVersion())
  })
})
