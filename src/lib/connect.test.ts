import { describe, expect, test } from 'vitest'
import {
  parseHandleId,
  pickHandles,
  sourceTargetForDrag,
  targetHandleId,
} from './connect'

function box(x: number, y: number, w = 180, h = 80) {
  return { position: { x, y }, width: w, height: h }
}

describe('parseHandleId', () => {
  test('reads a side id', () => {
    expect(parseHandleId('top')).toBe('top')
  })

  test('strips the target prefix', () => {
    expect(parseHandleId(targetHandleId('right'))).toBe('right')
  })
})

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
  test('keeps React Flow order and handles when they already match the drag', () => {
    expect(sourceTargetForDrag('hitl', {
      source: 'hitl',
      target: 'can',
      sourceHandle: 'top',
      targetHandle: 't-right',
    })).toEqual({
      source: 'hitl',
      target: 'can',
      sourceHandle: 'top',
      targetHandle: 't-right',
    })
  })

  test('unswaps nodes and handles when handle types flipped the connection', () => {
    expect(sourceTargetForDrag('hitl', {
      source: 'can',
      target: 'hitl',
      sourceHandle: 'left',
      targetHandle: 'top',
    })).toEqual({
      source: 'hitl',
      target: 'can',
      sourceHandle: 'top',
      targetHandle: 'left',
    })
  })
})
