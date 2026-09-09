import { expect, test } from 'vitest'
import { filterBoardHits } from './boardSearch'
import type { BoardSearchHit } from '@/types'

const hits: BoardSearchHit[] = [
  { id: '1', title: 'Home', workspaceId: 'a', workspaceName: 'Alpha' },
  { id: '2', title: 'Auth service', workspaceId: 'a', workspaceName: 'Alpha' },
  { id: '3', title: 'Home', workspaceId: 'b', workspaceName: 'Beta' },
  { id: '4', title: 'Auth helper', workspaceId: 'b', workspaceName: 'Beta' },
]

test('filters by name and ranks prefix matches first', () => {
  const found = filterBoardHits(hits, 'auth', ['a', 'b'])
  expect(found.map(h => h.id)).toEqual(['4', '2'])
})

test('filters by selected workspaces', () => {
  const found = filterBoardHits(hits, '', ['b'])
  expect(found.map(h => h.id)).toEqual(['4', '3'])
})

test('empty workspace selection yields no hits', () => {
  expect(filterBoardHits(hits, 'Home', [])).toEqual([])
})
