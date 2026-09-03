export const HANDLE_SIDES = ['top', 'right', 'bottom', 'left'] as const
export type HandleSide = (typeof HANDLE_SIDES)[number]

const TARGET_PREFIX = 't-'

type Box = {
  position: { x: number; y: number }
  measured?: { width?: number; height?: number }
  width?: number
  height?: number
}

function size(node: Box) {
  return {
    w: node.measured?.width ?? node.width ?? 180,
    h: node.measured?.height ?? node.height ?? 80,
  }
}

function center(node: Box) {
  const { w, h } = size(node)
  return { x: node.position.x + w / 2, y: node.position.y + h / 2 }
}

export function isHandleSide(value: string | null | undefined): value is HandleSide {
  return value === 'top' || value === 'right' || value === 'bottom' || value === 'left'
}

/** Target handles need a distinct RF id from sources on the same side. */
export function targetHandleId(side: HandleSide): string {
  return `${TARGET_PREFIX}${side}`
}

/** Strip the target prefix so stored JSON stays `top` | `right` | `bottom` | `left`. */
export function parseHandleId(value: string | null | undefined): HandleSide | null {
  if (!value) return null
  const side = value.startsWith(TARGET_PREFIX) ? value.slice(TARGET_PREFIX.length) : value
  return isHandleSide(side) ? side : null
}

/** Facing sides, used only when a drop did not hit a specific handle. */
export function pickHandles(from: Box, to: Box): { sourceHandle: HandleSide; targetHandle: HandleSide } {
  const a = center(from)
  const b = center(to)
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: 'right', targetHandle: 'left' }
      : { sourceHandle: 'left', targetHandle: 'right' }
  }
  return dy >= 0
    ? { sourceHandle: 'bottom', targetHandle: 'top' }
    : { sourceHandle: 'top', targetHandle: 'bottom' }
}

type DragConnection = {
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}

/**
 * React Flow's onConnect `source`/`target` follow handle types, not drag
 * direction. Keep the node (and handle) the user dragged from as the edge source.
 */
export function sourceTargetForDrag(
  fromNodeId: string,
  connection: DragConnection,
): { source: string; target: string; sourceHandle: string | null; targetHandle: string | null } {
  const sourceHandle = connection.sourceHandle ?? null
  const targetHandle = connection.targetHandle ?? null
  if (connection.source === fromNodeId) {
    return { source: connection.source, target: connection.target, sourceHandle, targetHandle }
  }
  if (connection.target === fromNodeId) {
    return {
      source: connection.target,
      target: connection.source,
      sourceHandle: targetHandle,
      targetHandle: sourceHandle,
    }
  }
  return { source: connection.source, target: connection.target, sourceHandle, targetHandle }
}
