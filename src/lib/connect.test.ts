import { describe, expect, test } from 'vitest'
import { pickHandles, sourceTargetForDrag } from './connect'

function box(x: number, y: number, w = 180, h = 80) {
  return { position: { x, y }, width: w, height: h }
}

describe('pickHandles', () => {
  test('connects right to left when the target is to the right', () => {
    expect(pickHandles(box(0, 0), box(400, 0))).toEqual({
      sourceHandle: 'right',
      targetHandle: 'left',
    })
  })

  test('connects left to right when the target is to the left', () => {
    expect(pickHandles(box(400, 0), box(0, 0))).toEqual({
      sourceHandle: 'left',
      targetHandle: 'right',
    })
  })

  test('connects bottom to top when the target is below', () => {
    expect(pickHandles(box(0, 0), box(0, 300))).toEqual({
      sourceHandle: 'bottom',
      targetHandle: 'top',
    })
  })

  test('connects top to bottom when the target is above', () => {
    expect(pickHandles(box(0, 300), box(0, 0))).toEqual({
      sourceHandle: 'top',
      targetHandle: 'bottom',
    })
  })
})

describe('sourceTargetForDrag', () => {
  test('keeps React Flow order when it already matches the drag', () => {
    expect(sourceTargetForDrag('no', { source: 'no', target: 'hitl' })).toEqual({
      source: 'no',
      target: 'hitl',
    })
  })

  test('unswaps when handle types flipped the connection', () => {
    expect(sourceTargetForDrag('no', { source: 'hitl', target: 'no' })).toEqual({
      source: 'no',
      target: 'hitl',
    })
  })
})
