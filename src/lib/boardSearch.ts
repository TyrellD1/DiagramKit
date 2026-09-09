import type { BoardSearchHit } from '@/types'

export function filterBoardHits(
  hits: BoardSearchHit[],
  query: string,
  workspaceIds: string[],
): BoardSearchHit[] {
  const allowed = new Set(workspaceIds)
  const q = query.trim().toLowerCase()
  const next = hits.filter(hit => {
    if (!allowed.has(hit.workspaceId)) return false
    if (!q) return true
    return hit.title.toLowerCase().includes(q)
  })
  next.sort((a, b) => {
    if (q) {
      const aStart = a.title.toLowerCase().startsWith(q) ? 0 : 1
      const bStart = b.title.toLowerCase().startsWith(q) ? 0 : 1
      if (aStart !== bStart) return aStart - bStart
    }
    const byTitle = a.title.localeCompare(b.title)
    if (byTitle !== 0) return byTitle
    return a.workspaceName.localeCompare(b.workspaceName)
  })
  return next
}
