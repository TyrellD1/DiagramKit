import { useState, useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'

export interface BoardStackEntry {
  boardId: string
  boardTitle: string
  viewport: { x: number; y: number; zoom: number }
}

export function useBoardNavigation() {
  const [boardStack, setBoardStack] = useState<BoardStackEntry[]>([])
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null)
  const { getViewport, setViewport } = useReactFlow()

  const initWithRootBoard = useCallback((rootBoardId: string, rootTitle: string) => {
    setCurrentBoardId(rootBoardId)
    setBoardStack([{ boardId: rootBoardId, boardTitle: rootTitle, viewport: { x: 0, y: 0, zoom: 1 } }])
  }, [])

  const pushBoard = useCallback((boardId: string, boardTitle?: string) => {
    const currentViewport = getViewport()
    setBoardStack(prev => {
      const updated = [...prev]
      if (updated.length > 0) {
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          viewport: currentViewport,
        }
      }
      return [...updated, { boardId, boardTitle: boardTitle ?? 'Board', viewport: { x: 0, y: 0, zoom: 1 } }]
    })
    setCurrentBoardId(boardId)
    setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 300 })
  }, [getViewport, setViewport])

  const popToIndex = useCallback((index: number) => {
    setBoardStack(prev => {
      const sliced = prev.slice(0, index + 1)
      const target = sliced[sliced.length - 1]
      setCurrentBoardId(target.boardId)
      setViewport(target.viewport, { duration: 300 })
      return sliced
    })
  }, [setViewport])

  return {
    currentBoardId,
    boardStack,
    initWithRootBoard,
    pushBoard,
    popToIndex,
  }
}
