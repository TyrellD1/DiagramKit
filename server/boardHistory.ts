import type {
  BoardDocument,
  BoardHistoryView,
  EditSource,
  HistorySource,
  HistoryStepSummary,
} from '../src/types.ts'

export const HISTORY_MAX_STEPS = 100
export const HISTORY_COALESCE_MS = 1000

export type HistoryStep = {
  board: BoardDocument
  source: HistorySource
  at: number
}

export type BoardHistory = {
  undo: HistoryStep[]
  redo: HistoryStep[]
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

export function parseEditSource(raw: string | undefined | null): EditSource {
  return raw?.trim().toLowerCase() === 'ui' ? 'ui' : 'cli'
}

function parseStoredSource(raw: unknown): HistorySource {
  if (raw === 'ui' || raw === 'cli' || raw === 'unknown') return raw
  return 'unknown'
}

export function normalizeHistory(raw: unknown): BoardHistory {
  if (!raw || typeof raw !== 'object') return emptyHistory()
  const o = raw as Record<string, unknown>
  const undo = Array.isArray(o.undo) ? o.undo.map(parseStep).filter((s): s is HistoryStep => s !== null) : []
  const redo = Array.isArray(o.redo) ? o.redo.map(parseStep).filter((s): s is HistoryStep => s !== null) : []
  const lastEditAt = typeof o.lastEditAt === 'number' && Number.isFinite(o.lastEditAt) ? o.lastEditAt : 0
  return { undo, redo, lastEditAt }
}

function parseStep(value: unknown): HistoryStep | null {
  if (!value || typeof value !== 'object') return null
  const o = value as Record<string, unknown>
  if (isBoardish(o.board)) {
    return {
      board: cloneBoard(o.board),
      source: parseStoredSource(o.source),
      at: typeof o.at === 'number' && Number.isFinite(o.at) ? o.at : 0,
    }
  }
  if (isBoardish(o)) {
    return { board: cloneBoard(o as BoardDocument), source: 'unknown', at: 0 }
  }
  return null
}

function isBoardish(value: unknown): value is BoardDocument {
  if (!value || typeof value !== 'object') return false
  const o = value as Record<string, unknown>
  return typeof o.id === 'string' && Array.isArray(o.nodes) && Array.isArray(o.edges)
}

export function recordEdit(
  history: BoardHistory,
  previous: BoardDocument,
  now: number,
  source: EditSource = 'cli',
): BoardHistory {
  const last = history.undo.at(-1)
  const coalescing =
    last != null &&
    last.source === source &&
    now - history.lastEditAt < HISTORY_COALESCE_MS
  if (coalescing) {
    return { undo: history.undo, redo: history.redo, lastEditAt: now }
  }
  const undo = [...history.undo, { board: cloneBoard(previous), source, at: now }]
  while (undo.length > HISTORY_MAX_STEPS) undo.shift()
  return { undo, redo: [], lastEditAt: now }
}

export function undoEdit(
  history: BoardHistory,
  current: BoardDocument,
): { history: BoardHistory; restored: BoardDocument } | null {
  if (history.undo.length === 0) return null
  const step = history.undo[history.undo.length - 1]
  const undo = history.undo.slice(0, -1)
  const restored = cloneBoard(step.board)
  const redo = [...history.redo, { board: cloneBoard(current), source: step.source, at: step.at }]
  while (redo.length > HISTORY_MAX_STEPS) redo.shift()
  return { history: { undo, redo, lastEditAt: 0 }, restored }
}

export function redoEdit(
  history: BoardHistory,
  current: BoardDocument,
): { history: BoardHistory; restored: BoardDocument } | null {
  if (history.redo.length === 0) return null
  const step = history.redo[history.redo.length - 1]
  const redo = history.redo.slice(0, -1)
  const restored = cloneBoard(step.board)
  const undo = [...history.undo, { board: cloneBoard(current), source: step.source, at: step.at }]
  while (undo.length > HISTORY_MAX_STEPS) undo.shift()
  return { history: { undo, redo, lastEditAt: 0 }, restored }
}

export function summarizeStep(step: HistoryStep): HistoryStepSummary {
  return {
    source: step.source,
    at: step.at,
    title: step.board.title,
    nodeCount: step.board.nodes.length,
    edgeCount: step.board.edges.length,
  }
}

export function historyView(history: BoardHistory): BoardHistoryView {
  return {
    undoSteps: history.undo.length,
    redoSteps: history.redo.length,
    undo: history.undo.map(summarizeStep),
    redo: history.redo.map(summarizeStep),
  }
}

export function isHistoryFileName(name: string) {
  return name.endsWith('.history.json')
}
