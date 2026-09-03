import { describe, expect, test } from 'vitest'
import { advanceStack, boardPath } from './boardPath'
import type { WorkspaceIndex } from '@/types'

const index: WorkspaceIndex = {
  rootBoardId: 'root',
  boards: [
    { id: 'root', title: 'Home', parentId: null },
    { id: 'child', title: 'Projects', parentId: 'root' },
    { id: 'grand', title: 'Auth', parentId: 'child' },
    { id: 'jump', title: 'Other', parentId: null },
  ],
}

describe('boardPath', () => {
  test('is just the root on the home board', () => {
    expect(boardPath(index, 'root').map(e => e.boardId)).toEqual(['root'])
  })

  test('walks parentId up to the root', () => {
    expect(boardPath(index, 'grand').map(e => `${e.boardTitle}:${e.boardId}`)).toEqual([
      'Home:root',
      'Projects:child',
      'Auth:grand',
    ])
  })

  test('keeps a jump target under the root', () => {
    expect(boardPath(index, 'jump').map(e => e.boardId)).toEqual(['root', 'jump'])
  })
})

describe('advanceStack', () => {
  test('slices back to an ancestor already on the stack', () => {
    const stack = boardPath(index, 'grand')
    expect(advanceStack(stack, index, 'child').map(e => e.boardId)).toEqual(['root', 'child'])
  })

  test('appends a jump so session breadcrumbs stay intact', () => {
    const stack = boardPath(index, 'child')
    expect(advanceStack(stack, index, 'jump', 'Other').map(e => e.boardId)).toEqual([
      'root',
      'child',
      'jump',
    ])
  })
})
