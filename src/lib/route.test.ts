import { describe, expect, test } from 'vitest'
import { appRouteHref, parseAppRoute, resolveBoardId } from './route'

describe('app route', () => {
  test('reads workspace and board from the query string', () => {
    expect(parseAppRoute('?workspace=default&board=abc')).toEqual({
      workspaceId: 'default',
      boardId: 'abc',
      exportMode: false,
      theme: null,
    })
  })

  test('reads export and theme flags', () => {
    expect(parseAppRoute('?board=abc&export=1&theme=light')).toEqual({
      workspaceId: null,
      boardId: 'abc',
      exportMode: true,
      theme: 'light',
    })
  })

  test('treats missing or blank params as null', () => {
    expect(parseAppRoute('')).toEqual({
      workspaceId: null,
      boardId: null,
      exportMode: false,
      theme: null,
    })
    expect(parseAppRoute('?workspace=&board=  ')).toEqual({
      workspaceId: null,
      boardId: null,
      exportMode: false,
      theme: null,
    })
  })

  test('writes workspace and board onto the current URL', () => {
    expect(appRouteHref(
      { workspaceId: 'default', boardId: 'board-1' },
      'http://127.0.0.1:5173/',
    )).toBe('/?workspace=default&board=board-1')
  })

  test('keeps export mode and theme when rewriting the board', () => {
    expect(appRouteHref(
      { workspaceId: 'default', boardId: 'board-1' },
      'http://127.0.0.1:5173/?export=1&theme=dark&workspace=old',
    )).toBe('/?workspace=default&board=board-1&export=1&theme=dark')
  })

  test('falls back to the root board when the id is unknown', () => {
    const index = {
      rootBoardId: 'root',
      boards: [{ id: 'root' }, { id: 'child' }],
    }
    expect(resolveBoardId(index, 'child')).toBe('child')
    expect(resolveBoardId(index, 'missing')).toBe('root')
    expect(resolveBoardId(index, null)).toBe('root')
  })
})
