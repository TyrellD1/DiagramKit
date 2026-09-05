import type { BoardSummary, WorkspaceIndex } from '../types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function slugTitle(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'board'
}

export function collectBoardTree(index: WorkspaceIndex, rootId: string): BoardSummary[] {
  const byId = new Map(index.boards.map(board => [board.id, board]))
  if (!byId.has(rootId)) return []

  const childrenOf = new Map<string, BoardSummary[]>()
  for (const board of index.boards) {
    if (!board.parentId || !byId.has(board.parentId)) continue
    const list = childrenOf.get(board.parentId) ?? []
    list.push(board)
    childrenOf.set(board.parentId, list)
  }

  const out: BoardSummary[] = []
  const seen = new Set<string>()
  const walk = (id: string) => {
    if (seen.has(id)) return
    seen.add(id)
    const board = byId.get(id)
    if (!board) return
    out.push(board)
    for (const child of childrenOf.get(id) ?? []) walk(child.id)
  }
  walk(rootId)
  return out
}

export interface NamedExportBoard {
  board: BoardSummary
  filename: string
}

/** DFS from root; filenames are ancestor slugs joined with `--`. Jump links are ignored. */
export function namedBoardTree(
  index: WorkspaceIndex,
  rootId: string,
  opts?: { children?: boolean },
): NamedExportBoard[] {
  const includeChildren = opts?.children !== false
  const boards = includeChildren
    ? collectBoardTree(index, rootId)
    : index.boards.filter(board => board.id === rootId)
  const byId = new Map(boards.map(board => [board.id, board]))
  const used = new Set<string>()

  const unique = (name: string, id: string) => {
    if (!used.has(name)) {
      used.add(name)
      return name
    }
    const tagged = `${name.replace(/\.png$/i, '')}-${id.slice(0, 8)}.png`
    used.add(tagged)
    return tagged
  }

  return boards.map(board => {
    const slugs: string[] = []
    const seen = new Set<string>()
    let current: BoardSummary | undefined = board
    while (current && !seen.has(current.id)) {
      seen.add(current.id)
      slugs.unshift(slugTitle(current.title))
      if (current.id === rootId) break
      current = current.parentId ? byId.get(current.parentId) : undefined
    }
    return { board, filename: unique(`${slugs.join('--')}.png`, board.id) }
  })
}

export function zipBasename(title: string): string {
  return `${slugTitle(title)}-export.zip`
}

export function pngBasename(title: string): string {
  return `${slugTitle(title)}.png`
}

export function resolveBoardRef(index: WorkspaceIndex, ref?: string | null): BoardSummary {
  if (!ref || !ref.trim()) {
    const root = index.boards.find(board => board.id === index.rootBoardId)
    if (!root) throw new Error('Workspace has no root board')
    return root
  }
  const value = ref.trim()
  if (UUID_RE.test(value)) {
    const byId = index.boards.find(board => board.id === value)
    if (!byId) throw Object.assign(new Error(`Board not found: ${value}`), { status: 404 })
    return byId
  }
  const matches = index.boards.filter(board => board.title.toLowerCase() === value.toLowerCase())
  if (matches.length === 1) return matches[0]!
  if (matches.length > 1) {
    throw new Error(`Multiple boards titled "${value}". Pass a board id.`)
  }
  throw Object.assign(new Error(`Board not found: ${value}`), { status: 404 })
}
