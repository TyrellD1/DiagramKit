import { useState, useEffect, useCallback } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import BoardCanvas from '@/components/BoardCanvas'
import { api } from '@/lib/api'
import type { WorkspaceIndex, WorkspaceList } from '@/types'

import '@xyflow/react/dist/style.css'

function App() {
  const [boards, setBoards] = useState<WorkspaceIndex | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceList | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [spaceList, boardList] = await Promise.all([
        api.listWorkspaces(),
        api.getWorkspace(),
      ])
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

  const handleWorkspacesChange = useCallback(async (next: WorkspaceList) => {
    try {
      const boardList = await api.getWorkspace()
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

  const root = boards.boards.find(b => b.id === boards.rootBoardId)
  const rootTitle = root?.title ?? 'Home'

  return (
    <ReactFlowProvider key={workspaces.activePath}>
      <BoardCanvas
        rootBoardId={boards.rootBoardId}
        rootBoardTitle={rootTitle}
        workspaces={workspaces}
        onWorkspacesChange={handleWorkspacesChange}
      />
    </ReactFlowProvider>
  )
}

export default App
