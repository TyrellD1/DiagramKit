import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import {
  ReactFlow,
  Background,
  ConnectionMode,
  useNodesState,
  useEdgesState,
  useNodesInitialized,
  useReactFlow,
  type OnConnect,
  type OnConnectStart,
  type OnConnectEnd,
  type OnNodesChange,
  type OnNodesDelete,
  type OnEdgesDelete,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import AtreidesNode from './AtreidesNode'
import BoardBreadcrumbs from './BoardBreadcrumbs'
import BoardSidebar, { SIDEBAR_WIDTH, readSidebarOpen } from './BoardSidebar'
import BoardMiniMap from './BoardMiniMap'
import CanvasToolbar, { FIT_VIEW_OPTIONS, type InteractionMode } from './CanvasToolbar'
import NodeEditor from './NodeEditor'
import CreateNodeDialog from './CreateNodeDialog'
import EdgeContextMenu from './EdgeContextMenu'
import NodeContextMenu from './NodeContextMenu'
import ThemeToggle from './ThemeToggle'
import ExportButton from './ExportButton'
import SettingsModal, { SettingsButton } from './SettingsModal'
import HistoryModal from './HistoryModal'
import BoardSearchDialog, { BoardSearchButton } from './BoardSearchDialog'
import { Toast, useToast } from './Toast'
import { Kbd, chromeClass } from './ui/controls'
import { useBoard } from '@/hooks/useBoard'
import { useBoardNavigation } from '@/hooks/useBoardNavigation'
import { useNodeActions } from '@/hooks/useNodeActions'
import { useTheme, colorModeOf } from '@/theme/ThemeProvider'
import { useThemeColors } from '@/theme/useThemeColors'
import { parseHandleId, pickHandles, sourceTargetForDrag } from '@/lib/connect'
import { nodeSizesFromFlow } from '@/lib/tidy'
import { isCopyKey, isDuplicateKey, isPasteKey, isRedoKey, isSearchKey, isTypingTarget, isUndoKey } from '@/lib/keyboard'
import { cloneNodeContent, DUPLICATE_OFFSET, readNodeClipboard, writeNodeClipboard } from '@/lib/nodeClipboard'
import { api } from '@/lib/api'
import { activeWorkspaceId, readAppRoute } from '@/lib/route'
import { waitForFlowEdges } from '@/lib/exportReady'
import { uuid } from '@/lib/uuid'
import type { AtreidesNodeData, BoardSearchHit, ChildLink, ReferenceLink, WorkspaceIndex, WorkspaceList } from '@/types'
import type { Node, Edge } from '@xyflow/react'

const nodeTypes = { atreides: AtreidesNode }

function FitViewOnBoard({
  boardId,
  instant,
  empty,
}: {
  boardId: string
  instant?: boolean
  empty?: boolean
}) {
  const initialized = useNodesInitialized()
  const { fitView } = useReactFlow()
  const fittedFor = useRef<string | null>(null)

  useEffect(() => {
    delete document.documentElement.dataset.exportReady
    let cancelled = false
    const markReady = () => {
      if (!cancelled) document.documentElement.dataset.exportReady = '1'
    }
    const afterPaint = () => {
      const finish = () => {
        requestAnimationFrame(() => {
          requestAnimationFrame(markReady)
        })
      }
      if (!instant) {
        finish()
        return
      }
      void waitForFlowEdges().then(() => {
        if (!cancelled) finish()
      })
    }

    // Adding a node flips `initialized` (and `empty` for the first card). Fit
    // once per board mount; later measurement is not a board switch.
    if (fittedFor.current === boardId) {
      afterPaint()
      return () => {
        cancelled = true
        delete document.documentElement.dataset.exportReady
      }
    }

    if (!empty && !initialized) return

    const opts = instant ? { duration: 0, padding: FIT_VIEW_OPTIONS.padding } : FIT_VIEW_OPTIONS
    if (empty) {
      fittedFor.current = boardId
      afterPaint()
      return () => {
        cancelled = true
        delete document.documentElement.dataset.exportReady
      }
    }

    let timer = 0
    const timeout = new Promise<void>(resolve => {
      timer = window.setTimeout(resolve, 2000)
    })
    void Promise.race([fitView(opts).then(() => undefined).catch(() => undefined), timeout]).then(() => {
      if (cancelled) return
      fittedFor.current = boardId
      afterPaint()
    })
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      delete document.documentElement.dataset.exportReady
    }
  }, [initialized, boardId, fitView, instant, empty])

  return null
}

function refLinkToAction(ref: ReferenceLink): ChildLink | null {
  switch (ref.type) {
    case 'url': return { type: 'url', value: ref.target }
    case 'cursor': return ref.target ? { type: 'cursor', path: ref.target } : null
    case 'open': return ref.target ? { type: 'open', path: ref.target } : null
    case 'board': return { type: 'board', boardId: ref.target }
    default: return null
  }
}

interface Props {
  boards: WorkspaceIndex
  workspaces: WorkspaceList
  onWorkspacesChange: (next: WorkspaceList, boardId?: string | null) => void | Promise<void>
  onBoardsChange: (next: WorkspaceIndex) => void
}

export default function BoardCanvas({ boards, workspaces, onWorkspacesChange, onBoardsChange }: Props) {
  const colors = useThemeColors()
  const { theme } = useTheme()
  const workspaceId = activeWorkspaceId(workspaces)
  const exportMode = readAppRoute().exportMode
  const { currentBoardId, boardStack, pushBoard, popToIndex } = useBoardNavigation(workspaceId, boards)
  const {
    board,
    flowNodes,
    flowEdges,
    loading,
    error,
    persistPositions,
    updateNode,
    addNode,
    updateBoardTitle,
    deleteNode,
    addEdge,
    updateEdge,
    deleteEdge,
    addRef,
    deleteRef,
    linkToNewBoard,
    undo,
    redo,
    canUndo,
    canRedo,
    tidy,
    history,
    refreshHistory,
  } = useBoard(currentBoardId)
  const { toast, notify } = useToast()
  const { executeAction } = useNodeActions({ pushBoard, notify })
  const { fitView, screenToFlowPosition } = useReactFlow()

  useEffect(() => {
    if (exportMode) document.documentElement.setAttribute('data-export', '1')
    else document.documentElement.removeAttribute('data-export')
    return () => {
      document.documentElement.removeAttribute('data-export')
      delete document.documentElement.dataset.exportReady
    }
  }, [exportMode])
  const [nodes, setNodes, handleNodesChange] = useNodesState<Node<AtreidesNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [shownBoardId, setShownBoardId] = useState<string | null>(null)
  const connectFrom = useRef<{ nodeId: string; handleId: string | null } | null>(null)

  const onNodesChange: OnNodesChange<Node<AtreidesNodeData>> = useCallback(
    (changes) => {
      handleNodesChange(changes)
      const dragEnd = changes.some(c => c.type === 'position' && c.dragging === false)
      if (dragEnd) {
        queueMicrotask(() => {
          setNodes(current => {
            persistPositions(current)
            return current
          })
        })
      }
    },
    [handleNodesChange, persistPositions, setNodes]
  )

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(readSidebarOpen)
  const [createDialogPos, setCreateDialogPos] = useState<{ x: number; y: number } | null>(null)
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('edit')
  const [edgeMenu, setEdgeMenu] = useState<{ edgeId: string; edgeType: string; position: { x: number; y: number } } | null>(null)
  const [nodeMenu, setNodeMenu] = useState<{ nodeId: string; position: { x: number; y: number } } | null>(null)
  const lastFlowPoint = useRef<{ x: number; y: number } | null>(null)

  const interactionProps = exportMode
    ? {
        panOnDrag: false,
        zoomOnScroll: false,
        zoomOnPinch: false,
        zoomOnDoubleClick: false,
        panOnScroll: false,
        nodesDraggable: false,
        nodesConnectable: false,
        elementsSelectable: false,
      }
    : interactionMode === 'edit'
      ? { panOnDrag: [1, 2] as number[], zoomOnDoubleClick: false, panOnScroll: true }
      : { panOnDrag: true as const, zoomOnDoubleClick: false, panOnScroll: false }

  const handleChildLinkClick = useCallback((data: AtreidesNodeData) => {
    if (data.hasLink && data.linkedBoardId) {
      pushBoard(data.linkedBoardId, data.title)
    } else if (data.childLink) {
      executeAction(data.childLink)
    }
  }, [pushBoard, executeAction])

  const handleRefLinkClick = useCallback((ref: ReferenceLink) => {
    const action = refLinkToAction(ref)
    if (action) {
      if (action.type === 'board') {
        pushBoard(action.boardId, ref.name)
      } else {
        executeAction(action)
      }
    }
  }, [pushBoard, executeAction])

  useLayoutEffect(() => {
    setShownBoardId(null)
  }, [currentBoardId])

  useLayoutEffect(() => {
    const enriched = flowNodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        onChildLinkClick: () => handleChildLinkClick(node.data as AtreidesNodeData),
        onRefLinkClick: handleRefLinkClick,
      },
    }))
    setNodes(enriched)
    setEdges(flowEdges)
    if (!loading && board?.id === currentBoardId) {
      setShownBoardId(currentBoardId)
    }
  }, [flowNodes, flowEdges, setNodes, setEdges, handleChildLinkClick, handleRefLinkClick, loading, board, currentBoardId])

  useEffect(() => {
    setSelectedNodeId(null)
    setCreateDialogPos(null)
    setEdgeMenu(null)
    setNodeMenu(null)
    lastFlowPoint.current = null
  }, [currentBoardId])

  const selectedRfNode = nodes.find(n => n.selected)
  const menuNode = nodeMenu ? board?.nodes.find(n => n.id === nodeMenu.nodeId) : null

  const copyNode = useCallback((nodeId: string) => {
    const source = board?.nodes.find(n => n.id === nodeId)
    if (!source) return
    writeNodeClipboard(source)
  }, [board])

  const duplicateNode = useCallback((nodeId: string) => {
    const source = board?.nodes.find(n => n.id === nodeId)
    if (!source) return
    addNode(cloneNodeContent(source, { x: source.x + DUPLICATE_OFFSET, y: source.y + DUPLICATE_OFFSET }))
  }, [board, addNode])

  const pasteAt = useCallback((screen?: { x: number; y: number }) => {
    const flow = lastFlowPoint.current
      ?? (screen ? screenToFlowPosition(screen) : screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      }))
    lastFlowPoint.current = { x: flow.x + DUPLICATE_OFFSET, y: flow.y + DUPLICATE_OFFSET }
    return flow
  }, [screenToFlowPosition])

  const pasteNode = useCallback(async (screen?: { x: number; y: number }) => {
    const payload = await readNodeClipboard()
    if (!payload) return
    addNode(cloneNodeContent(payload, pasteAt(screen)))
  }, [addNode, pasteAt])

  const openSearchHit = useCallback(async (hit: BoardSearchHit) => {
    setSearchOpen(false)
    if (hit.workspaceId === workspaceId) {
      if (hit.id !== currentBoardId) pushBoard(hit.id, hit.title)
      return
    }
    const next = await api.switchWorkspace({ id: hit.workspaceId })
    await onWorkspacesChange(next, hit.id)
  }, [workspaceId, currentBoardId, pushBoard, onWorkspacesChange])

  useEffect(() => {
    if (exportMode) return
    const onKey = (e: KeyboardEvent) => {
      if (!isSearchKey(e)) return
      e.preventDefault()
      e.stopPropagation()
      setSearchOpen(true)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [exportMode])

  useEffect(() => {
    if (exportMode) return
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (isUndoKey(e)) {
        e.preventDefault()
        void undo()
        return
      }
      if (isRedoKey(e)) {
        e.preventDefault()
        void redo()
        return
      }
      const targetId = nodeMenu?.nodeId ?? selectedRfNode?.id ?? selectedNodeId
      if (isCopyKey(e)) {
        if (!targetId) return
        e.preventDefault()
        copyNode(targetId)
        return
      }
      if (isDuplicateKey(e)) {
        if (!targetId) return
        e.preventDefault()
        duplicateNode(targetId)
        return
      }
      if (isPasteKey(e)) {
        e.preventDefault()
        void pasteNode()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [exportMode, undo, redo, nodeMenu, selectedRfNode, selectedNodeId, copyNode, duplicateNode, pasteNode])

  useEffect(() => {
    if (selectedNodeId && !nodes.some(n => n.id === selectedNodeId)) {
      setSelectedNodeId(null)
    }
  }, [nodes, selectedNodeId])

  const connectNodes = useCallback(
    (fromId: string, toId: string, fromHandle?: string | null, toHandle?: string | null) => {
      if (!fromId || !toId || fromId === toId) return
      const from = nodes.find(n => n.id === fromId)
      const to = nodes.find(n => n.id === toId)
      const geo = from && to
        ? pickHandles(from, to)
        : { sourceHandle: 'right' as const, targetHandle: 'left' as const }
      addEdge({
        id: uuid(),
        source: fromId,
        target: toId,
        sourceHandle: parseHandleId(fromHandle) ?? geo.sourceHandle,
        targetHandle: parseHandleId(toHandle) ?? geo.targetHandle,
        edgeType: 'default',
      })
    },
    [addEdge, nodes],
  )

  const onConnectStart: OnConnectStart = useCallback((_event, params) => {
    connectFrom.current = params.nodeId
      ? { nodeId: params.nodeId, handleId: params.handleId ?? null }
      : null
  }, [])

  const onConnect: OnConnect = useCallback(
    (params) => {
      const fromId = connectFrom.current?.nodeId ?? params.source
      const startedHandle = connectFrom.current?.handleId
      const { source, target, sourceHandle, targetHandle } = sourceTargetForDrag(fromId, params)
      connectNodes(source, target, startedHandle ?? sourceHandle, targetHandle)
      connectFrom.current = null
    },
    [connectNodes],
  )

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, state) => {
      const fromId = connectFrom.current?.nodeId ?? state.fromNode?.id
      const fromHandle = connectFrom.current?.handleId ?? state.fromHandle?.id ?? null
      connectFrom.current = null
      if (state.isValid) return
      if (!fromId) return

      const point = 'changedTouches' in event && event.changedTouches[0]
        ? event.changedTouches[0]
        : event as MouseEvent
      const stack = document.elementsFromPoint(point.clientX, point.clientY)
      let targetId: string | null = null
      let toHandle: string | null = null
      for (const el of stack) {
        if (!(el instanceof Element)) continue
        const handleEl = el.closest('.react-flow__handle')
        const nodeEl = (handleEl ?? el).closest('.react-flow__node')
        const id = nodeEl?.getAttribute('data-id')
        if (id && id !== fromId) {
          targetId = id
          toHandle = handleEl?.getAttribute('data-handleid') ?? null
          break
        }
      }
      if (!targetId) return
      connectNodes(fromId, targetId, fromHandle, toHandle)
    },
    [connectNodes],
  )

  // Backspace/Delete in React Flow only mutates local state; mirror it into the document.
  const onNodesDelete: OnNodesDelete = useCallback((deleted) => {
    deleted.forEach(n => deleteNode(n.id))
    setSelectedNodeId(current => (current && deleted.some(n => n.id === current) ? null : current))
  }, [deleteNode])

  const onEdgesDelete: OnEdgesDelete = useCallback((deleted) => {
    deleted.forEach(e => deleteEdge(e.id))
  }, [deleteEdge])

  const onEdgeClick: EdgeMouseHandler = useCallback(
    (event, edge) => {
      event.stopPropagation()
      setEdgeMenu({
        edgeId: edge.id,
        edgeType: (edge.data as Record<string, unknown>)?.dbEdgeType as string ?? 'default',
        position: { x: event.clientX, y: event.clientY },
      })
    },
    []
  )

  const handleToggleEdgeType = useCallback((edgeId: string, newType: string) => {
    updateEdge(edgeId, newType)
    setEdgeMenu(null)
  }, [updateEdge])

  const handleDeleteEdge = useCallback((edgeId: string) => {
    deleteEdge(edgeId)
    setEdgeMenu(null)
  }, [deleteEdge])

  const onNodeDoubleClick: NodeMouseHandler = useCallback((event, node) => {
    event.stopPropagation()
    setNodeMenu(null)
    setSelectedNodeId(node.id)
  }, [])

  const onNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      event.stopPropagation()
      setCreateDialogPos(null)
      setEdgeMenu(null)
      lastFlowPoint.current = { x: node.position.x + DUPLICATE_OFFSET, y: node.position.y + DUPLICATE_OFFSET }
      if (event.detail > 1) return
      setNodeMenu({ nodeId: node.id, position: { x: event.clientX, y: event.clientY } })
    },
    []
  )

  const onPaneDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      setCreateDialogPos({ x: event.clientX, y: event.clientY })
      setSelectedNodeId(null)
      setNodeMenu(null)
    },
    []
  )

  const onPaneClick = useCallback((event: React.MouseEvent) => {
    lastFlowPoint.current = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    setSelectedNodeId(null)
    setCreateDialogPos(null)
    setEdgeMenu(null)
    setNodeMenu(null)
  }, [screenToFlowPosition])

  const selectedNode = selectedNodeId
    ? nodes.find(n => n.id === selectedNodeId)
    : null

  const handleSidebarNavigate = useCallback((boardId: string, title: string) => {
    pushBoard(boardId, title)
  }, [pushBoard])

  if (error) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-canvas">
        <div className="max-w-sm rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text shadow-card">
          <p className="m-0 font-medium">Could not load this board</p>
          <p className="m-0 mt-1 text-xs text-muted">{error}</p>
        </div>
      </div>
    )
  }

  if (loading || shownBoardId !== currentBoardId) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-canvas text-sm text-faint">
        <span className="animate-fade">Loading board</span>
      </div>
    )
  }

  const isEmpty = nodes.length === 0

  return (
    <div className="w-screen h-screen">
      {!exportMode && (
        <BoardSidebar
          open={sidebarOpen}
          onOpenChange={setSidebarOpen}
          currentBoardId={currentBoardId}
          workspaces={workspaces}
          onSelectBoard={handleSidebarNavigate}
          onWorkspacesChange={onWorkspacesChange}
          onBoardsChange={onBoardsChange}
          onRenameCurrent={updateBoardTitle}
        />
      )}
      {!exportMode && (
        <BoardBreadcrumbs
          stack={boardStack}
          onNavigate={popToIndex}
          offsetLeft={sidebarOpen ? SIDEBAR_WIDTH + 12 : 56}
        />
      )}
      {!exportMode && (
        <div
          className="fixed top-3 z-40 flex items-center gap-1.5"
          style={{ right: selectedNode ? 412 : 12 }}
        >
          {!selectedNode && (
            <ExportButton
              boardId={currentBoardId}
              boardTitle={boardStack[boardStack.length - 1]?.boardTitle ?? 'Board'}
              theme={theme}
              className={chromeClass}
              onError={notify}
            />
          )}
          <BoardSearchButton
            open={searchOpen}
            onClick={() => setSearchOpen(true)}
            className={chromeClass}
          />
          <SettingsButton
            open={settingsOpen}
            onClick={() => setSettingsOpen(true)}
            className={chromeClass}
          />
          <ThemeToggle className={chromeClass} />
        </div>
      )}
      {searchOpen && !exportMode && (
        <BoardSearchDialog
          workspaces={workspaces}
          currentBoardId={currentBoardId}
          currentWorkspaceId={workspaceId}
          onOpen={hit => { void openSearchHit(hit) }}
          onClose={() => setSearchOpen(false)}
        />
      )}
      {settingsOpen && !exportMode && (
        <SettingsModal onClose={() => setSettingsOpen(false)} />
      )}
      {historyOpen && !exportMode && (
        <HistoryModal
          history={history}
          currentTitle={board?.title ?? 'Board'}
          currentNodeCount={board?.nodes.length ?? 0}
          currentEdgeCount={board?.edges.length ?? 0}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      <ReactFlow
        key={currentBoardId}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onConnectStart={onConnectStart}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={24}
        onEdgeClick={onEdgeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeClick={onNodeClick}
        onNodeContextMenu={(event, node) => {
          event.preventDefault()
          event.stopPropagation()
          setCreateDialogPos(null)
          setEdgeMenu(null)
          lastFlowPoint.current = { x: node.position.x + DUPLICATE_OFFSET, y: node.position.y + DUPLICATE_OFFSET }
          setNodeMenu({ nodeId: node.id, position: { x: event.clientX, y: event.clientY } })
        }}
        onDoubleClick={onPaneDoubleClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        snapToGrid
        snapGrid={[20, 20]}
        colorMode={colorModeOf(theme)}
        deleteKeyCode={['Backspace', 'Delete']}
        {...interactionProps}
      >
        <Background gap={20} size={1} color={colors.grid} bgColor={colors.canvas} />
        {!exportMode && <BoardMiniMap colors={colors} />}
        {!exportMode && (
          <CanvasToolbar
            mode={interactionMode}
            onModeChange={setInteractionMode}
            canUndo={canUndo}
            canRedo={canRedo}
            undoSource={history.undo.at(-1)?.source}
            redoSource={history.redo.at(-1)?.source}
            historyOpen={historyOpen}
            onUndo={() => void undo()}
            onRedo={() => void redo()}
            canTidy={nodes.length > 0}
            onTidy={() => {
              tidy(nodeSizesFromFlow(nodes))
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  void fitView(FIT_VIEW_OPTIONS)
                })
              })
            }}
            onOpenHistory={() => {
              setHistoryOpen(true)
              void refreshHistory()
            }}
            sidebarGutter={sidebarOpen ? SIDEBAR_WIDTH : 0}
          />
        )}
        <FitViewOnBoard boardId={currentBoardId} instant={exportMode} empty={isEmpty} />
      </ReactFlow>

      {isEmpty && !createDialogPos && !exportMode && !searchOpen && (
        <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center">
          <div className="animate-fade flex flex-col items-center gap-2 text-center">
            <p className="m-0 text-base font-medium text-muted">This board is empty</p>
            <p className="m-0 flex items-center gap-1.5 text-sm text-faint">
              Double-click anywhere to add the first node
            </p>
            <p className="m-0 mt-2 flex items-center gap-1.5 text-2xs text-faint">
              <Kbd>V</Kbd> edit <span className="mx-1 opacity-50">·</span> <Kbd>H</Kbd> pan
            </p>
          </div>
        </div>
      )}

      <Toast toast={toast} />

      {edgeMenu && (
        <EdgeContextMenu
          edgeId={edgeMenu.edgeId}
          edgeType={edgeMenu.edgeType}
          position={edgeMenu.position}
          onToggleType={handleToggleEdgeType}
          onDelete={handleDeleteEdge}
          onClose={() => setEdgeMenu(null)}
        />
      )}

      {nodeMenu && menuNode && (
        <NodeContextMenu
          position={nodeMenu.position}
          onCopy={() => {
            copyNode(nodeMenu.nodeId)
            setNodeMenu(null)
          }}
          onDuplicate={() => {
            duplicateNode(nodeMenu.nodeId)
            setNodeMenu(null)
          }}
          onEdit={() => {
            setSelectedNodeId(nodeMenu.nodeId)
            setNodeMenu(null)
          }}
          onClose={() => setNodeMenu(null)}
        />
      )}

      {selectedNode && (
        <NodeEditor
          nodeId={selectedNode.id}
          nodeData={selectedNode.data as AtreidesNodeData}
          onClose={() => setSelectedNodeId(null)}
          onUpdate={(patch) => updateNode(selectedNode.id, patch)}
          onDelete={() => {
            deleteNode(selectedNode.id)
            setSelectedNodeId(null)
          }}
          onAddRef={(ref) => addRef(selectedNode.id, ref)}
          onDeleteRef={(refId) => deleteRef(selectedNode.id, refId)}
          onLinkToNewBoard={() => {
            void linkToNewBoard(selectedNode.id, selectedNode.data.title)
          }}
          onOpenLinkedBoard={() => {
            const data = selectedNode.data as AtreidesNodeData
            if (data.linkedBoardId) pushBoard(data.linkedBoardId, data.title)
          }}
        />
      )}

      {createDialogPos && currentBoardId && (
        <CreateNodeDialog
          screenPosition={createDialogPos}
          onClose={() => setCreateDialogPos(null)}
          onCreate={(title, position) => {
            addNode({
              id: uuid(),
              title,
              description: null,
              x: position.x,
              y: position.y,
              enterBoardId: null,
              childLink: null,
              refs: [],
              color: 'default',
              borderStyle: 'solid',
            })
          }}
        />
      )}
    </div>
  )
}
