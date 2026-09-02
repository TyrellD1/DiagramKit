import { useState, useEffect, useCallback, useRef } from 'react'
import { MarkerType, type Node, type Edge } from '@xyflow/react'
import { api } from '@/lib/api'
import type { AtreidesNodeData, BoardDocument, BoardNode, ReferenceLink } from '@/types'

function toFlowNodes(board: BoardDocument): Node<AtreidesNodeData>[] {
  return board.nodes.map(n => ({
    id: n.id,
    type: 'atreides',
    position: { x: n.x, y: n.y },
    data: {
      title: n.title,
      description: n.description,
      childLink: n.childLink,
      referenceLinks: n.refs,
      hasLink: !!n.enterBoardId,
      linkedBoardId: n.enterBoardId,
      dbId: n.id,
    },
  }))
}

function toFlowEdges(board: BoardDocument): Edge[] {
  return board.edges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    targetHandle: e.targetHandle ?? undefined,
    ...(e.edgeType !== 'plain' ? {
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--edge)', width: 18, height: 18 },
    } : {}),
    data: { dbEdgeType: e.edgeType },
  }))
}

export function useBoard(boardId: string | null) {
  const [board, setBoard] = useState<BoardDocument | null>(null)
  const [flowNodes, setFlowNodes] = useState<Node<AtreidesNodeData>[]>([])
  const [flowEdges, setFlowEdges] = useState<Edge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const boardRef = useRef<BoardDocument | null>(null)
  const writeQueue = useRef(Promise.resolve())

  const persist = useCallback((next: BoardDocument, silent = false) => {
    boardRef.current = next
    if (!silent) {
      setBoard(next)
      setFlowNodes(toFlowNodes(next))
      setFlowEdges(toFlowEdges(next))
    }
    writeQueue.current = writeQueue.current
      .then(() => api.saveBoard(next))
      .then(() => undefined)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to save board')
      })
    return writeQueue.current
  }, [])

  const apply = useCallback((fn: (b: BoardDocument) => BoardDocument) => {
    const current = boardRef.current
    if (!current) return
    persist(fn(current), false)
  }, [persist])

  const persistPositions = useCallback((nodes: Node[]) => {
    const current = boardRef.current
    if (!current) return
    const pos = new Map(nodes.map(n => [n.id, n.position]))
    persist({
      ...current,
      nodes: current.nodes.map(n => {
        const p = pos.get(n.id)
        return p ? { ...n, x: p.x, y: p.y } : n
      }),
    }, true)
  }, [persist])

  const load = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const doc = await api.getBoard(id)
      boardRef.current = doc
      setBoard(doc)
      setFlowNodes(toFlowNodes(doc))
      setFlowEdges(toFlowEdges(doc))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load board')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (boardId) load(boardId)
  }, [boardId, load])

  const updateNode = useCallback((nodeId: string, patch: Partial<BoardNode>) => {
    apply(b => ({
      ...b,
      nodes: b.nodes.map(n => n.id === nodeId ? { ...n, ...patch } : n),
    }))
  }, [apply])

  const addNode = useCallback((node: BoardNode) => {
    apply(b => ({ ...b, nodes: [...b.nodes, node] }))
  }, [apply])

  const deleteNode = useCallback((nodeId: string) => {
    apply(b => ({
      ...b,
      nodes: b.nodes.filter(n => n.id !== nodeId),
      edges: b.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
    }))
  }, [apply])

  const addEdge = useCallback((edge: BoardDocument['edges'][number]) => {
    apply(b => ({ ...b, edges: [...b.edges, edge] }))
  }, [apply])

  const updateEdge = useCallback((edgeId: string, edgeType: string) => {
    apply(b => ({
      ...b,
      edges: b.edges.map(e => e.id === edgeId ? { ...e, edgeType } : e),
    }))
  }, [apply])

  const deleteEdge = useCallback((edgeId: string) => {
    apply(b => ({ ...b, edges: b.edges.filter(e => e.id !== edgeId) }))
  }, [apply])

  const addRef = useCallback((nodeId: string, ref: ReferenceLink) => {
    apply(b => ({
      ...b,
      nodes: b.nodes.map(n => n.id === nodeId ? { ...n, refs: [...n.refs, ref] } : n),
    }))
  }, [apply])

  const deleteRef = useCallback((nodeId: string, refId: string) => {
    apply(b => ({
      ...b,
      nodes: b.nodes.map(n =>
        n.id === nodeId ? { ...n, refs: n.refs.filter(r => r.id !== refId) } : n,
      ),
    }))
  }, [apply])

  const linkToNewBoard = useCallback(async (nodeId: string, title: string) => {
    const created = await api.createBoard({ title: title.trim() || 'Untitled' })
    apply(b => ({
      ...b,
      nodes: b.nodes.map(n => n.id === nodeId ? { ...n, enterBoardId: created.id } : n),
    }))
    return created
  }, [apply])

  return {
    board,
    flowNodes,
    flowEdges,
    loading,
    error,
    reload: () => boardId && load(boardId),
    persistPositions,
    updateNode,
    addNode,
    deleteNode,
    addEdge,
    updateEdge,
    deleteEdge,
    addRef,
    deleteRef,
    linkToNewBoard,
  }
}
