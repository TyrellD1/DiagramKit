import type { BoardDocument } from '../src/types.ts'

export const HISTORY_MAX_STEPS = 100
export const HISTORY_COALESCE_MS = 1000

export type BoardHistory = {
  undo: BoardDocument[]
  redo: BoardDocument[]
  lastEditAt: number
}

export const emptyHistory = (): BoardHistory => ({
  undo: [],
  redo: [],
  lastEditAt: 0,
})

function cloneBoard(board: BoardDocument): BoardDocument {
  return JSON.parse(JSON.stringify(board)) as BoardDocument
}

export function boardsAreEqual(a: BoardDocument, b: BoardDocument) {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function normalizeHistory(raw: unknown): BoardHistory {
  if (!raw || typeof raw !== 'object') return emptyHistory()
  const o = raw as Record<string, unknown>
  const undo = Array.isArray(o.undo) ? o.undo.filter(isBoardish).map(cloneBoard) : []
  const redo = Array.isArray(o.redo) ? o.redo.filter(isBoardish).map(cloneBoard) : []
  const lastEditAt = typeof o.lastEditAt === 'number' && Number.isFinite(o.lastEditAt) ? o.lastEditAt : 0
  return { undo, redo, lastEditAt }
}

function isBoardish(value: unknown): value is BoardDocument {
  if (!value || typeof value !== 'object') return false
  const o = value as Record<string, unknown>
  return typeof o.id === 'string' && Array.isArray(o.nodes) && Array.isArray(o.edges)
}

export function recordEdit(history: BoardHistory, previous: BoardDocument, now: number): BoardHistory {
  const coalescing = history.undo.length > 0 && now - history.lastEditAt < HISTORY_COALESCE_MS
  if (coalescing) {
    return { undo: history.undo, redo: history.redo, lastEditAt: now }
  }
  const undo = [...history.undo, cloneBoard(previous)]
  while (undo.length > HISTORY_MAX_STEPS) undo.shift()
  return { undo, redo: [], lastEditAt: now }
}

export function undoEdit(
  history: BoardHistory,
  current: BoardDocument,
): { history: BoardHistory; restored: BoardDocument } | null {
  if (history.undo.length === 0) return null
  const undo = history.undo.slice(0, -1)
  const restored = cloneBoard(history.undo[history.undo.length - 1])
  const redo = [...history.redo, cloneBoard(current)]
  while (redo.length > HISTORY_MAX_STEPS) redo.shift()
  return { history: { undo, redo, lastEditAt: 0 }, restored }
}

export function redoEdit(
  history: BoardHistory,
  current: BoardDocument,
): { history: BoardHistory; restored: BoardDocument } | null {
  if (history.redo.length === 0) return null
  const redo = history.redo.slice(0, -1)
  const restored = cloneBoard(history.redo[history.redo.length - 1])
  const undo = [...history.undo, cloneBoard(current)]
  while (undo.length > HISTORY_MAX_STEPS) undo.shift()
  return { history: { undo, redo, lastEditAt: 0 }, restored }
}

export function historyCounts(history: BoardHistory) {
  return { undoSteps: history.undo.length, redoSteps: history.redo.length }
}

export function isHistoryFileName(name: string) {
  return name.endsWith('.history.json')
}
