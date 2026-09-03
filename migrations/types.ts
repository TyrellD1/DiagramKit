export type JsonObject = Record<string, unknown>

export interface Migration {
  version: number
  name: string
  up: (doc: JsonObject) => JsonObject
}

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function schemaVersionOf(doc: JsonObject): number {
  const value = doc.schemaVersion
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value
  return 0
}
