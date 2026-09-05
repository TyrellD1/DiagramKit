import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import type { BoardSummary, WorkspaceIndex } from '@/types'

export interface BoardTreeNode {
  board: BoardSummary
  children: BoardTreeNode[]
}

function buildTree(boards: BoardSummary[]): BoardTreeNode[] {
  const map = new Map<string, BoardTreeNode>()
  const roots: BoardTreeNode[] = []

  for (const board of boards) {
    map.set(board.id, { board, children: [] })
  }

  for (const board of boards) {
    const node = map.get(board.id)!
    if (board.parentId && map.has(board.parentId)) {
      map.get(board.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

export function useBoards() {
  const [boards, setBoards] = useState<BoardSummary[]>([])
  const [rootBoardId, setRootBoardId] = useState<string | null>(null)
  const [tree, setTree] = useState<BoardTreeNode[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (): Promise<WorkspaceIndex> => {
    setLoading(true)
    try {
      const data = await api.getWorkspace()
      setBoards(data.boards)
      setRootBoardId(data.rootBoardId)
      setTree(buildTree(data.boards))
      return data
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { boards, rootBoardId, tree, loading, reload: load }
}
