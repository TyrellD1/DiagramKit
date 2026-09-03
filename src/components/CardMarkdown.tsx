import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/cn'

export const cardRemarkPlugins = [remarkGfm]

function cellAlign(align?: string) {
  if (align === 'right') return 'text-right'
  if (align === 'center') return 'text-center'
  return 'text-left'
}

export const cardMarkdownComponents: Components = {
  h1: ({ children }) => <h1 className="text-text text-base font-semibold mt-2 mb-1">{children}</h1>,
  h2: ({ children }) => <h2 className="text-text text-sm font-semibold mt-2 mb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="text-text text-xs font-semibold mt-2 mb-0.5">{children}</h3>,
  p: ({ children }) => <p className="m-0 mb-1.5 last:mb-0 whitespace-pre-wrap">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-text">{children}</strong>,
  em: ({ children }) => <em>{children}</em>,
  del: ({ children }) => <del className="text-muted line-through">{children}</del>,
  code: ({ children }) => (
    <code className="font-mono text-[11px] text-text bg-elevated border border-border rounded-sm px-1 py-px">
      {children}
    </code>
  ),
  ul: ({ children }) => <ul className="m-0 mb-1.5 pl-3.5 list-disc marker:text-faint">{children}</ul>,
  ol: ({ children }) => <ol className="m-0 mb-1.5 pl-3.5 list-decimal marker:text-faint">{children}</ol>,
  li: ({ children }) => <li className="m-0">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="nodrag text-text underline decoration-strong underline-offset-2 hover:decoration-accent"
      onClick={e => e.stopPropagation()}
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-2 border-0 border-t border-border" />,
  blockquote: ({ children }) => (
    <blockquote className="m-0 my-1.5 pl-2.5 border-l border-strong text-muted italic">{children}</blockquote>
  ),
  table: ({ children }) => (
    <div
      className="nodrag nowheel nopan my-1.5 first:mt-0 last:mb-0 overflow-x-auto overscroll-x-contain"
      role="region"
      aria-label="Table"
    >
      <table className="w-full border-collapse text-2xs tabular-nums">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody className="[&_tr:last-child_td]:border-b-0">{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children, align, style }) => (
    <th
      style={style}
      className={cn(
        'px-2 py-1 font-medium text-text border-b border-strong bg-elevated',
        cellAlign(align),
      )}
    >
      {children}
    </th>
  ),
  td: ({ children, align, style }) => (
    <td
      style={style}
      className={cn('px-2 py-1 align-top text-muted border-b border-border', cellAlign(align))}
    >
      {children}
    </td>
  ),
}
