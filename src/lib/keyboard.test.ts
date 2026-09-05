import { expect, test } from 'vitest'
import { isRedoKey, isUndoKey } from './keyboard'

function chord(partial: Partial<KeyboardEvent>) {
  return {
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    key: 'z',
    ...partial,
  } as KeyboardEvent
}

test('⌘Z and Ctrl+Z undo', () => {
  expect(isUndoKey(chord({ metaKey: true }))).toBe(true)
  expect(isUndoKey(chord({ ctrlKey: true }))).toBe(true)
  expect(isUndoKey(chord({ metaKey: true, shiftKey: true }))).toBe(false)
  expect(isUndoKey(chord({ key: 'z' }))).toBe(false)
})

test('⇧⌘Z, Ctrl+Shift+Z, and Ctrl+Y redo', () => {
  expect(isRedoKey(chord({ metaKey: true, shiftKey: true }))).toBe(true)
  expect(isRedoKey(chord({ ctrlKey: true, shiftKey: true }))).toBe(true)
  expect(isRedoKey(chord({ ctrlKey: true, key: 'y' }))).toBe(true)
  expect(isRedoKey(chord({ metaKey: true, key: 'y' }))).toBe(false)
  expect(isRedoKey(chord({ metaKey: true }))).toBe(false)
})
