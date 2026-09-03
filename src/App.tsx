import { useState, useEffect, useCallback, useRef } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import BoardCanvas from '@/components/BoardCanvas'
import { api } from '@/lib/api'
import { activeWorkspaceId, readAppRoute, resolveBoardId, writeAppRoute } from '@/lib/route'
import type { WorkspaceIndex, WorkspaceList } from '@/types'

import '@xyflow/react/dist/style.css'

function App() {
  const [boards, setBoards] = useState<WorkspaceIndex | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const workspacesRef = useRef(workspaces)
  workspacesRef.current = workspaces

  const load = useCallback(async () => {
    try {
      let spaceList = await api.listWorkspaces()
      const wantedWs = readAppRoute().workspaceId
      if (wantedWs && spaceList.workspaces.some(w => w.id === wantedWs)) {
        const activeId = activeWorkspaceId(spaceList)
        if (wantedWs !== activeId) {
          spaceList = await api.switchWorkspace({ id: wantedWs })
        }
      }
      const boardList = await api.getWorkspace()
      const workspaceId = activeWorkspaceId(spaceList)
      const boardId = resolveBoardId(boardList, readAppRoute().boardId)
      writeAppRoute({ workspaceId, boardId }, 'replace')
      setWorkspaces(spaceList)
      setBoards(boardList)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspace')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onPop = () => {
      const wanted = readAppRoute().workspaceId
      const current = workspacesRef.current
      if (!wanted || !current) return
      if (wanted === activeWorkspaceId(current)) return
      if (!current.workspaces.some(w => w.id === wanted)) return
      void (async () => {
        try {
          const next = await api.switchWorkspace({ id: wanted })
          const boardList = await api.getWorkspace()
          setWorkspaces(next)
          setBoards(boardList)
          setError(null)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load workspace')
        }
      })()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const handleWorkspacesChange = useCallback(async (next: WorkspaceList) => {
    try {
      const boardList = await api.getWorkspace()
      writeAppRoute({
        workspaceId: activeWorkspaceId(next),
        boardId: boardList.rootBoardId,
      }, 'push')
      setWorkspaces(next)
      setBoards(boardList)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspace')
    }
  }, [])

  if (error) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-canvas">
        <div className="max-w-sm rounded-lg border border-border bg-surface px-4 py-3 text-sm shadow-card">
          <p className="m-0 font-medium text-text">Could not reach the workspace</p>
          <p className="m-0 mt-1 text-xs text-muted">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 h-7 cursor-pointer rounded-md border border-border bg-transparent px-2.5 text-xs font-medium text-text transition-colors hover:bg-elevated"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!workspaces || !boards) {
    return <div className="flex h-screen w-screen items-center justify-center bg-canvas text-sm text-faint">Loading</div>
  }

  return (
    <ReactFlowProvider key={workspaces.activePath}>
      <BoardCanvas
        boards={boards}
        workspaces={workspaces}
        onWorkspacesChange={handleWorkspacesChange}
      />
    </ReactFlowProvider>
  )
}

export default App
