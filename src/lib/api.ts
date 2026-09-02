import type { BoardDocument, WorkspaceIndex, WorkspaceList } from '@/types'

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

export const api = {
  getWorkspace: () => request<WorkspaceIndex>('/boards'),
  getBoard: (id: string) => request<BoardDocument>(`/boards/${id}`),
  saveBoard: (board: BoardDocument) =>
    request<BoardDocument>(`/boards/${board.id}`, {
      method: 'PUT',
      body: JSON.stringify(board),
    }),
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
}
