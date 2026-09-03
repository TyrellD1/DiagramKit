import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { validateWorkspace } from './schema.ts'

async function writeJson(file: string, data: unknown) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

const homeId = '11111111-1111-4111-8111-111111111111'
const childId = '22222222-2222-4222-8222-222222222222'

function emptyBoard(id: string, title: string) {
  return { schemaVersion: 1, id, title, nodes: [], edges: [] }
}

function validIndex() {
  return {
    rootBoardId: homeId,
    boards: [
      { id: homeId, title: 'Home' },
      { id: childId, title: 'Child' },
    ],
  }
}

function homeBoard() {
  return {
    schemaVersion: 1,
    id: homeId,
    title: 'Home',
    nodes: [
      {
        id: 'node-1',
        title: 'Child',
        description: null,
        x: 40,
        y: 80,
        enterBoardId: childId,
        childLink: { type: 'board', boardId: childId },
        refs: [{ id: 'ref-1', name: 'Docs', type: 'url', target: 'https://example.com' }],
      },
    ],
    edges: [],
  }
}

async function writeValid(root: string) {
  await writeJson(path.join(root, 'index.json'), validIndex())
  await writeJson(path.join(root, 'boards', `${homeId}.json`), homeBoard())
  await writeJson(path.join(root, 'boards', `${childId}.json`), emptyBoard(childId, 'Child'))
}

describe('validateWorkspace', () => {
  let dir: string

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  test('accepts a valid workspace', async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'dk-valid-'))
    await writeValid(dir)
    const result = await validateWorkspace(dir)
    expect(result.ok).toBe(true)
    expect(result.boardCount).toBe(2)
    expect(result.issues).toEqual([])
  })

  test('accepts a legacy board with no schemaVersion', async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'dk-legacy-'))
    await writeJson(path.join(dir, 'index.json'), {
      rootBoardId: homeId,
      boards: [{ id: homeId, title: 'Home' }],
    })
    await writeJson(path.join(dir, 'boards', `${homeId}.json`), {
      id: homeId,
      title: 'Home',
      nodes: [],
      edges: [],
    })
    const result = await validateWorkspace(dir)
    expect(result.ok).toBe(true)
  })

  test('reports missing index.json', async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'dk-empty-'))
    const result = await validateWorkspace(dir)
    expect(result.ok).toBe(false)
    expect(result.issues[0]?.file).toBe('index.json')
    expect(result.issues[0]?.message).toMatch(/missing index.json/)
  })

  test('reports unknown keys, missing files, and bad edges', async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'dk-bad-'))
    await writeJson(path.join(dir, 'index.json'), {
      rootBoardId: homeId,
      boards: [{ id: homeId, title: 'Home' }],
      extra: true,
    })
    await writeJson(path.join(dir, 'boards', `${homeId}.json`), {
      id: homeId,
      title: 'Home',
      nodes: [
        {
          id: 'node-1',
          title: 'A',
          description: null,
          x: 0,
          y: 0,
          enterBoardId: 'missing-board',
          childLink: { type: 'url', value: 'https://x.com', nope: 1 },
          refs: [],
          flavour: 'red',
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'node-1',
          target: 'nobody',
          sourceHandle: 'right',
          targetHandle: 'left',
          edgeType: 'arrow',
        },
      ],
    })
    await writeJson(path.join(dir, 'boards', 'orphan.json'), emptyBoard('orphan', 'Orphan'))

    const result = await validateWorkspace(dir)
    expect(result.ok).toBe(false)
    const messages = result.issues.map(i => `${i.file} ${i.path} ${i.message}`)
    expect(messages.some(m => m.includes('unknown key "extra"'))).toBe(true)
    expect(messages.some(m => m.includes('unknown key "flavour"'))).toBe(true)
    expect(messages.some(m => m.includes('unknown key "nope"'))).toBe(true)
    expect(messages.some(m => m.includes('missing-board'))).toBe(true)
    expect(messages.some(m => m.includes('nobody'))).toBe(true)
    expect(messages.some(m => m.includes('default') || m.includes('plain'))).toBe(true)
    expect(messages.some(m => m.includes('not listed in index.json'))).toBe(true)
  })

  test('reports JSON parse errors with a file pointer', async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'dk-json-'))
    await mkdir(path.join(dir, 'boards'), { recursive: true })
    await writeFile(path.join(dir, 'index.json'), '{ not json', 'utf8')
    const result = await validateWorkspace(dir)
    expect(result.ok).toBe(false)
    expect(result.issues[0]?.file).toBe('index.json')
    expect(result.issues[0]?.message).toMatch(/invalid JSON/)
  })

  test('accepts pastel color and borderStyle on a node', async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'dk-style-'))
    await writeJson(path.join(dir, 'index.json'), {
      rootBoardId: homeId,
      boards: [{ id: homeId, title: 'Home' }],
    })
    await writeJson(path.join(dir, 'boards', `${homeId}.json`), {
      schemaVersion: 2,
      id: homeId,
      title: 'Home',
      nodes: [{
        id: 'node-1',
        title: 'A',
        description: null,
        x: 0,
        y: 0,
        enterBoardId: null,
        childLink: null,
        refs: [],
        color: 'red',
        borderStyle: 'dashed',
      }],
      edges: [],
    })
    const result = await validateWorkspace(dir)
    expect(result.ok).toBe(true)
  })

  test('rejects invalid color and borderStyle', async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'dk-style-bad-'))
    await writeJson(path.join(dir, 'index.json'), {
      rootBoardId: homeId,
      boards: [{ id: homeId, title: 'Home' }],
    })
    await writeJson(path.join(dir, 'boards', `${homeId}.json`), {
      schemaVersion: 2,
      id: homeId,
      title: 'Home',
      nodes: [{
        id: 'node-1',
        title: 'A',
        description: null,
        x: 0,
        y: 0,
        enterBoardId: null,
        childLink: null,
        refs: [],
        color: 'purple',
        borderStyle: 'dotted',
      }],
      edges: [],
    })
    const result = await validateWorkspace(dir)
    expect(result.ok).toBe(false)
    const messages = result.issues.map(i => i.message)
    expect(messages.some(m => m.includes('red'))).toBe(true)
    expect(messages.some(m => m.includes('dashed'))).toBe(true)
  })
})
