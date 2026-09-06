import { expect, test } from 'vitest'
import { isCopyKey, isDuplicateKey, isPasteKey, isRedoKey, isUndoKey } from './keyboard'

test('⌘C / ⌘V / ⌘D copy, paste, and duplicate', () => {
  expect(isCopyKey(chord({ metaKey: true, key: 'c' }))).toBe(true)
  expect(isPasteKey(chord({ ctrlKey: true, key: 'v' }))).toBe(true)
  expect(isDuplicateKey(chord({ metaKey: true, key: 'd' }))).toBe(true)
  expect(isCopyKey(chord({ metaKey: true, key: 'c', shiftKey: true }))).toBe(false)
})

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
