import { expect, test } from 'vitest'
import { isCopyKey, isDuplicateKey, isFitViewKey, isPasteKey, isRedoKey, isSearchKey, isUndoKey } from './keyboard'

test('⌘C / ⌘V / ⌘D copy, paste, and duplicate', () => {
  expect(isCopyKey(chord({ metaKey: true, key: 'c' }))).toBe(true)
  expect(isPasteKey(chord({ ctrlKey: true, key: 'v' }))).toBe(true)
  expect(isDuplicateKey(chord({ metaKey: true, key: 'd' }))).toBe(true)
  expect(isCopyKey(chord({ metaKey: true, key: 'c', shiftKey: true }))).toBe(false)
})

test('⌘P and Ctrl+P open board search', () => {
  expect(isSearchKey(chord({ metaKey: true, key: 'p' }))).toBe(true)
  expect(isSearchKey(chord({ ctrlKey: true, key: 'P' }))).toBe(true)
  expect(isSearchKey(chord({ metaKey: true, key: 'p', shiftKey: true }))).toBe(false)
  expect(isSearchKey(chord({ key: 'p' }))).toBe(false)
})

test('Ctrl+J and ⌘J fit to view', () => {
  expect(isFitViewKey(chord({ ctrlKey: true, key: 'j' }))).toBe(true)
  expect(isFitViewKey(chord({ metaKey: true, key: 'J' }))).toBe(true)
  expect(isFitViewKey(chord({ ctrlKey: true, key: 'j', shiftKey: true }))).toBe(false)
  expect(isFitViewKey(chord({ key: 'j' }))).toBe(false)
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
