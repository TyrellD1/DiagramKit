import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { currentSchemaVersion } from '../migrations/run.ts'
import { isHistoryFileName } from '../server/boardHistory.ts'
import { expandPath } from '../server/store.ts'
import { CARD_BORDER_STYLES, CARD_COLORS, isCardBorderStyle, isCardColor } from '../src/lib/cardStyle.ts'

export interface SchemaIssue {
  file: string
  path: string
  message: string
}

export interface ValidateResult {
  ok: boolean
  path: string
  boardCount: number
  issues: SchemaIssue[]
}

const INDEX_KEYS = new Set(['rootBoardId', 'boards'])
const INDEX_BOARD_KEYS = new Set(['id', 'title'])
const BOARD_KEYS = new Set(['schemaVersion', 'id', 'title', 'nodes', 'edges'])
const NODE_KEYS = new Set(['id', 'title', 'description', 'x', 'y', 'enterBoardId', 'childLink', 'refs', 'color', 'borderStyle'])
const EDGE_KEYS = new Set(['id', 'source', 'target', 'sourceHandle', 'targetHandle', 'edgeType'])
const REF_KEYS = new Set(['id', 'name', 'type', 'target'])
const URL_LINK_KEYS = new Set(['type', 'value'])
const PATH_LINK_KEYS = new Set(['type', 'path'])
const BOARD_LINK_KEYS = new Set(['type', 'boardId'])
const HANDLES = new Set(['top', 'left', 'bottom', 'right'])
const EDGE_TYPES = new Set(['default', 'plain'])
const LINK_TYPES = new Set(['url', 'cursor', 'open', 'board'])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function extraKeys(obj: Record<string, unknown>, allowed: Set<string>) {
  return Object.keys(obj).filter(key => !allowed.has(key))
}

export async function validateWorkspace(rawPath: string): Promise<ValidateResult> {
  const issues: SchemaIssue[] = []
  const root = expandPath(rawPath)

  const push = (file: string, jsonPath: string, message: string) => {
    issues.push({ file, path: jsonPath, message })
  }

  try {
    const info = await stat(root)
    if (!info.isDirectory()) {
      return {
        ok: false,
        path: root,
        boardCount: 0,
        issues: [{ file: '.', path: '$', message: `not a directory: ${root}` }],
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        ok: false,
        path: root,
        boardCount: 0,
        issues: [{ file: '.', path: '$', message: `path does not exist: ${root}` }],
      }
    }
    throw err
  }

  const indexFile = path.join(root, 'index.json')
  let rawIndex: string
  try {
    rawIndex = await readFile(indexFile, 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      push('index.json', '$', 'missing index.json (not a DiagramKit workspace)')
      return { ok: false, path: root, boardCount: 0, issues }
    }
    throw err
  }

  let indexData: unknown
  try {
    indexData = JSON.parse(rawIndex)
  } catch (err) {
    push('index.json', '$', `invalid JSON: ${(err as Error).message}`)
    return { ok: false, path: root, boardCount: 0, issues }
  }

  if (!isPlainObject(indexData)) {
    push('index.json', '$', 'expected an object')
    return { ok: false, path: root, boardCount: 0, issues }
  }

  for (const key of extraKeys(indexData, INDEX_KEYS)) {
    push('index.json', `$.${key}`, `unknown key "${key}"`)
  }

  if (typeof indexData.rootBoardId !== 'string' || !indexData.rootBoardId.trim()) {
    push('index.json', '$.rootBoardId', 'expected a non-empty string')
  }

  if (!Array.isArray(indexData.boards)) {
    push('index.json', '$.boards', 'expected an array')
    return { ok: false, path: root, boardCount: 0, issues }
  }

  const indexIds = new Set<string>()
  const titlesById = new Map<string, string>()

  indexData.boards.forEach((entry, i) => {
    const p = `$.boards[${i}]`
    if (!isPlainObject(entry)) {
      push('index.json', p, 'expected an object { id, title }')
      return
    }
    for (const key of extraKeys(entry, INDEX_BOARD_KEYS)) {
      push('index.json', `${p}.${key}`, `unknown key "${key}"`)
    }
    if (typeof entry.id !== 'string' || !entry.id.trim()) {
      push('index.json', `${p}.id`, 'expected a non-empty string')
      return
    }
    if (indexIds.has(entry.id)) {
      push('index.json', `${p}.id`, `duplicate board id "${entry.id}"`)
    }
    indexIds.add(entry.id)
    if (typeof entry.title !== 'string') {
      push('index.json', `${p}.title`, 'expected a string')
    } else {
      titlesById.set(entry.id, entry.title)
    }
  })

  if (typeof indexData.rootBoardId === 'string' && indexData.rootBoardId && !indexIds.has(indexData.rootBoardId)) {
    push('index.json', '$.rootBoardId', `root board "${indexData.rootBoardId}" is not listed in boards`)
  }

  const boardsDir = path.join(root, 'boards')
  let boardFiles: string[] = []
  try {
    const info = await stat(boardsDir)
    if (!info.isDirectory()) {
      push('boards', '$', 'boards exists but is not a directory')
    } else {
      boardFiles = (await readdir(boardsDir)).filter(name => name.endsWith('.json') && !isHistoryFileName(name))
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      push('boards', '$', 'missing boards/ directory')
    } else {
      throw err
    }
  }

  const fileIds = new Set(boardFiles.map(name => name.slice(0, -5)))

  for (const id of indexIds) {
    if (!fileIds.has(id)) {
      push(`boards/${id}.json`, '$', 'listed in index.json but the board file is missing')
    }
  }

  for (const id of fileIds) {
    if (!indexIds.has(id)) {
      push(`boards/${id}.json`, '$', 'board file is not listed in index.json')
    }
  }

  for (const id of indexIds) {
    if (!fileIds.has(id)) continue
    await validateBoardFile(path.join(boardsDir, `${id}.json`), id, titlesById.get(id), indexIds, push)
  }

  return {
    ok: issues.length === 0,
    path: root,
    boardCount: indexIds.size,
    issues,
  }
}

async function validateBoardFile(
  filePath: string,
  expectedId: string,
  expectedTitle: string | undefined,
  boardIds: Set<string>,
  push: (file: string, jsonPath: string, message: string) => void,
) {
  const file = `boards/${expectedId}.json`
  let raw: string
  try {
    raw = await readFile(filePath, 'utf8')
  } catch (err) {
    push(file, '$', `could not read file: ${(err as Error).message}`)
    return
  }

  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch (err) {
    push(file, '$', `invalid JSON: ${(err as Error).message}`)
    return
  }

  if (!isPlainObject(data)) {
    push(file, '$', 'expected an object')
    return
  }

  for (const key of extraKeys(data, BOARD_KEYS)) {
    push(file, `$.${key}`, `unknown key "${key}"`)
  }

  if (data.schemaVersion !== undefined) {
    const current = currentSchemaVersion()
    if (typeof data.schemaVersion !== 'number' || !Number.isInteger(data.schemaVersion) || data.schemaVersion < 1) {
      push(file, '$.schemaVersion', 'expected a positive integer')
    } else if (data.schemaVersion > current) {
      push(file, '$.schemaVersion', `newer than this DiagramKit (current is ${current})`)
    }
  }

  if (data.id !== expectedId) {
    push(file, '$.id', `expected "${expectedId}" (must match filename and index.json)`)
  }
  if (typeof data.title !== 'string') {
    push(file, '$.title', 'expected a string')
  } else if (expectedTitle !== undefined && data.title !== expectedTitle) {
    push(file, '$.title', `does not match index.json title "${expectedTitle}"`)
  }

  if (!Array.isArray(data.nodes)) {
    push(file, '$.nodes', 'expected an array')
  }
  if (!Array.isArray(data.edges)) {
    push(file, '$.edges', 'expected an array')
  }

  const nodeIds = new Set<string>()
  if (Array.isArray(data.nodes)) {
    data.nodes.forEach((node, i) => validateNode(file, `$.nodes[${i}]`, node, nodeIds, boardIds, push))
  }

  const edgeIds = new Set<string>()
  if (Array.isArray(data.edges)) {
    data.edges.forEach((edge, i) => validateEdge(file, `$.edges[${i}]`, edge, nodeIds, edgeIds, push))
  }
}

function validateNode(
  file: string,
  jsonPath: string,
  node: unknown,
  nodeIds: Set<string>,
  boardIds: Set<string>,
  push: (file: string, jsonPath: string, message: string) => void,
) {
  if (!isPlainObject(node)) {
    push(file, jsonPath, 'expected an object')
    return
  }

  for (const key of extraKeys(node, NODE_KEYS)) {
    push(file, `${jsonPath}.${key}`, `unknown key "${key}"`)
  }

  if (typeof node.id !== 'string' || !node.id.trim()) {
    push(file, `${jsonPath}.id`, 'expected a non-empty string')
  } else if (nodeIds.has(node.id)) {
    push(file, `${jsonPath}.id`, `duplicate node id "${node.id}"`)
  } else {
    nodeIds.add(node.id)
  }

  if (typeof node.title !== 'string') {
    push(file, `${jsonPath}.title`, 'expected a string')
  }

  if (node.description !== null && typeof node.description !== 'string') {
    push(file, `${jsonPath}.description`, 'expected a string or null')
  }

  if (typeof node.x !== 'number' || !Number.isFinite(node.x)) {
    push(file, `${jsonPath}.x`, 'expected a finite number')
  }
  if (typeof node.y !== 'number' || !Number.isFinite(node.y)) {
    push(file, `${jsonPath}.y`, 'expected a finite number')
  }

  if (node.enterBoardId !== null && typeof node.enterBoardId !== 'string') {
    push(file, `${jsonPath}.enterBoardId`, 'expected a string or null')
  } else if (typeof node.enterBoardId === 'string' && node.enterBoardId && !boardIds.has(node.enterBoardId)) {
    push(file, `${jsonPath}.enterBoardId`, `board "${node.enterBoardId}" is not in this workspace`)
  }

  if (node.color !== undefined && !isCardColor(node.color)) {
    push(file, `${jsonPath}.color`, `expected "${CARD_COLORS.join('" | "')}"`)
  }
  if (node.borderStyle !== undefined && !isCardBorderStyle(node.borderStyle)) {
    push(file, `${jsonPath}.borderStyle`, `expected "${CARD_BORDER_STYLES.join('" | "')}"`)
  }

  validateChildLink(file, `${jsonPath}.childLink`, node.childLink, boardIds, push)

  if (!Array.isArray(node.refs)) {
    push(file, `${jsonPath}.refs`, 'expected an array')
    return
  }

  const refIds = new Set<string>()
  node.refs.forEach((ref, i) => validateRef(file, `${jsonPath}.refs[${i}]`, ref, refIds, boardIds, push))
}

function validateChildLink(
  file: string,
  jsonPath: string,
  link: unknown,
  boardIds: Set<string>,
  push: (file: string, jsonPath: string, message: string) => void,
) {
  if (link === null || link === undefined) {
    if (link === undefined) push(file, jsonPath, 'expected an object or null')
    return
  }
  if (!isPlainObject(link)) {
    push(file, jsonPath, 'expected an object or null')
    return
  }

  const type = link.type
  if (typeof type !== 'string' || !LINK_TYPES.has(type)) {
    push(file, `${jsonPath}.type`, 'expected "url" | "cursor" | "open" | "board"')
    return
  }

  if (type === 'url') {
    for (const key of extraKeys(link, URL_LINK_KEYS)) {
      push(file, `${jsonPath}.${key}`, `unknown key "${key}"`)
    }
    if (typeof link.value !== 'string' || !link.value.trim()) {
      push(file, `${jsonPath}.value`, 'expected a non-empty string')
    }
    return
  }

  if (type === 'cursor' || type === 'open') {
    for (const key of extraKeys(link, PATH_LINK_KEYS)) {
      push(file, `${jsonPath}.${key}`, `unknown key "${key}"`)
    }
    if (typeof link.path !== 'string' || !link.path.trim()) {
      push(file, `${jsonPath}.path`, 'expected a non-empty string')
    }
    return
  }

  for (const key of extraKeys(link, BOARD_LINK_KEYS)) {
    push(file, `${jsonPath}.${key}`, `unknown key "${key}"`)
  }
  if (typeof link.boardId !== 'string' || !link.boardId.trim()) {
    push(file, `${jsonPath}.boardId`, 'expected a non-empty string')
  } else if (!boardIds.has(link.boardId)) {
    push(file, `${jsonPath}.boardId`, `board "${link.boardId}" is not in this workspace`)
  }
}

function validateRef(
  file: string,
  jsonPath: string,
  ref: unknown,
  refIds: Set<string>,
  boardIds: Set<string>,
  push: (file: string, jsonPath: string, message: string) => void,
) {
  if (!isPlainObject(ref)) {
    push(file, jsonPath, 'expected an object')
    return
  }

  for (const key of extraKeys(ref, REF_KEYS)) {
    push(file, `${jsonPath}.${key}`, `unknown key "${key}"`)
  }

  if (typeof ref.id !== 'string' || !ref.id.trim()) {
    push(file, `${jsonPath}.id`, 'expected a non-empty string')
  } else if (refIds.has(ref.id)) {
    push(file, `${jsonPath}.id`, `duplicate ref id "${ref.id}"`)
  } else {
    refIds.add(ref.id)
  }

  if (typeof ref.name !== 'string') {
    push(file, `${jsonPath}.name`, 'expected a string')
  }

  if (typeof ref.type !== 'string' || !LINK_TYPES.has(ref.type)) {
    push(file, `${jsonPath}.type`, 'expected "url" | "cursor" | "open" | "board"')
  }

  if (typeof ref.target !== 'string' || !ref.target.trim()) {
    push(file, `${jsonPath}.target`, 'expected a non-empty string')
  } else if (ref.type === 'board' && !boardIds.has(ref.target)) {
    push(file, `${jsonPath}.target`, `board "${ref.target}" is not in this workspace`)
  }
}

function validateEdge(
  file: string,
  jsonPath: string,
  edge: unknown,
  nodeIds: Set<string>,
  edgeIds: Set<string>,
  push: (file: string, jsonPath: string, message: string) => void,
) {
  if (!isPlainObject(edge)) {
    push(file, jsonPath, 'expected an object')
    return
  }

  for (const key of extraKeys(edge, EDGE_KEYS)) {
    push(file, `${jsonPath}.${key}`, `unknown key "${key}"`)
  }

  if (typeof edge.id !== 'string' || !edge.id.trim()) {
    push(file, `${jsonPath}.id`, 'expected a non-empty string')
  } else if (edgeIds.has(edge.id)) {
    push(file, `${jsonPath}.id`, `duplicate edge id "${edge.id}"`)
  } else {
    edgeIds.add(edge.id)
  }

  if (typeof edge.source !== 'string' || !edge.source.trim()) {
    push(file, `${jsonPath}.source`, 'expected a non-empty string')
  } else if (!nodeIds.has(edge.source)) {
    push(file, `${jsonPath}.source`, `source node "${edge.source}" does not exist on this board`)
  }

  if (typeof edge.target !== 'string' || !edge.target.trim()) {
    push(file, `${jsonPath}.target`, 'expected a non-empty string')
  } else if (!nodeIds.has(edge.target)) {
    push(file, `${jsonPath}.target`, `target node "${edge.target}" does not exist on this board`)
  }

  validateHandle(file, `${jsonPath}.sourceHandle`, edge.sourceHandle, push)
  validateHandle(file, `${jsonPath}.targetHandle`, edge.targetHandle, push)

  if (typeof edge.edgeType !== 'string' || !EDGE_TYPES.has(edge.edgeType)) {
    push(file, `${jsonPath}.edgeType`, 'expected "default" or "plain"')
  }
}

function validateHandle(
  file: string,
  jsonPath: string,
  handle: unknown,
  push: (file: string, jsonPath: string, message: string) => void,
) {
  if (handle === null) return
  if (typeof handle !== 'string' || !HANDLES.has(handle)) {
    push(file, jsonPath, 'expected "top" | "left" | "bottom" | "right" or null')
  }
}
