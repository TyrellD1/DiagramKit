import type { BoardSummary, WorkspaceIndex } from '@/types'

export interface BoardStackEntry {
  boardId: string
  boardTitle: string
  viewport: { x: number; y: number; zoom: number }
}

const ZERO = { x: 0, y: 0, zoom: 1 }

/** Breadcrumb path from the workspace root to a board, via parentId. */
export function boardPath(index: WorkspaceIndex, boardId: string): BoardStackEntry[] {
  const byId = new Map(index.boards.map(board => [board.id, board]))
  const target = byId.get(boardId) ?? byId.get(index.rootBoardId)
  if (!target) return []

  const chain: BoardSummary[] = []
  const seen = new Set<string>()
  let current = target
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    chain.unshift(current)
    if (current.id === index.rootBoardId || !current.parentId) break
    const parent = byId.get(current.parentId)
    if (!parent) break
    current = parent
  }

  if (chain[0]?.id !== index.rootBoardId) {
    const root = byId.get(index.rootBoardId)
    if (root) chain.unshift(root)
  }

  return chain.map(board => ({
    boardId: board.id,
    boardTitle: board.title,
    viewport: { ...ZERO },
  }))
}

export function advanceStack(
  prev: BoardStackEntry[],
  index: WorkspaceIndex,
  boardId: string,
  title?: string,
): BoardStackEntry[] {
  const existing = prev.findIndex(entry => entry.boardId === boardId)
  if (existing >= 0) return prev.slice(0, existing + 1)
  if (prev.length === 0) return boardPath(index, boardId)
  const named = title ?? index.boards.find(board => board.id === boardId)?.title ?? 'Board'
  return [...prev, { boardId, boardTitle: named, viewport: { ...ZERO } }]
}
