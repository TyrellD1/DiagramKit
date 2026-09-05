import { expect, test } from 'vitest'
import {
  HISTORY_COALESCE_MS,
  HISTORY_MAX_STEPS,
  boardsAreEqual,
  emptyHistory,
  historyView,
  normalizeHistory,
  parseEditSource,
  recordEdit,
  redoEdit,
  undoEdit,
} from './boardHistory.ts'
import type { BoardDocument } from '../src/types.ts'

function board(title: string, nodeCount = 0): BoardDocument {
  return {
    schemaVersion: 2,
    id: 'b1',
    title,
    nodes: Array.from({ length: nodeCount }, (_, i) => ({
      id: `n${i}`,
      title: `N${i}`,
      description: null,
      x: 0,
      y: 0,
      enterBoardId: null,
      childLink: null,
      refs: [],
      color: 'default',
      borderStyle: 'solid',
    })),
    edges: [],
  }
}

test('recordEdit pushes previous and clears redo', () => {
  const start = emptyHistory()
  const after = recordEdit(start, board('Home'), 1000, 'ui')
  expect(after.undo).toHaveLength(1)
  expect(after.undo[0].board.title).toBe('Home')
  expect(after.undo[0].source).toBe('ui')
  expect(after.undo[0].at).toBe(1000)
  expect(after.redo).toEqual([])
  expect(after.lastEditAt).toBe(1000)
})

test('recordEdit coalesces rapid saves into one undo step', () => {
  const first = recordEdit(emptyHistory(), board('Home'), 1000, 'cli')
  const second = recordEdit(first, board('A'), 1000 + HISTORY_COALESCE_MS - 1, 'cli')
  expect(second.undo).toHaveLength(1)
  expect(second.undo[0].board.title).toBe('Home')
})

test('recordEdit does not coalesce across UI and CLI', () => {
  const first = recordEdit(emptyHistory(), board('Home'), 1000, 'cli')
  const second = recordEdit(first, board('A'), 1000 + 1, 'ui')
  expect(second.undo.map(s => s.source)).toEqual(['cli', 'ui'])
  expect(second.undo.map(s => s.board.title)).toEqual(['Home', 'A'])
})

test('recordEdit starts a new step after the coalesce window', () => {
  const first = recordEdit(emptyHistory(), board('Home'), 1000, 'ui')
  const second = recordEdit(first, board('A'), 1000 + HISTORY_COALESCE_MS, 'ui')
  expect(second.undo.map(s => s.board.title)).toEqual(['Home', 'A'])
})

test('undo then a new edit clears redo', () => {
  let history = recordEdit(emptyHistory(), board('Home'), 1, 'cli')
  history = recordEdit(history, board('A'), 1 + HISTORY_COALESCE_MS, 'ui')
  const undone = undoEdit(history, board('B'))
  expect(undone?.restored.title).toBe('A')
  expect(undone?.history.redo).toHaveLength(1)
  expect(undone?.history.redo[0].source).toBe('ui')
  const next = recordEdit(undone!.history, undone!.restored, 50_000, 'ui')
  expect(next.redo).toEqual([])
  expect(next.undo.at(-1)?.board.title).toBe('A')
})

test('redo restores the undone board and keeps source', () => {
  let history = recordEdit(emptyHistory(), board('Home'), 1, 'cli')
  const undone = undoEdit(history, board('A'))
  const redone = redoEdit(undone!.history, undone!.restored)
  expect(redone?.restored.title).toBe('A')
  expect(redone?.history.redo).toEqual([])
  expect(redone?.history.undo).toHaveLength(1)
  expect(redone?.history.undo[0].source).toBe('cli')
})

test('undo and redo are no-ops on empty stacks', () => {
  expect(undoEdit(emptyHistory(), board('Home'))).toBeNull()
  expect(redoEdit(emptyHistory(), board('Home'))).toBeNull()
})

test('caps undo length', () => {
  let history = emptyHistory()
  for (let i = 0; i < HISTORY_MAX_STEPS + 5; i++) {
    history = recordEdit(history, board(`v${i}`), i * HISTORY_COALESCE_MS, 'cli')
  }
  expect(history.undo).toHaveLength(HISTORY_MAX_STEPS)
  expect(history.undo[0].board.title).toBe('v5')
})

test('boardsAreEqual compares document JSON', () => {
  expect(boardsAreEqual(board('A'), board('A'))).toBe(true)
  expect(boardsAreEqual(board('A'), board('B'))).toBe(false)
})

test('parseEditSource treats missing and anything else as cli', () => {
  expect(parseEditSource('ui')).toBe('ui')
  expect(parseEditSource('UI')).toBe('ui')
  expect(parseEditSource(undefined)).toBe('cli')
  expect(parseEditSource('agent')).toBe('cli')
})

test('normalizeHistory wraps legacy board snapshots as unknown', () => {
  const history = normalizeHistory({
    lastEditAt: 9,
    undo: [board('Old')],
    redo: [],
  })
  expect(history.undo).toHaveLength(1)
  expect(history.undo[0].source).toBe('unknown')
  expect(history.undo[0].board.title).toBe('Old')
  expect(history.undo[0].at).toBe(0)
})

test('historyView summarizes stacks without boards', () => {
  const history = recordEdit(emptyHistory(), board('Home', 2), 1000, 'ui')
  expect(historyView(history)).toEqual({
    undoSteps: 1,
    redoSteps: 0,
    undo: [{ source: 'ui', at: 1000, title: 'Home', nodeCount: 2, edgeCount: 0 }],
    redo: [],
  })
})
