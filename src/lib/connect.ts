export const HANDLE_SIDES = ['top', 'right', 'bottom', 'left'] as const
export type HandleSide = (typeof HANDLE_SIDES)[number]

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

/** Pick opposite sides so the edge lands on the facing edges of two cards. */
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

/**
 * React Flow's onConnect `source`/`target` follow handle types, not drag
 * direction. Keep the node the user dragged from as the edge source.
 */
export function sourceTargetForDrag(
  fromNodeId: string,
  connection: { source: string; target: string },
): { source: string; target: string } {
  const { source, target } = connection
  if (source === fromNodeId) return { source, target }
  if (target === fromNodeId) return { source: target, target: source }
  return { source, target }
}
