import type { CardBorderStyle, CardColor } from './lib/cardStyle'

export type LinkType = 'url' | 'cursor' | 'open' | 'board'
export type ChildLinkType = LinkType
export type { CardBorderStyle, CardColor }

export type ChildLink =
  | { type: 'url'; value: string }
  | { type: 'cursor'; path: string }
  | { type: 'open'; path: string }
  | { type: 'board'; boardId: string }

export interface ReferenceLink {
  id: string
  name: string
  type: LinkType
  target: string
}

export interface BoardNode {
  id: string
  title: string
  description: string | null
  x: number
  y: number
  enterBoardId: string | null
  childLink: ChildLink | null
  refs: ReferenceLink[]
  color: CardColor
  borderStyle: CardBorderStyle
}

export interface BoardEdge {
  id: string
  source: string
  target: string
  sourceHandle: string | null
  targetHandle: string | null
  edgeType: string
}

export interface BoardDocument {
  schemaVersion: number
  id: string
  title: string
  nodes: BoardNode[]
  edges: BoardEdge[]
}

/** Who made a saved edit. Missing header/query on PUT is treated as CLI. */
export type EditSource = 'ui' | 'cli'
/** `unknown` is a legacy unwrapped snapshot in `.history.json`. */
export type HistorySource = EditSource | 'unknown'

export interface HistoryStepSummary {
  source: HistorySource
  at: number
  title: string
  nodeCount: number
  edgeCount: number
}

export interface BoardHistoryView {
  undoSteps: number
  redoSteps: number
  undo: HistoryStepSummary[]
  redo: HistoryStepSummary[]
}

/** Server-sent event. The UI reloads a board only when `source` is `cli`. */
export type LiveEvent =
  | { type: 'board'; id: string; source: EditSource }
  | { type: 'workspace' }

export interface BoardSummary {
  id: string
  title: string
  parentId: string | null
}

export interface WorkspaceIndex {
  rootBoardId: string
  boards: BoardSummary[]
}

/** Stored index on disk — parentId is derived from enterBoardId when listing. */
export interface StoredIndex {
  rootBoardId: string
  boards: Array<{ id: string; title: string }>
}

export interface WorkspaceRecord {
  id: string
  path: string
  name: string
  kind: 'default' | 'attached'
  attachedAt: string
}

export interface WorkspaceList {
  homeDir: string
  appDir: string
  activePath: string
  workspaces: WorkspaceRecord[]
}

export interface AtreidesNodeData {
  title: string
  description: string | null
  childLink: ChildLink | null
  referenceLinks: ReferenceLink[]
  hasLink: boolean
  linkedBoardId: string | null
  dbId: string
  color: CardColor
  borderStyle: CardBorderStyle
  onChildLinkClick?: () => void
  onRefLinkClick?: (ref: ReferenceLink) => void
  [key: string]: unknown
}
