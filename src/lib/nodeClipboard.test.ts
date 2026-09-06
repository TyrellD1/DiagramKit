import { describe, expect, test } from 'vitest'
import {
  cloneNodeContent,
  nodeClipboardContent,
  parseNodeClipboard,
  serializeNodeClipboard,
} from './nodeClipboard'
import type { BoardNode } from '@/types'

function node(partial: Partial<BoardNode> = {}): BoardNode {
  return {
    id: 'src',
    title: 'Auth',
    description: 'Tokens',
    x: 12,
    y: 34,
    enterBoardId: 'child-board',
    childLink: { type: 'url', value: 'https://example.com' },
    refs: [{ id: 'r1', name: 'RFC', type: 'url', target: 'https://rfc.example' }],
    color: 'yellow',
    borderStyle: 'dashed',
    ...partial,
  }
}

describe('cloneNodeContent', () => {
  test('copies card content and drops identity, nest, and position unless given', () => {
    const copy = cloneNodeContent(node(), { x: 100, y: 200 })
    expect(copy.id).not.toBe('src')
    expect(copy.enterBoardId).toBeNull()
    expect(copy.x).toBe(100)
    expect(copy.y).toBe(200)
    expect(copy.title).toBe('Auth')
    expect(copy.description).toBe('Tokens')
    expect(copy.childLink).toEqual({ type: 'url', value: 'https://example.com' })
    expect(copy.color).toBe('yellow')
    expect(copy.borderStyle).toBe('dashed')
    expect(copy.refs).toHaveLength(1)
    expect(copy.refs[0].id).not.toBe('r1')
    expect(copy.refs[0]).toMatchObject({ name: 'RFC', type: 'url', target: 'https://rfc.example' })
  })
})

describe('node clipboard', () => {
  test('round-trips content without id, position, or nested board', () => {
    const text = serializeNodeClipboard(nodeClipboardContent(node()))
    const parsed = parseNodeClipboard(text)
    expect(parsed).toMatchObject({
      title: 'Auth',
      description: 'Tokens',
      childLink: { type: 'url', value: 'https://example.com' },
    })
    expect(text).not.toContain('child-board')
    expect(JSON.stringify(parsed)).not.toContain('"x"')
  })

  test('ignores unrelated clipboard text', () => {
    expect(parseNodeClipboard('hello')).toBeNull()
  })
})
