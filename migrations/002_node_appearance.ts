import type { JsonObject } from './types.ts'
import { isJsonObject } from './types.ts'

const COLORS = new Set(['default', 'red', 'yellow', 'blue'])
const BORDERS = new Set(['solid', 'dashed', 'none'])

/** Adds card fill and border style; existing look is default + solid. */
export const version = 2

export function up(doc: JsonObject): JsonObject {
  const nodes = Array.isArray(doc.nodes)
    ? doc.nodes.map(node => {
        if (!isJsonObject(node)) return node
        return {
          ...node,
          color: COLORS.has(node.color as string) ? node.color : 'default',
          borderStyle: BORDERS.has(node.borderStyle as string) ? node.borderStyle : 'solid',
        }
      })
    : []
  return { ...doc, nodes }
}
