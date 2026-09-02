import { useState, useEffect, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  type OnConnect,
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
import CanvasToolbar, { type InteractionMode } from './CanvasToolbar'
import NodeEditor from './NodeEditor'
import CreateNodeDialog from './CreateNodeDialog'
import EdgeContextMenu from './EdgeContextMenu'
import ThemeToggle from './ThemeToggle'
import { Toast, useToast } from './Toast'
import { Kbd, chromeClass } from './ui/controls'
import { useBoard } from '@/hooks/useBoard'
import { useBoardNavigation } from '@/hooks/useBoardNavigation'
import { useNodeActions } from '@/hooks/useNodeActions'
import { useTheme } from '@/theme/ThemeProvider'
import { useThemeColors } from '@/theme/useThemeColors'
import { cn } from '@/lib/cn'
import type { AtreidesNodeData, ChildLink, ReferenceLink, WorkspaceList } from '@/types'
import type { Node, Edge } from '@xyflow/react'

const nodeTypes = { atreides: AtreidesNode }

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
  rootBoardId: string
  rootBoardTitle: string
  workspaces: WorkspaceList
  onWorkspacesChange: (next: WorkspaceList) => void
}

export default function BoardCanvas({ rootBoardId, rootBoardTitle, workspaces, onWorkspacesChange }: Props) {
  const colors = useThemeColors()
  const { theme } = useTheme()
  const { currentBoardId, boardStack, initWithRootBoard, pushBoard, popToIndex } = useBoardNavigation()
  const {
    flowNodes,
    flowEdges,
    loading,
    error,
    persistPositions,
    updateNode,
    addNode,
    deleteNode,
    addEdge,
    updateEdge,
    deleteEdge,
    addRef,
    deleteRef,
    linkToNewBoard,
  } = useBoard(currentBoardId)
  const { toast, notify } = useToast()
  const { executeAction } = useNodeActions({ pushBoard, notify })
  const [nodes, setNodes, handleNodesChange] = useNodesState<Node<AtreidesNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

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
  const [sidebarOpen, setSidebarOpen] = useState(readSidebarOpen)
  const [createDialogPos, setCreateDialogPos] = useState<{ x: number; y: number } | null>(null)
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('edit')
  const [edgeMenu, setEdgeMenu] = useState<{ edgeId: string; edgeType: string; position: { x: number; y: number } } | null>(null)

  const interactionProps = interactionMode === 'edit'
    ? { panOnDrag: [1, 2] as number[], zoomOnDoubleClick: false, panOnScroll: true }
    : { panOnDrag: true as const, zoomOnDoubleClick: false, panOnScroll: false }

  useEffect(() => {
    initWithRootBoard(rootBoardId, rootBoardTitle)
  }, [rootBoardId, rootBoardTitle, initWithRootBoard])

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

  useEffect(() => {
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
  }, [flowNodes, flowEdges, setNodes, setEdges, handleChildLinkClick, handleRefLinkClick])

  useEffect(() => {
    setSelectedNodeId(null)
    setCreateDialogPos(null)
    setEdgeMenu(null)
  }, [currentBoardId])

  const onConnect: OnConnect = useCallback(
    (params) => {
      if (!params.source || !params.target) return
      addEdge({
        id: crypto.randomUUID(),
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle ?? null,
        targetHandle: params.targetHandle ?? null,
        edgeType: 'default',
      })
    },
    [addEdge]
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

  const onNodeDoubleClick: NodeMouseHandler = useCallback((_event) => {
    _event.stopPropagation()
  }, [])

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      setSelectedNodeId(node.id)
      setCreateDialogPos(null)
      setEdgeMenu(null)
    },
    []
  )

  const onPaneDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      setCreateDialogPos({ x: event.clientX, y: event.clientY })
      setSelectedNodeId(null)
    },
    []
  )

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
    setCreateDialogPos(null)
    setEdgeMenu(null)
  }, [])

  const selectedNode = selectedNodeId
    ? nodes.find(n => n.id === selectedNodeId)
    : null

  const handleSidebarNavigate = useCallback((boardId: string, title: string) => {
    pushBoard(boardId, title)
  }, [pushBoard])

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-canvas text-sm text-faint">
        <span className="animate-fade">Loading board</span>
      </div>
    )
  }

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

  const isEmpty = nodes.length === 0

  return (
    <div className="w-screen h-screen">
      <BoardSidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        currentBoardId={currentBoardId}
        workspaces={workspaces}
        onSelectBoard={handleSidebarNavigate}
        onWorkspacesChange={onWorkspacesChange}
      />
      <BoardBreadcrumbs
        stack={boardStack}
        onNavigate={popToIndex}
        offsetLeft={sidebarOpen ? SIDEBAR_WIDTH + 12 : 56}
      />
      {!selectedNode && (
        <ThemeToggle className={cn('fixed top-3 right-3 z-40', chromeClass)} />
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeClick={onNodeClick}
        onDoubleClick={onPaneDoubleClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        snapToGrid
        snapGrid={[20, 20]}
        colorMode={theme}
        deleteKeyCode={['Backspace', 'Delete']}
        {...interactionProps}
      >
        <Background gap={20} size={1} color={colors.grid} bgColor={colors.canvas} />
        <BoardMiniMap colors={colors} />
        <CanvasToolbar mode={interactionMode} onModeChange={setInteractionMode} />
      </ReactFlow>

      {isEmpty && !createDialogPos && (
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
              id: crypto.randomUUID(),
              title,
              description: null,
              x: position.x,
              y: position.y,
              enterBoardId: null,
              childLink: null,
              refs: [],
            })
          }}
        />
      )}
    </div>
  )
}
