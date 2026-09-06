import dagre from '@dagrejs/dagre'
import { pickHandles } from './connect'
import type { BoardDocument, BoardEdge, BoardNode } from '@/types'

export type TidyDirection = 'LR' | 'TB'
export type NodeSize = { width: number; height: number }

const FALLBACK: NodeSize = { width: 180, height: 80 }
const NODE_GAP = 80
const RANK_GAP = 120
const GRID = 20
const ISOLATE_ROW = 1280

function snap(n: number) {
  return Math.round(n / GRID) * GRID
}

function sizeOf(id: string, sizes: ReadonlyMap<string, NodeSize>): NodeSize {
  const size = sizes.get(id)
  if (!size) return FALLBACK
  return {
    width: size.width > 0 ? size.width : FALLBACK.width,
    height: size.height > 0 ? size.height : FALLBACK.height,
  }
}

export function nodeSizesFromFlow(
  nodes: Array<{
    id: string
    measured?: { width?: number; height?: number }
    width?: number
    height?: number
  }>,
): Map<string, NodeSize> {
  return new Map(nodes.map(n => [n.id, {
    width: n.measured?.width ?? n.width ?? FALLBACK.width,
    height: n.measured?.height ?? n.height ?? FALLBACK.height,
  }]))
}

/**
 * Rank connected cards with dagre (left-to-right by default) and park
 * unconnected cards in a row underneath so they are not stacked at the origin.
 * Rewrites x/y and facing handles. Empty boards are returned as-is.
 */
export function tidyBoard(
  board: BoardDocument,
  sizes: ReadonlyMap<string, NodeSize> = new Map(),
  direction: TidyDirection = 'LR',
): BoardDocument {
  if (board.nodes.length === 0) return board

  const nodeIds = new Set(board.nodes.map(n => n.id))
  const linkedIds = new Set<string>()
  const layoutEdges: BoardEdge[] = []

  for (const edge of board.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue
    if (edge.source === edge.target) continue
    linkedIds.add(edge.source)
    linkedIds.add(edge.target)
    layoutEdges.push(edge)
  }

  const positions = new Map<string, { x: number; y: number }>()

  if (linkedIds.size > 0) {
    layoutConnected(linkedIds, layoutEdges, sizes, direction, positions)
  }

  const isolates = board.nodes.filter(n => !linkedIds.has(n.id))
  if (isolates.length > 0) {
    const origin = isolateOrigin(positions, sizes, linkedIds)
    placeRow(isolates, sizes, origin.x, origin.y, positions)
  }

  const nodes = board.nodes.map(n => {
    const p = positions.get(n.id)
    return p ? { ...n, x: p.x, y: p.y } : n
  })

  const byId = new Map(nodes.map(n => [n.id, n]))
  const edges = board.edges.map(edge => {
    const source = byId.get(edge.source)
    const target = byId.get(edge.target)
    if (!source || !target || source.id === target.id) return edge
    const handles = pickHandles(boxOf(source, sizes), boxOf(target, sizes))
    if (edge.sourceHandle === handles.sourceHandle && edge.targetHandle === handles.targetHandle) {
      return edge
    }
    return { ...edge, sourceHandle: handles.sourceHandle, targetHandle: handles.targetHandle }
  })

  return { ...board, nodes, edges }
}

function boxOf(node: BoardNode, sizes: ReadonlyMap<string, NodeSize>) {
  const { width, height } = sizeOf(node.id, sizes)
  return { position: { x: node.x, y: node.y }, width, height }
}

function layoutConnected(
  linkedIds: Set<string>,
  edges: BoardEdge[],
  sizes: ReadonlyMap<string, NodeSize>,
  direction: TidyDirection,
  positions: Map<string, { x: number; y: number }>,
) {
  const graph = new dagre.graphlib.Graph({ directed: true })
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({
    rankdir: direction,
    nodesep: NODE_GAP,
    ranksep: RANK_GAP,
    edgesep: 40,
    marginx: 0,
    marginy: 0,
  })

  for (const id of linkedIds) {
    const { width, height } = sizeOf(id, sizes)
    graph.setNode(id, { width, height })
  }
  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target)
  }

  dagre.layout(graph)

  for (const id of linkedIds) {
    const placed = graph.node(id)
    if (!placed || placed.x == null || placed.y == null) continue
    const { width, height } = sizeOf(id, sizes)
    positions.set(id, {
      x: snap(placed.x - width / 2),
      y: snap(placed.y - height / 2),
    })
  }
}

function isolateOrigin(
  positions: Map<string, { x: number; y: number }>,
  sizes: ReadonlyMap<string, NodeSize>,
  linkedIds: Set<string>,
) {
  if (linkedIds.size === 0) return { x: 0, y: 0 }
  let maxY = 0
  let minX = Infinity
  for (const id of linkedIds) {
    const p = positions.get(id)
    if (!p) continue
    const { height } = sizeOf(id, sizes)
    maxY = Math.max(maxY, p.y + height)
    minX = Math.min(minX, p.x)
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0 }
  return { x: minX, y: snap(maxY + RANK_GAP) }
}

function placeRow(
  nodes: BoardNode[],
  sizes: ReadonlyMap<string, NodeSize>,
  originX: number,
  originY: number,
  positions: Map<string, { x: number; y: number }>,
) {
  let x = originX
  let y = originY
  let rowH = 0
  for (const node of nodes) {
    const { width, height } = sizeOf(node.id, sizes)
    if (x > originX && x + width > originX + ISOLATE_ROW) {
      x = originX
      y += rowH + NODE_GAP
      rowH = 0
    }
    positions.set(node.id, { x: snap(x), y: snap(y) })
    x += width + NODE_GAP
    rowH = Math.max(rowH, height)
  }
}
