/** True when every edge path has a real bounding box (not stuck at the origin). */
export function flowEdgesHaveGeometry(): boolean {
  const paths = document.querySelectorAll('.react-flow__edge-path')
  if (paths.length === 0) return true
  for (const el of paths) {
    if (!(el instanceof SVGGraphicsElement)) return false
    try {
      const box = el.getBBox()
      if (!Number.isFinite(box.width) || (box.width <= 2 && box.height <= 2)) return false
    } catch {
      return false
    }
  }
  return true
}

export async function waitForFlowEdges(frames = 90): Promise<void> {
  for (let i = 0; i < frames; i++) {
    if (flowEdgesHaveGeometry()) return
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  }
}
