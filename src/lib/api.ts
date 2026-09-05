import type { BoardDocument, BoardHistoryView, WorkspaceIndex, WorkspaceList } from '@/types'
import type { Theme } from '@/theme/themes'

const UI_SOURCE = { 'X-DiagramKit-Source': 'ui' }

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`
    try {
      const body = await res.json() as { error?: string }
      if (body.error) message = body.error
    } catch {
      // ignore
    }
    throw new Error(message)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

function filenameFromDisposition(header: string | null, fallback: string) {
  if (!header) return fallback
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (star?.[1]) return decodeURIComponent(star[1])
  const quoted = /filename="([^"]+)"/i.exec(header)
  if (quoted?.[1]) return quoted[1]
  const plain = /filename=([^;]+)/i.exec(header)
  return plain?.[1]?.trim() || fallback
}

export const api = {
  getWorkspace: () => request<WorkspaceIndex>('/boards'),
  getBoard: (id: string) => request<BoardDocument>(`/boards/${id}`),
  saveBoard: (board: BoardDocument) =>
    request<BoardDocument>(`/boards/${board.id}`, {
      method: 'PUT',
      body: JSON.stringify(board),
      headers: UI_SOURCE,
    }),
  getBoardHistory: (id: string) =>
    request<BoardHistoryView>(`/boards/${id}/history`),
  undoBoard: (id: string) =>
    request<BoardDocument>(`/boards/${id}/undo`, { method: 'POST', headers: UI_SOURCE }),
  redoBoard: (id: string) =>
    request<BoardDocument>(`/boards/${id}/redo`, { method: 'POST', headers: UI_SOURCE }),
  createBoard: (data: { title: string }) =>
    request<BoardDocument>('/boards', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteBoard: (id: string) =>
    request<void>(`/boards/${id}`, { method: 'DELETE' }),
  listWorkspaces: () => request<WorkspaceList>('/workspaces'),
  attachWorkspace: (data: { path: string; name?: string }) =>
    request<WorkspaceList>('/workspaces/attach', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  switchWorkspace: (data: { id?: string; path?: string }) =>
    request<WorkspaceList>('/workspaces/switch', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  detachWorkspace: (id: string) =>
    request<WorkspaceList>(`/workspaces/${id}`, { method: 'DELETE' }),
  exportBoard: async (id: string, theme: Theme, opts?: { children?: boolean }) => {
    const children = opts?.children !== false
    const res = await fetch(
      `/api/boards/${encodeURIComponent(id)}/export?theme=${theme}&children=${children ? '1' : '0'}`,
      { method: 'POST' },
    )
    if (!res.ok) {
      let message = `${res.status} ${res.statusText}`
      try {
        const body = await res.json() as { error?: string }
        if (body.error) message = body.error
      } catch {
        // ignore
      }
      throw new Error(message)
    }
    const blob = await res.blob()
    const filename = filenameFromDisposition(
      res.headers.get('Content-Disposition'),
      children ? 'board-export.zip' : 'board.png',
    )
    return { blob, filename }
  },
}
