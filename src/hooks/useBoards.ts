import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import type { BoardSummary } from '@/types'

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
  const [tree, setTree] = useState<BoardTreeNode[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getWorkspace()
      setBoards(data.boards)
      setTree(buildTree(data.boards))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { boards, tree, loading, reload: load }
}
