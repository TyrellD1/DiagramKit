export interface AppRoute {
  workspaceId: string | null
  boardId: string | null
}

export function parseAppRoute(search: string): AppRoute {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const workspaceId = params.get('workspace')?.trim() || null
  const boardId = params.get('board')?.trim() || null
  return { workspaceId, boardId }
}

export function readAppRoute(): AppRoute {
  return parseAppRoute(window.location.search)
}

export function appRouteHref(
  next: { workspaceId: string; boardId: string },
  currentHref = typeof window !== 'undefined' ? window.location.href : 'http://local/',
): string {
  const url = new URL(currentHref)
  url.searchParams.set('workspace', next.workspaceId)
  url.searchParams.set('board', next.boardId)
  return `${url.pathname}${url.search}${url.hash}`
}

export function writeAppRoute(next: { workspaceId: string; boardId: string }, mode: 'push' | 'replace') {
  const href = appRouteHref(next)
  if (mode === 'push') history.pushState(null, '', href)
  else history.replaceState(null, '', href)
}

export function activeWorkspaceId(list: {
  activePath: string
  workspaces: Array<{ id: string; path: string }>
}): string {
  return list.workspaces.find(w => w.path === list.activePath)?.id ?? 'default'
}

export function resolveBoardId(
  index: { rootBoardId: string; boards: Array<{ id: string }> },
  boardId: string | null | undefined,
): string {
  if (boardId && index.boards.some(b => b.id === boardId)) return boardId
  return index.rootBoardId
}
