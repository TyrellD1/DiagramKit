import type { LiveEvent } from '@/types'

type LiveHandler = (event: LiveEvent) => void

const handlers = new Set<LiveHandler>()
let source: EventSource | null = null

function ensureSource() {
  if (source && source.readyState !== EventSource.CLOSED) return
  source = new EventSource('/api/events')
  source.onmessage = (message) => {
    try {
      const event = JSON.parse(message.data) as LiveEvent
      for (const handler of handlers) handler(event)
    } catch {
      // ignore malformed payloads
    }
  }
}

export function subscribeLiveEvents(handler: LiveHandler) {
  handlers.add(handler)
  ensureSource()
  return () => {
    handlers.delete(handler)
  }
}
