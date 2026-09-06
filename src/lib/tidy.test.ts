import { describe, expect, test } from 'vitest'
import { tidyBoard } from './tidy'
import type { BoardDocument, BoardEdge, BoardNode } from '@/types'

function node(id: string, x = 0, y = 0): BoardNode {
  return {
    id,
    title: id,
    description: null,
    x,
    y,
    enterBoardId: null,
    childLink: null,
    refs: [],
    color: 'default',
    borderStyle: 'solid',
  }
}

function edge(id: string, source: string, target: string): BoardEdge {
  return {
    id,
    source,
    target,
    sourceHandle: 'bottom',
    targetHandle: 'top',
    edgeType: 'default',
  }
}

function board(nodes: BoardNode[], edges: BoardEdge[] = []): BoardDocument {
  return {
    schemaVersion: 2,
    id: 'board',
    title: 'Board',
    nodes,
    edges,
  }
}

const sizes = new Map([
  ['a', { width: 180, height: 80 }],
  ['b', { width: 180, height: 80 }],
  ['c', { width: 240, height: 160 }],
])

describe('tidyBoard', () => {
  test('returns the same document when there are no nodes', () => {
    const empty = board([])
    expect(tidyBoard(empty)).toBe(empty)
  })

  test('places a target to the right of its source in an LR layout', () => {
    const next = tidyBoard(board([node('a', 900, 40), node('b', 10, 800)], [edge('e', 'a', 'b')]), sizes, 'LR')
    const a = next.nodes.find(n => n.id === 'a')!
    const b = next.nodes.find(n => n.id === 'b')!
    expect(b.x).toBeGreaterThan(a.x)
    expect(next.edges[0]).toMatchObject({ sourceHandle: 'right', targetHandle: 'left' })
  })

  test('places a target below its source in a TB layout', () => {
    const next = tidyBoard(board([node('a', 900, 40), node('b', 10, 20)], [edge('e', 'a', 'b')]), sizes, 'TB')
    const a = next.nodes.find(n => n.id === 'a')!
    const b = next.nodes.find(n => n.id === 'b')!
    expect(b.y).toBeGreaterThan(a.y)
    expect(next.edges[0]).toMatchObject({ sourceHandle: 'bottom', targetHandle: 'top' })
  })

  test('parks unconnected nodes in a row instead of stacking them', () => {
    const next = tidyBoard(board([
      node('a', 0, 0),
      node('b', 0, 0),
      node('c', 0, 0),
    ], [edge('e', 'a', 'b')]), sizes)

    const a = next.nodes.find(n => n.id === 'a')!
    const b = next.nodes.find(n => n.id === 'b')!
    const c = next.nodes.find(n => n.id === 'c')!
    const linkedBottom = Math.max(a.y + 80, b.y + 80)
    expect(c.y).toBeGreaterThanOrEqual(linkedBottom)
    expect(a.x).not.toBe(b.x)
  })

  test('spreads a board of only isolates so they do not share an origin', () => {
    const next = tidyBoard(board([node('a'), node('b'), node('c')]), sizes)
    const xs = next.nodes.map(n => n.x)
    expect(new Set(xs).size).toBe(3)
  })

  test('does not throw on a two-node cycle', () => {
    expect(() => tidyBoard(
      board([node('a'), node('b')], [edge('e1', 'a', 'b'), edge('e2', 'b', 'a')]),
      sizes,
    )).not.toThrow()
  })

  test('keeps node and edge identity', () => {
    const start = board([node('a'), node('b')], [edge('e', 'a', 'b')])
    const next = tidyBoard(start, sizes)
    expect(next.nodes.map(n => n.id)).toEqual(['a', 'b'])
    expect(next.edges.map(e => e.id)).toEqual(['e'])
    expect(next.id).toBe(start.id)
  })
})
