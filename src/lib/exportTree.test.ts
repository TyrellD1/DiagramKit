import { describe, expect, test } from 'vitest'
import type { WorkspaceIndex } from '@/types'
import {
  collectBoardTree,
  namedBoardTree,
  resolveBoardRef,
  slugTitle,
  zipBasename,
  pngBasename,
} from './exportTree'

const index: WorkspaceIndex = {
  rootBoardId: 'root',
  boards: [
    { id: 'root', title: 'Home', parentId: null },
    { id: 'child', title: 'Auth Service', parentId: 'root' },
    { id: 'grand', title: 'Tokens', parentId: 'child' },
    { id: 'jump', title: 'Other', parentId: null },
    { id: 'twin', title: 'Auth Service', parentId: 'root' },
  ],
}

describe('slugTitle', () => {
  test('normalizes titles for filenames', () => {
    expect(slugTitle('Auth Service')).toBe('auth-service')
    expect(slugTitle('  Hello, World!  ')).toBe('hello-world')
    expect(slugTitle('---')).toBe('board')
  })
})

describe('collectBoardTree', () => {
  test('includes the board and nested enterBoardId children, not jumps', () => {
    expect(collectBoardTree(index, 'root').map(b => b.id)).toEqual(['root', 'child', 'grand', 'twin'])
    expect(collectBoardTree(index, 'child').map(b => b.id)).toEqual(['child', 'grand'])
    expect(collectBoardTree(index, 'missing')).toEqual([])
  })
})

describe('namedBoardTree', () => {
  test('joins ancestor slugs and disambiguates duplicate titles', () => {
    const named = namedBoardTree(index, 'root')
    expect(named.map(n => n.filename)).toEqual([
      'home.png',
      'home--auth-service.png',
      'home--auth-service--tokens.png',
      'home--auth-service-twin.png',
    ])
  })

  test('paths start at the export root, not Home', () => {
    expect(namedBoardTree(index, 'child').map(n => n.filename)).toEqual([
      'auth-service.png',
      'auth-service--tokens.png',
    ])
  })

  test('omits nested boards when children is false', () => {
    expect(namedBoardTree(index, 'root', { children: false }).map(n => n.filename)).toEqual([
      'home.png',
    ])
  })
})

describe('resolveBoardRef', () => {
  test('defaults to the root board', () => {
    expect(resolveBoardRef(index).id).toBe('root')
  })

  test('matches a unique title case-insensitively', () => {
    expect(resolveBoardRef(index, 'tokens').id).toBe('grand')
  })

  test('rejects an ambiguous title', () => {
    expect(() => resolveBoardRef(index, 'Auth Service')).toThrow(/Multiple boards/)
  })
})

test('zipBasename', () => {
  expect(zipBasename('Auth Service')).toBe('auth-service-export.zip')
})

test('pngBasename', () => {
  expect(pngBasename('Auth Service')).toBe('auth-service.png')
})
