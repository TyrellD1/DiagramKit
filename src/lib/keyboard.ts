export function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export function isUndoKey(e: KeyboardEvent) {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return false
  if (e.key !== 'z' && e.key !== 'Z') return false
  return !e.shiftKey
}

export function isRedoKey(e: KeyboardEvent) {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return false
  if ((e.key === 'z' || e.key === 'Z') && e.shiftKey) return true
  if ((e.key === 'y' || e.key === 'Y') && !e.shiftKey && e.ctrlKey && !e.metaKey) return true
  return false
}
