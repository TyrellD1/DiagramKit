import { useCallback, useEffect, useRef, useState } from 'react'
import type { WorkspaceIndex } from '@/types'
import { advanceStack, boardPath, type BoardStackEntry } from '@/lib/boardPath'
import { readAppRoute, resolveBoardId, writeAppRoute } from '@/lib/route'

export type { BoardStackEntry }

export function useBoardNavigation(workspaceId: string, boards: WorkspaceIndex) {
  const startId = resolveBoardId(boards, readAppRoute().boardId)
  const [currentBoardId, setCurrentBoardId] = useState(startId)
  const [boardStack, setBoardStack] = useState(() => boardPath(boards, startId))
  const currentRef = useRef(startId)
  const boardsRef = useRef(boards)
  const workspaceRef = useRef(workspaceId)

  boardsRef.current = boards
  workspaceRef.current = workspaceId

  useEffect(() => {
    setBoardStack(boardPath(boards, currentRef.current))
  }, [boards])

  const goToBoard = useCallback((
    boardId: string,
    opts?: { title?: string; history?: 'push' | 'replace' | false },
  ) => {
    const index = boardsRef.current
    const resolved = resolveBoardId(index, boardId)
    const history = opts?.history ?? 'push'
    const from = currentRef.current

    if (resolved !== from) {
      currentRef.current = resolved
      setCurrentBoardId(resolved)
      setBoardStack(prev => advanceStack(prev, index, resolved, opts?.title))
    }

    if (history) {
      const current = readAppRoute()
      if (current.workspaceId !== workspaceRef.current || current.boardId !== resolved) {
        writeAppRoute({ workspaceId: workspaceRef.current, boardId: resolved }, history)
      }
    }
  }, [])

  useEffect(() => {
    const onPop = () => {
      const wanted = readAppRoute().boardId
      goToBoard(wanted ?? boardsRef.current.rootBoardId, { history: false })
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [goToBoard])

  const pushBoard = useCallback((boardId: string, boardTitle?: string) => {
    goToBoard(boardId, { title: boardTitle, history: 'push' })
  }, [goToBoard])

  const popToIndex = useCallback((index: number) => {
    const target = boardStack[index]
    if (target) goToBoard(target.boardId, { title: target.boardTitle, history: 'push' })
  }, [boardStack, goToBoard])

  return {
    currentBoardId,
    boardStack,
    pushBoard,
    popToIndex,
  }
}
