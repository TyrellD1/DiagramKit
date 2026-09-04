export interface AppRoute {
  workspaceId: string | null
  boardId: string | null
  exportMode: boolean
  theme: 'light' | 'dark' | null
}

function parseTheme(value: string | null): 'light' | 'dark' | null {
  if (value === 'light' || value === 'dark') return value
  return null
}

export function parseAppRoute(search: string): AppRoute {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const workspaceId = params.get('workspace')?.trim() || null
  const boardId = params.get('board')?.trim() || null
  const exportRaw = params.get('export')?.trim()
  const exportMode = exportRaw === '1' || exportRaw === 'true'
  return { workspaceId, boardId, exportMode, theme: parseTheme(params.get('theme')) }
}

export function readAppRoute(): AppRoute {
  return parseAppRoute(window.location.search)
}

export function appRouteHref(
  next: { workspaceId: string; boardId: string; exportMode?: boolean; theme?: 'light' | 'dark' | null },
  currentHref = typeof window !== 'undefined' ? window.location.href : 'http://local/',
): string {
  const url = new URL(currentHref)
  const current = parseAppRoute(url.search)
  const exportMode = next.exportMode ?? current.exportMode
  const theme = next.theme !== undefined ? next.theme : current.theme
  const params = new URLSearchParams()
  params.set('workspace', next.workspaceId)
  params.set('board', next.boardId)
  if (exportMode) params.set('export', '1')
  if (theme) params.set('theme', theme)
  const search = params.toString()
  return `${url.pathname}?${search}${url.hash}`
}

export function writeAppRoute(
  next: { workspaceId: string; boardId: string; exportMode?: boolean; theme?: 'light' | 'dark' | null },
  mode: 'push' | 'replace',
) {
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

export function exportPageUrl(opts: {
  origin: string
  workspaceId: string
  boardId: string
  theme: 'light' | 'dark'
}): string {
  const url = new URL('/', opts.origin)
  url.searchParams.set('workspace', opts.workspaceId)
  url.searchParams.set('board', opts.boardId)
  url.searchParams.set('export', '1')
  url.searchParams.set('theme', opts.theme)
  return url.toString()
}
