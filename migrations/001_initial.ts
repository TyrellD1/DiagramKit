import type { JsonObject } from './types.ts'

/** Implicit boards (no schemaVersion) become version 1. */
export const version = 1

export function up(doc: JsonObject): JsonObject {
  return {
    ...doc,
    nodes: Array.isArray(doc.nodes) ? doc.nodes : [],
    edges: Array.isArray(doc.edges) ? doc.edges : [],
  }
}
