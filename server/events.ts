import type { LiveEvent } from '../src/types.ts'

type Listener = (event: LiveEvent) => void

const listeners = new Set<Listener>()

export function subscribeLive(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function publishLive(event: LiveEvent) {
  for (const listener of listeners) listener(event)
}

export function liveListenerCount() {
  return listeners.size
}
