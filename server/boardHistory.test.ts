import { expect, test } from 'vitest'
import {
  HISTORY_COALESCE_MS,
  HISTORY_MAX_STEPS,
  boardsAreEqual,
  emptyHistory,
  recordEdit,
  redoEdit,
  undoEdit,
} from './boardHistory.ts'
import type { BoardDocument } from '../src/types.ts'

function board(title: string): BoardDocument {
  return { schemaVersion: 2, id: 'b1', title, nodes: [], edges: [] }
}

test('recordEdit pushes previous and clears redo', () => {
  const start = emptyHistory()
  const after = recordEdit(start, board('Home'), 1000)
  expect(after.undo).toHaveLength(1)
  expect(after.undo[0].title).toBe('Home')
  expect(after.redo).toEqual([])
  expect(after.lastEditAt).toBe(1000)
})

test('recordEdit coalesces rapid saves into one undo step', () => {
  const first = recordEdit(emptyHistory(), board('Home'), 1000)
  const second = recordEdit(first, board('A'), 1000 + HISTORY_COALESCE_MS - 1)
  expect(second.undo).toHaveLength(1)
  expect(second.undo[0].title).toBe('Home')
})

test('recordEdit starts a new step after the coalesce window', () => {
  const first = recordEdit(emptyHistory(), board('Home'), 1000)
  const second = recordEdit(first, board('A'), 1000 + HISTORY_COALESCE_MS)
  expect(second.undo.map(b => b.title)).toEqual(['Home', 'A'])
})

test('undo then a new edit clears redo', () => {
  let history = recordEdit(emptyHistory(), board('Home'), 1)
  history = recordEdit(history, board('A'), 1 + HISTORY_COALESCE_MS)
  const undone = undoEdit(history, board('B'))
  expect(undone?.restored.title).toBe('A')
  expect(undone?.history.redo).toHaveLength(1)
  const next = recordEdit(undone!.history, undone!.restored, 50_000)
  expect(next.redo).toEqual([])
  expect(next.undo.at(-1)?.title).toBe('A')
})

test('redo restores the undone board', () => {
  let history = recordEdit(emptyHistory(), board('Home'), 1)
  const undone = undoEdit(history, board('A'))
  const redone = redoEdit(undone!.history, undone!.restored)
  expect(redone?.restored.title).toBe('A')
  expect(redone?.history.redo).toEqual([])
  expect(redone?.history.undo).toHaveLength(1)
})

test('undo and redo are no-ops on empty stacks', () => {
  expect(undoEdit(emptyHistory(), board('Home'))).toBeNull()
  expect(redoEdit(emptyHistory(), board('Home'))).toBeNull()
})

test('caps undo length', () => {
  let history = emptyHistory()
  for (let i = 0; i < HISTORY_MAX_STEPS + 5; i++) {
    history = recordEdit(history, board(`v${i}`), i * HISTORY_COALESCE_MS)
  }
  expect(history.undo).toHaveLength(HISTORY_MAX_STEPS)
  expect(history.undo[0].title).toBe('v5')
})

test('boardsAreEqual compares document JSON', () => {
  expect(boardsAreEqual(board('A'), board('A'))).toBe(true)
  expect(boardsAreEqual(board('A'), board('B'))).toBe(false)
})
