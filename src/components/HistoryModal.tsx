import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Button } from './ui/controls'
import { CloseIcon } from './ui/icons'
import type { BoardHistoryView, HistorySource, HistoryStepSummary } from '@/types'

function sourceLabel(source: HistorySource) {
  if (source === 'ui') return 'UI'
  if (source === 'cli') return 'CLI'
  return 'Unknown'
}

function formatTime(at: number) {
  if (!at) return null
  return new Date(at).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function countLabel(nodes: number, edges: number) {
  const n = `${nodes} ${nodes === 1 ? 'node' : 'nodes'}`
  const e = `${edges} ${edges === 1 ? 'edge' : 'edges'}`
  return `${n} · ${e}`
}

export default function HistoryModal({
  history,
  currentTitle,
  currentNodeCount,
  currentEdgeCount,
  onClose,
}: {
  history: BoardHistoryView
  currentTitle: string
  currentNodeCount: number
  currentEdgeCount: number
  onClose: () => void
}) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const undo = [...history.undo].reverse()
  const redo = [...history.redo].reverse()

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-canvas/35"
        aria-label="Close history"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="animate-pop absolute left-1/2 top-[14%] flex max-h-[min(72vh,32rem)] w-[min(100%-2rem,22rem)] flex-col rounded-lg border border-border bg-overlay p-4 shadow-menu outline-none"
        style={{ ['--pop-x' as string]: '-50%', ['--pop-y' as string]: '0%' }}
      >
        <header className="mb-3 flex items-center justify-between gap-3">
          <h2 id={titleId} className="m-0 text-sm font-semibold text-text">
            History
          </h2>
          <Button type="button" variant="icon" size="sm" onClick={onClose} aria-label="Close history" title="Close (Esc)">
            <CloseIcon size={15} />
          </Button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          <Section title="Undo" empty="Nothing to undo">
            {undo.map((step, i) => (
              <StepRow key={`undo-${i}-${step.at}`} step={step} hint={i === 0 ? 'Next ⌘Z' : undefined} />
            ))}
          </Section>

          <div className="rounded-md border border-border bg-elevated px-2.5 py-2">
            <div className="text-2xs font-medium uppercase tracking-wide text-muted">Now</div>
            <div className="mt-0.5 truncate text-sm text-text">{currentTitle}</div>
            <div className="text-2xs text-faint">{countLabel(currentNodeCount, currentEdgeCount)}</div>
          </div>

          <Section title="Redo" empty="Nothing to redo">
            {redo.map((step, i) => (
              <StepRow key={`redo-${i}-${step.at}`} step={step} hint={i === 0 ? 'Next ⇧⌘Z' : undefined} />
            ))}
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({
  title,
  empty,
  children,
}: {
  title: string
  empty: string
  children: ReactNode
}) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return (
    <section>
      <h3 className="m-0 mb-1.5 text-2xs font-medium uppercase tracking-wide text-muted">{title}</h3>
      {hasItems ? (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">{children}</ul>
      ) : (
        <p className="m-0 text-2xs text-faint">{empty}</p>
      )}
    </section>
  )
}

function StepRow({ step, hint }: { step: HistoryStepSummary; hint?: string }) {
  const time = formatTime(step.at)
  return (
    <li className="rounded-md border border-border px-2.5 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xs font-medium uppercase tracking-wide text-muted">{sourceLabel(step.source)}</span>
        {time ? <span className="text-2xs text-faint">{time}</span> : null}
      </div>
      <div className="mt-0.5 truncate text-sm text-text">{step.title}</div>
      <div className="flex items-baseline justify-between gap-2 text-2xs text-faint">
        <span>{countLabel(step.nodeCount, step.edgeCount)}</span>
        {hint ? <span>{hint}</span> : null}
      </div>
    </li>
  )
}
