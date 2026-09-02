import { Fragment, memo, type ReactNode } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import ReactMarkdown from 'react-markdown'
import type { AtreidesNodeData, LinkType } from '@/types'
import { cn } from '@/lib/cn'
import { ArrowUpRightIcon, FolderIcon, GlobeIcon, LayersIcon, TerminalIcon } from './ui/icons'

type AtreidesNodeType = Node<AtreidesNodeData, 'atreides'>

function getChildLinkLabel(data: AtreidesNodeData): string {
  if (data.linkedBoardId) return 'Open board'
  if (!data.childLink) return 'Open'
  switch (data.childLink.type) {
    case 'url': return `Open ${data.childLink.value}`
    case 'cursor': return 'Copy path for Cursor'
    case 'open': return `Copy ${data.childLink.path}`
    case 'board': return 'Jump to board'
  }
}

const refTypeIcon: Record<LinkType, ReactNode> = {
  url: <GlobeIcon size={12} />,
  cursor: <TerminalIcon size={12} />,
  open: <FolderIcon size={12} />,
  board: <LayersIcon size={12} />,
}

const refClass =
  'nodrag group/ref flex items-center gap-1.5 min-w-0 py-[3px] text-xs text-muted no-underline bg-transparent border-none p-0 ' +
  'cursor-pointer text-left transition-colors duration-100 hover:text-text'

const NODE_HANDLES = [
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left },
] as const

function AtreidesNode({ data, selected }: NodeProps<AtreidesNodeType>) {
  const showChildLink = data.hasLink || !!data.childLink
  const isBoard = !!data.linkedBoardId || data.childLink?.type === 'board'

  const handleChildLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    data.onChildLinkClick?.()
  }

  return (
    <div
      className={cn(
        'group/node relative bg-surface border rounded-lg px-4 pt-3 pb-3.5 min-w-[168px] max-w-[360px] text-text',
        'transition-[border-color,box-shadow,transform] duration-150 ease-out',
        selected
          ? 'border-accent shadow-[0_0_0_3px_var(--accent-ring),var(--shadow-card-hover)]'
          : 'border-border shadow-card hover:border-strong hover:shadow-card-hover',
      )}
    >
      {NODE_HANDLES.map(({ id, position }) => (
        <Fragment key={id}>
          <Handle type="target" id={id} position={position} isConnectableStart={false} aria-hidden />
          <Handle type="source" id={id} position={position} aria-label={`Connect from ${id}`} />
        </Fragment>
      ))}

      <div className="flex items-start justify-between gap-3">
        <span className="font-semibold text-md leading-[1.3] tracking-[-0.011em] text-text break-words [display:-webkit-box] [-webkit-line-clamp:3] [-webkit-box-orient:vertical] overflow-hidden">
          {data.title}
        </span>
        {showChildLink && (
          <button
            type="button"
            className={cn(
              'nodrag shrink-0 -mr-1 -mt-0.5 inline-flex h-6 items-center justify-center gap-1 rounded border cursor-pointer',
              'transition-[background-color,border-color,color] duration-150',
              isBoard
                ? 'px-1.5 bg-accent-soft border-transparent text-accent hover:bg-accent hover:text-accent-fg'
                : 'w-6 bg-transparent border-border text-muted hover:border-strong hover:text-text hover:bg-elevated',
            )}
            onClick={handleChildLinkClick}
            title={getChildLinkLabel(data)}
            aria-label={getChildLinkLabel(data)}
          >
            {isBoard ? <LayersIcon size={13} /> : <ArrowUpRightIcon size={13} />}
          </button>
        )}
      </div>

      {data.description && (
        <div className="card-prose mt-1.5 text-xs text-muted leading-[1.5] break-words">
          <ReactMarkdown
            components={{
              h1: ({ children }) => <h1 className="text-text text-base font-semibold mt-2 mb-1">{children}</h1>,
              h2: ({ children }) => <h2 className="text-text text-sm font-semibold mt-2 mb-1">{children}</h2>,
              h3: ({ children }) => <h3 className="text-text text-xs font-semibold mt-2 mb-0.5">{children}</h3>,
              p: ({ children }) => <p className="m-0 mb-1.5 last:mb-0 whitespace-pre-wrap">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold text-text">{children}</strong>,
              em: ({ children }) => <em>{children}</em>,
              code: ({ children }) => <code className="font-mono text-[11px] text-text bg-elevated border border-border rounded-sm px-1 py-px">{children}</code>,
              ul: ({ children }) => <ul className="m-0 mb-1.5 pl-3.5 list-disc marker:text-faint">{children}</ul>,
              ol: ({ children }) => <ol className="m-0 mb-1.5 pl-3.5 list-decimal marker:text-faint">{children}</ol>,
              li: ({ children }) => <li className="m-0">{children}</li>,
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" className="nodrag text-text underline decoration-strong underline-offset-2 hover:decoration-accent" onClick={e => e.stopPropagation()}>
                  {children}
                </a>
              ),
              hr: () => <hr className="my-2 border-0 border-t border-border" />,
              blockquote: ({ children }) => <blockquote className="m-0 my-1.5 pl-2.5 border-l border-strong text-muted italic">{children}</blockquote>,
            }}
          >
            {data.description}
          </ReactMarkdown>
        </div>
      )}

      {data.referenceLinks.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-border flex flex-col">
          {data.referenceLinks.map(ref => {
            const icon = <span className="shrink-0 text-faint transition-colors group-hover/ref:text-accent">{refTypeIcon[ref.type] ?? refTypeIcon.url}</span>
            const name = <span className="truncate">{ref.name}</span>
            if (ref.type === 'url') {
              return (
                <a
                  key={ref.id}
                  className={refClass}
                  href={ref.target}
                  onClick={e => e.stopPropagation()}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={ref.target}
                >
                  {icon}{name}
                </a>
              )
            }
            return (
              <button
                key={ref.id}
                type="button"
                className={refClass}
                onClick={(e) => { e.stopPropagation(); data.onRefLinkClick?.(ref) }}
                title={`${ref.type}: ${ref.target}`}
              >
                {icon}{name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default memo(AtreidesNode)
