import { useState, useEffect, useCallback, useRef } from 'react'
import { MarkerType, type Node, type Edge } from '@xyflow/react'
import { api } from '@/lib/api'
import { targetHandleId, parseHandleId } from '@/lib/connect'
import type { AtreidesNodeData, BoardDocument, BoardHistoryView, BoardNode, ReferenceLink } from '@/types'
import { normalizeCardBorderStyle, normalizeCardColor } from '@/lib/cardStyle'

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
      color: normalizeCardColor(n.color),
      borderStyle: normalizeCardBorderStyle(n.borderStyle),
    },
  }))
}

function toFlowEdges(board: BoardDocument): Edge[] {
  return board.edges.map(e => {
    const targetSide = parseHandleId(e.targetHandle)
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: targetSide ? targetHandleId(targetSide) : undefined,
      ...(e.edgeType !== 'plain' ? {
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--edge)', width: 18, height: 18 },
      } : {}),
      data: { dbEdgeType: e.edgeType },
    }
  })
}

export function useBoard(boardId: string | null) {
  const [board, setBoard] = useState<BoardDocument | null>(null)
  const [flowNodes, setFlowNodes] = useState<Node<AtreidesNodeData>[]>([])
  const [flowEdges, setFlowEdges] = useState<Edge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [history, setHistory] = useState<BoardHistoryView>({
    undoSteps: 0,
    redoSteps: 0,
    undo: [],
    redo: [],
  })
  const boardRef = useRef<BoardDocument | null>(null)
  const writeQueue = useRef(Promise.resolve())

  const applyLoaded = useCallback((doc: BoardDocument) => {
    boardRef.current = doc
    setBoard(doc)
    setFlowNodes(toFlowNodes(doc))
    setFlowEdges(toFlowEdges(doc))
  }, [])

  const refreshHistory = useCallback(async (id: string) => {
    try {
      const view = await api.getBoardHistory(id)
      setHistory(view)
      setCanUndo(view.undoSteps > 0)
      setCanRedo(view.redoSteps > 0)
    } catch {
      // ignore
    }
  }, [])

  const persist = useCallback((next: BoardDocument, silent = false) => {
    boardRef.current = next
    if (!silent) {
      setBoard(next)
      setFlowNodes(toFlowNodes(next))
      setFlowEdges(toFlowEdges(next))
    }
    writeQueue.current = writeQueue.current
      .then(() => api.saveBoard(next))
      .then(() => refreshHistory(next.id))
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to save board')
      })
    return writeQueue.current
  }, [refreshHistory])

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
      applyLoaded(doc)
      await refreshHistory(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load board')
    } finally {
      setLoading(false)
    }
  }, [applyLoaded, refreshHistory])

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
    apply(b => {
      if (b.edges.some(e => e.source === edge.source && e.target === edge.target
        && e.sourceHandle === edge.sourceHandle && e.targetHandle === edge.targetHandle)) {
        return b
      }
      return { ...b, edges: [...b.edges, edge] }
    })
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

  const undo = useCallback(() => {
    const id = boardRef.current?.id
    if (!id) return
    writeQueue.current = writeQueue.current
      .then(async () => {
        try {
          const doc = await api.undoBoard(id)
          applyLoaded(doc)
          await refreshHistory(id)
        } catch (err) {
          if (err instanceof Error && err.message === 'Nothing to undo') {
            setCanUndo(false)
            return
          }
          setError(err instanceof Error ? err.message : 'Failed to undo')
        }
      })
    return writeQueue.current
  }, [applyLoaded, refreshHistory])

  const redo = useCallback(() => {
    const id = boardRef.current?.id
    if (!id) return
    writeQueue.current = writeQueue.current
      .then(async () => {
        try {
          const doc = await api.redoBoard(id)
          applyLoaded(doc)
          await refreshHistory(id)
        } catch (err) {
          if (err instanceof Error && err.message === 'Nothing to redo') {
            setCanRedo(false)
            return
          }
          setError(err instanceof Error ? err.message : 'Failed to redo')
        }
      })
    return writeQueue.current
  }, [applyLoaded, refreshHistory])

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
    undo,
    redo,
    canUndo,
    canRedo,
    history,
    refreshHistory: () => {
      const id = boardRef.current?.id
      if (id) return refreshHistory(id)
    },
  }
}
