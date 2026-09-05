import { useEffect } from 'react'
import { Panel, useReactFlow, useViewport } from '@xyflow/react'
import { chromeClass } from './ui/controls'
import { HandIcon, HistoryIcon, PencilIcon, RedoIcon, UndoIcon } from './ui/icons'
import { cn } from '@/lib/cn'
import { isTypingTarget } from '@/lib/keyboard'
import type { HistorySource } from '@/types'

export type InteractionMode = 'edit' | 'navigate'

/** Same options as the Fit to view button (Shift+1). */
export const FIT_VIEW_OPTIONS = { duration: 250, padding: 0.2 } as const

interface Props {
  mode: InteractionMode
  onModeChange: (mode: InteractionMode) => void
  canUndo?: boolean
  canRedo?: boolean
  undoSource?: HistorySource
  redoSource?: HistorySource
  historyOpen?: boolean
  onUndo?: () => void
  onRedo?: () => void
  onOpenHistory?: () => void
}

function isTyping(target: EventTarget | null) {
  return isTypingTarget(target)
}

const segmentClass =
  'flex h-7 w-8 items-center justify-center rounded-md border-none bg-transparent cursor-pointer transition-colors duration-150'

const toolClass =
  'flex h-7 min-w-7 items-center justify-center rounded-md border-none bg-transparent px-1.5 text-muted cursor-pointer ' +
  'transition-colors duration-150 hover:bg-elevated hover:text-text disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-default'

function sourceSuffix(source?: HistorySource) {
  if (source === 'ui') return ' · UI'
  if (source === 'cli') return ' · CLI'
  return ''
}

/*
  One toolbar for the canvas: mode on the left, zoom on the right. Keyboard:
  V (edit), H (pan), and the usual zoom shortcuts via React Flow.
*/
export default function CanvasToolbar({
  mode,
  onModeChange,
  canUndo,
  canRedo,
  undoSource,
  redoSource,
  historyOpen,
  onUndo,
  onRedo,
  onOpenHistory,
}: Props) {
  const { zoomIn, zoomOut, fitView, zoomTo } = useReactFlow()
  const { zoom } = useViewport()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      if (e.key === 'v' || e.key === 'V') onModeChange('edit')
      if (e.key === 'h' || e.key === 'H') onModeChange('navigate')
      if (e.key === '1' && e.shiftKey) {
        e.preventDefault()
        void fitView(FIT_VIEW_OPTIONS)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onModeChange, fitView])

  return (
    <Panel position="bottom-left" className="pointer-events-auto !m-3">
      <div className={cn('flex items-center gap-1 p-1', chromeClass)} role="toolbar" aria-label="Canvas tools">
        <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Interaction mode">
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'edit'}
            className={cn(segmentClass, mode === 'edit' ? 'bg-elevated text-text' : 'text-muted hover:text-text')}
            onClick={() => onModeChange('edit')}
            title="Edit (V): double-click to add nodes, drag to move"
          >
            <PencilIcon size={14} />
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'navigate'}
            className={cn(segmentClass, mode === 'navigate' ? 'bg-elevated text-text' : 'text-muted hover:text-text')}
            onClick={() => onModeChange('navigate')}
            title="Pan (H): drag anywhere to move the canvas"
          >
            <HandIcon size={14} />
          </button>
        </div>

        <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className={cn(toolClass, historyOpen && 'bg-elevated text-text')}
            onClick={onOpenHistory}
            title="History"
            aria-label="History"
            aria-haspopup="dialog"
            aria-expanded={historyOpen}
          >
            <HistoryIcon size={14} />
          </button>
          <button
            type="button"
            className={toolClass}
            onClick={onUndo}
            disabled={!canUndo}
            title={`Undo (⌘Z)${canUndo ? sourceSuffix(undoSource) : ''}`}
            aria-label="Undo"
          >
            <UndoIcon size={14} />
          </button>
          <button
            type="button"
            className={toolClass}
            onClick={onRedo}
            disabled={!canRedo}
            title={`Redo (⇧⌘Z)${canRedo ? sourceSuffix(redoSource) : ''}`}
            aria-label="Redo"
          >
            <RedoIcon size={14} />
          </button>
        </div>

        <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />

        <div className="flex items-center gap-0.5">
          <button type="button" className={toolClass} onClick={() => void zoomOut({ duration: 150 })} title="Zoom out" aria-label="Zoom out">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
              <path d="M3.5 8h9" />
            </svg>
          </button>
          <button
            type="button"
            className={cn(toolClass, 'w-[46px] font-mono text-[11px] tabular-nums')}
            onClick={() => void zoomTo(1, { duration: 200 })}
            title="Reset to 100%"
            aria-label={`Zoom ${Math.round(zoom * 100)} percent. Reset to 100 percent`}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" className={toolClass} onClick={() => void zoomIn({ duration: 150 })} title="Zoom in" aria-label="Zoom in">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
              <path d="M8 3.5v9M3.5 8h9" />
            </svg>
          </button>
          <button type="button" className={toolClass} onClick={() => void fitView(FIT_VIEW_OPTIONS)} title="Fit to view (Shift+1)" aria-label="Fit to view">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M2.5 6V3.5A1 1 0 013.5 2.5H6M10 2.5h2.5a1 1 0 011 1V6M13.5 10v2.5a1 1 0 01-1 1H10M6 13.5H3.5a1 1 0 01-1-1V10" />
            </svg>
          </button>
        </div>
      </div>
    </Panel>
  )
}
