import { expect, test } from 'vitest'
import { liveListenerCount, publishLive, subscribeLive } from './events.ts'

test('publishLive notifies current subscribers only', () => {
  const seen: string[] = []
  const unsub = subscribeLive(event => {
    if (event.type === 'board') seen.push(event.id)
  })
  expect(liveListenerCount()).toBe(1)
  publishLive({ type: 'board', id: 'a', source: 'cli' })
  unsub()
  publishLive({ type: 'board', id: 'b', source: 'cli' })
  expect(seen).toEqual(['a'])
  expect(liveListenerCount()).toBe(0)
})
