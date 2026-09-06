import { normalizeCardBorderStyle, normalizeCardColor } from './cardStyle'
import { uuid } from './uuid'
import type { BoardNode, ChildLink, LinkType, ReferenceLink } from '@/types'

export const NODE_CLIPBOARD_PREFIX = 'diagramkit-node:v1:'
export const DUPLICATE_OFFSET = 40

export type NodeClipboardPayload = {
  title: string
  description: string | null
  childLink: ChildLink | null
  refs: Array<{ name: string; type: LinkType; target: string }>
  color: BoardNode['color']
  borderStyle: BoardNode['borderStyle']
}

const LINK_TYPES: LinkType[] = ['url', 'cursor', 'open', 'board']

let memory: NodeClipboardPayload | null = null

export function nodeClipboardContent(node: BoardNode): NodeClipboardPayload {
  return {
    title: node.title,
    description: node.description,
    childLink: node.childLink ? { ...node.childLink } : null,
    refs: node.refs.map(ref => ({ name: ref.name, type: ref.type, target: ref.target })),
    color: node.color,
    borderStyle: node.borderStyle,
  }
}

export function serializeNodeClipboard(payload: NodeClipboardPayload): string {
  return NODE_CLIPBOARD_PREFIX + JSON.stringify(payload)
}

export function parseNodeClipboard(text: string): NodeClipboardPayload | null {
  const raw = text.trim()
  if (!raw.startsWith(NODE_CLIPBOARD_PREFIX)) return null
  try {
    return normalizePayload(JSON.parse(raw.slice(NODE_CLIPBOARD_PREFIX.length)))
  } catch {
    return null
  }
}

export function rememberNodeClipboard(payload: NodeClipboardPayload) {
  memory = payload
}

export function readNodeClipboardMemory(): NodeClipboardPayload | null {
  return memory
}

export function writeNodeClipboard(node: BoardNode) {
  const payload = nodeClipboardContent(node)
  rememberNodeClipboard(payload)
  const text = serializeNodeClipboard(payload)
  void navigator.clipboard?.writeText(text).catch(() => {})
  return payload
}

export async function readNodeClipboard(): Promise<NodeClipboardPayload | null> {
  if (memory) return memory
  try {
    const text = await navigator.clipboard.readText()
    return parseNodeClipboard(text)
  } catch {
    return null
  }
}

/** New card from clipboard or an existing node. Never copies id, position, edges, or enterBoardId. */
export function cloneNodeContent(source: BoardNode | NodeClipboardPayload, position: { x: number; y: number }): BoardNode {
  const refs = 'refs' in source && Array.isArray(source.refs) ? source.refs : []
  return {
    id: uuid(),
    title: source.title,
    description: source.description ?? null,
    x: position.x,
    y: position.y,
    enterBoardId: null,
    childLink: source.childLink ? { ...source.childLink } : null,
    refs: refs.map(ref => ({
      id: uuid(),
      name: ref.name,
      type: ref.type,
      target: ref.target,
    })),
    color: normalizeCardColor(source.color),
    borderStyle: normalizeCardBorderStyle(source.borderStyle),
  }
}

function normalizePayload(value: unknown): NodeClipboardPayload | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (typeof raw.title !== 'string') return null
  const refs = Array.isArray(raw.refs) ? raw.refs.flatMap(parseRef) : []
  return {
    title: raw.title,
    description: typeof raw.description === 'string' ? raw.description : null,
    childLink: parseChildLink(raw.childLink),
    refs,
    color: normalizeCardColor(raw.color),
    borderStyle: normalizeCardBorderStyle(raw.borderStyle),
  }
}

function parseRef(value: unknown): ReferenceLink[] {
  if (!value || typeof value !== 'object') return []
  const raw = value as Record<string, unknown>
  if (typeof raw.name !== 'string' || typeof raw.target !== 'string') return []
  if (!isLinkType(raw.type)) return []
  return [{ id: '', name: raw.name, type: raw.type, target: raw.target }]
}

function parseChildLink(value: unknown): ChildLink | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (raw.type === 'url' && typeof raw.value === 'string') return { type: 'url', value: raw.value }
  if (raw.type === 'cursor' && typeof raw.path === 'string') return { type: 'cursor', path: raw.path }
  if (raw.type === 'open' && typeof raw.path === 'string') return { type: 'open', path: raw.path }
  if (raw.type === 'board' && typeof raw.boardId === 'string') return { type: 'board', boardId: raw.boardId }
  return null
}

function isLinkType(value: unknown): value is LinkType {
  return typeof value === 'string' && LINK_TYPES.includes(value as LinkType)
}
