import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import BoardAutocomplete from './BoardAutocomplete'
import { Button, Field, Kbd, SectionLabel, Select, TextArea, TextInput } from './ui/controls'
import { CloseIcon, FolderIcon, GlobeIcon, LayersIcon, PlusIcon, TerminalIcon, TrashIcon, ArrowRightIcon, BorderSolidIcon, BorderDashedIcon, BorderNoneIcon } from './ui/icons'
import { cn } from '@/lib/cn'
import type { BoardNode, ChildLink, ChildLinkType, AtreidesNodeData, ReferenceLink, LinkType, CardColor, CardBorderStyle } from '@/types'
import {
  CARD_BORDER_LABEL,
  CARD_BORDER_STYLES,
  CARD_COLOR_LABEL,
  CARD_COLORS,
  CARD_EDGE_CLASS,
  CARD_FILL_CLASS,
  normalizeCardBorderStyle,
  normalizeCardColor,
} from '@/lib/cardStyle'

interface Props {
  nodeId: string
  nodeData: AtreidesNodeData
  onClose: () => void
  onUpdate: (patch: Partial<Pick<BoardNode, 'title' | 'description' | 'childLink' | 'color' | 'borderStyle'>>) => void
  onDelete: () => void
  onAddRef: (ref: ReferenceLink) => void
  onDeleteRef: (refId: string) => void
  onLinkToNewBoard: () => void
  onOpenLinkedBoard?: () => void
}

function getChildLinkType(link: ChildLink | null): ChildLinkType | 'none' {
  if (!link) return 'none'
  return link.type
}

function getChildLinkValue(link: ChildLink | null): string {
  if (!link) return ''
  switch (link.type) {
    case 'url': return link.value
    case 'cursor': return link.path
    case 'open': return link.path
    case 'board': return link.boardId
  }
}

function buildChildLink(type: ChildLinkType | 'none', value: string): ChildLink | null {
  if (type === 'none' || !value) return null
  switch (type) {
    case 'url': return { type: 'url', value }
    case 'cursor': return { type: 'cursor', path: value }
    case 'open': return { type: 'open', path: value }
    case 'board': return { type: 'board', boardId: value }
  }
  return null
}

const valuePlaceholder: Record<ChildLinkType, string> = {
  url: 'https://',
  cursor: '/Users/you/project',
  open: '/Users/you/file.pdf',
  board: '',
}

const valueHint: Record<ChildLinkType, string> = {
  url: 'Opens in a new browser tab.',
  cursor: 'The path is copied to your clipboard; the browser cannot launch Cursor directly.',
  open: 'The path is copied to your clipboard; the browser cannot open local files.',
  board: 'Jumps to an existing board without nesting this node under it.',
}

const typeIcon: Record<LinkType, ReactNode> = {
  url: <GlobeIcon size={13} />,
  cursor: <TerminalIcon size={13} />,
  open: <FolderIcon size={13} />,
  board: <LayersIcon size={13} />,
}

const typeLabel: Record<LinkType, string> = {
  url: 'URL',
  cursor: 'Cursor',
  open: 'Path',
  board: 'Board',
}

const borderIcon: Record<CardBorderStyle, ReactNode> = {
  solid: <BorderSolidIcon size={14} />,
  dashed: <BorderDashedIcon size={14} />,
  none: <BorderNoneIcon size={14} />,
}

type SaveStatus = 'idle' | 'pending' | 'saved'

export default function NodeEditor({
  nodeId,
  nodeData,
  onClose,
  onUpdate,
  onDelete,
  onAddRef,
  onDeleteRef,
  onLinkToNewBoard,
  onOpenLinkedBoard,
}: Props) {
  const titleId = useId()
  const descId = useId()
  const linkTypeId = useId()
  const linkValueId = useId()
  const refNameId = useId()
  const refTypeId = useId()
  const refValueId = useId()

  const [title, setTitle] = useState(nodeData.title)
  const [description, setDescription] = useState(nodeData.description ?? '')
  const [color, setColor] = useState<CardColor>(() => normalizeCardColor(nodeData.color))
  const [borderStyle, setBorderStyle] = useState<CardBorderStyle>(() => normalizeCardBorderStyle(nodeData.borderStyle))
  const [linkType, setLinkType] = useState<ChildLinkType | 'none'>(() => getChildLinkType(nodeData.childLink))
  const [linkValue, setLinkValue] = useState(() => getChildLinkValue(nodeData.childLink))
  const [status, setStatus] = useState<SaveStatus>('idle')

  const [addingRef, setAddingRef] = useState(false)
  const [refName, setRefName] = useState('')
  const [refType, setRefType] = useState<ChildLinkType>('url')
  const [refValue, setRefValue] = useState('')
  const refNameRef = useRef<HTMLInputElement>(null)

  const dirtyRef = useRef(false)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTitle(nodeData.title)
    setDescription(nodeData.description ?? '')
    setColor(normalizeCardColor(nodeData.color))
    setBorderStyle(normalizeCardBorderStyle(nodeData.borderStyle))
    setLinkType(getChildLinkType(nodeData.childLink))
    setLinkValue(getChildLinkValue(nodeData.childLink))
    setAddingRef(false)
    setRefName('')
    setRefType('url')
    setRefValue('')
    setStatus('idle')
    dirtyRef.current = false
    // Sync only when the selected node changes so autosave does not wipe in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId])

  const commit = () => {
    onUpdate({
      title: title.trim() || 'Untitled',
      description: description || null,
      childLink: buildChildLink(linkType, linkValue),
      color,
      borderStyle,
    })
    dirtyRef.current = false
  }
  const commitRef = useRef(commit)
  commitRef.current = commit

  // Debounced autosave. Edits mark the form dirty; the whole board is written 500ms after the last keystroke.
  useEffect(() => {
    if (!dirtyRef.current) return
    setStatus('pending')
    const t = setTimeout(() => {
      commitRef.current()
      setStatus('saved')
    }, 500)
    return () => clearTimeout(t)
  }, [title, description, linkType, linkValue, color, borderStyle])

  useEffect(() => {
    if (status !== 'saved') return
    const t = setTimeout(() => setStatus('idle'), 1600)
    return () => clearTimeout(t)
  }, [status])

  // Flush any pending edit when the editor closes or switches node.
  useEffect(() => {
    return () => {
      if (dirtyRef.current) commitRef.current()
    }
  }, [nodeId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (dirtyRef.current) commitRef.current()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (addingRef) requestAnimationFrame(() => refNameRef.current?.focus())
  }, [addingRef])

  const edit = <T,>(setter: (v: T) => void) => (v: T) => {
    dirtyRef.current = true
    setter(v)
  }

  const handleAddRef = () => {
    if (!refName.trim() || !refValue.trim()) return
    onAddRef({
      id: crypto.randomUUID(),
      name: refName.trim(),
      type: refType,
      target: refValue.trim(),
    })
    setRefName('')
    setRefType('url')
    setRefValue('')
    setAddingRef(false)
  }

  return (
    <aside
      className="animate-panel-right fixed top-0 right-0 z-30 flex h-screen w-[400px] max-w-full flex-col border-l border-border bg-surface shadow-panel"
      aria-label="Node editor"
    >
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border pl-5 pr-3">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h2 className="m-0 text-sm font-semibold text-text">Node</h2>
          <span
            className={cn(
              'text-2xs transition-opacity duration-200',
              status === 'idle' ? 'opacity-0' : 'opacity-100',
              status === 'pending' ? 'text-faint' : 'text-muted',
            )}
            aria-live="polite"
          >
            {status === 'pending' ? 'Saving' : status === 'saved' ? 'Saved' : ''}
          </span>
        </div>
        <Button type="button" variant="icon" onClick={onClose} aria-label="Close editor" title="Close (Esc)">
          <CloseIcon size={15} />
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
        <div className="flex flex-col gap-4">
          <Field label="Title" htmlFor={titleId}>
            <TextInput
              ref={titleRef}
              id={titleId}
              value={title}
              onChange={e => edit(setTitle)(e.target.value)}
              autoComplete="off"
              className="text-md font-medium"
            />
          </Field>

          <Field
            label="Description"
            htmlFor={descId}
            trailing={<span className="text-2xs text-faint">Markdown</span>}
          >
            <TextArea
              id={descId}
              value={description}
              onChange={e => edit(setDescription)(e.target.value)}
              rows={7}
              placeholder="What is this? Add context, links, or a checklist."
            />
          </Field>
        </div>

        <section className="flex flex-col gap-3">
          <SectionLabel>Appearance</SectionLabel>
          <Field label="Background">
            <div className="flex items-center gap-2" role="radiogroup" aria-label="Card background">
              {CARD_COLORS.map(value => {
                const selected = color === value
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={CARD_COLOR_LABEL[value]}
                    title={CARD_COLOR_LABEL[value]}
                    className={cn(
                      'h-8 w-8 rounded-md border cursor-pointer transition-[box-shadow,border-color] duration-150',
                      CARD_FILL_CLASS[value],
                      value === 'default' ? 'border-border' : CARD_EDGE_CLASS[value],
                      selected
                        ? 'shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--accent)]'
                        : 'hover:border-strong',
                    )}
                    onClick={() => edit(setColor)(value)}
                  />
                )
              })}
            </div>
          </Field>
          <Field label="Border">
            <div
              className="flex gap-0.5 rounded-md border border-border bg-field p-0.5"
              role="radiogroup"
              aria-label="Card border"
            >
              {CARD_BORDER_STYLES.map(value => {
                const selected = borderStyle === value
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    title={CARD_BORDER_LABEL[value]}
                    className={cn(
                      'flex h-7 flex-1 items-center justify-center gap-1.5 rounded text-2xs font-medium cursor-pointer border-none',
                      'transition-colors duration-150',
                      selected ? 'bg-surface text-text shadow-card' : 'bg-transparent text-muted hover:text-text',
                    )}
                    onClick={() => edit(setBorderStyle)(value)}
                  >
                    <span className={selected ? 'text-text' : 'text-faint'}>{borderIcon[value]}</span>
                    {CARD_BORDER_LABEL[value]}
                  </button>
                )
              })}
            </div>
          </Field>
        </section>

        <section className="flex flex-col gap-3">
          <SectionLabel>Primary action</SectionLabel>
          <p className="m-0 -mt-1 text-2xs leading-snug text-faint">
            What the arrow on the card does. To nest a child board under this node, use the Board section below instead.
          </p>
          <Field label="Action" htmlFor={linkTypeId}>
            <Select
              id={linkTypeId}
              value={linkType}
              onChange={e => {
                edit(setLinkType)(e.target.value as ChildLinkType | 'none')
                setLinkValue('')
              }}
            >
              <option value="none">None</option>
              <option value="url">Open URL</option>
              <option value="cursor">Open in Cursor</option>
              <option value="open">Open path</option>
              <option value="board">Jump to board</option>
            </Select>
          </Field>

          {linkType === 'board' ? (
            <Field label="Board" htmlFor={linkValueId} hint={valueHint.board}>
              <BoardAutocomplete id={linkValueId} value={linkValue} onChange={edit(setLinkValue)} />
            </Field>
          ) : linkType !== 'none' ? (
            <Field
              label={linkType === 'url' ? 'URL' : 'Path'}
              htmlFor={linkValueId}
              hint={valueHint[linkType]}
            >
              <TextInput
                id={linkValueId}
                value={linkValue}
                onChange={e => edit(setLinkValue)(e.target.value)}
                placeholder={valuePlaceholder[linkType]}
                autoComplete="off"
                spellCheck={false}
                className="font-mono text-xs"
              />
            </Field>
          ) : null}
        </section>

        <section className="flex flex-col gap-3">
          <SectionLabel
            trailing={
              !addingRef ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setAddingRef(true)} className="-mr-2">
                  <PlusIcon size={13} />
                  Add
                </Button>
              ) : null
            }
          >
            References{nodeData.referenceLinks.length > 0 ? ` · ${nodeData.referenceLinks.length}` : ''}
          </SectionLabel>

          {nodeData.referenceLinks.length > 0 ? (
            <ul className="m-0 -mx-2 flex list-none flex-col p-0">
              {nodeData.referenceLinks.map((ref: ReferenceLink) => (
                <li key={ref.id} className="group/ref flex h-10 items-center gap-2.5 rounded-md px-2 transition-colors hover:bg-elevated">
                  <span className="flex w-5 shrink-0 items-center justify-center text-faint">{typeIcon[ref.type] ?? typeIcon.url}</span>
                  <div className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate text-sm text-text">{ref.name}</span>
                    <span className="truncate font-mono text-[10.5px] text-faint" title={ref.target}>
                      {typeLabel[ref.type]} · {ref.target}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="icon"
                    size="sm"
                    onClick={() => onDeleteRef(ref.id)}
                    className="opacity-0 group-hover/ref:opacity-100 focus-visible:opacity-100 hover:!text-danger"
                    title="Remove reference"
                    aria-label={`Remove ${ref.name}`}
                  >
                    <CloseIcon size={12} />
                  </Button>
                </li>
              ))}
            </ul>
          ) : !addingRef ? (
            <p className="m-0 -mt-1 text-2xs leading-snug text-faint">
              Links shown at the bottom of the card: docs, repos, files, or other boards.
            </p>
          ) : null}

          {addingRef && (
            <form
              onSubmit={e => { e.preventDefault(); handleAddRef() }}
              className="animate-fade flex flex-col gap-3 rounded-lg border border-border bg-canvas p-3"
            >
              <Field label="Name" htmlFor={refNameId}>
                <TextInput
                  ref={refNameRef}
                  id={refNameId}
                  value={refName}
                  onChange={e => setRefName(e.target.value)}
                  autoComplete="off"
                  placeholder="Architecture RFC"
                  onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setAddingRef(false) } }}
                />
              </Field>

              <div className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-2.5">
                <Field label="Type" htmlFor={refTypeId}>
                  <Select
                    id={refTypeId}
                    value={refType}
                    onChange={e => {
                      setRefType(e.target.value as ChildLinkType)
                      setRefValue('')
                    }}
                  >
                    <option value="url">URL</option>
                    <option value="cursor">Cursor</option>
                    <option value="open">Path</option>
                    <option value="board">Board</option>
                  </Select>
                </Field>

                {refType === 'board' ? (
                  <Field label="Board" htmlFor={refValueId}>
                    <BoardAutocomplete id={refValueId} value={refValue} onChange={setRefValue} />
                  </Field>
                ) : (
                  <Field label={refType === 'url' ? 'URL' : 'Path'} htmlFor={refValueId}>
                    <TextInput
                      id={refValueId}
                      value={refValue}
                      onChange={e => setRefValue(e.target.value)}
                      placeholder={valuePlaceholder[refType]}
                      autoComplete="off"
                      spellCheck={false}
                      className="font-mono text-xs"
                    />
                  </Field>
                )}
              </div>

              <div className="flex items-center justify-end gap-1.5 pt-0.5">
                <Button type="button" variant="ghost" size="sm" onClick={() => setAddingRef(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={!refName.trim() || !refValue.trim()}>
                  Add reference
                </Button>
              </div>
            </form>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <SectionLabel>Board</SectionLabel>
          {nodeData.hasLink ? (
            <button
              type="button"
              onClick={onOpenLinkedBoard}
              className="group flex h-11 w-full items-center gap-3 rounded-lg border border-border bg-transparent px-3 text-left cursor-pointer transition-colors hover:bg-elevated hover:border-strong"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-accent-soft text-accent">
                <LayersIcon size={13} />
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-sm text-text">Opens a nested board</span>
                <span className="block truncate text-2xs text-faint">The card arrow enters it</span>
              </span>
              <ArrowRightIcon size={14} className="shrink-0 text-faint transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-text" />
            </button>
          ) : (
            <>
              <Button type="button" variant="secondary" onClick={onLinkToNewBoard} className="!justify-start gap-2.5 !h-10 px-3">
                <LayersIcon size={14} className="text-muted" />
                Link to a new board
              </Button>
              <p className="m-0 -mt-1 text-2xs leading-snug text-faint">
                Creates a child board named after this node. The card arrow will enter it.
              </p>
            </>
          )}
        </section>
      </div>

      <footer className="flex h-12 shrink-0 items-center justify-between border-t border-border px-3">
        <Button type="button" variant="danger" size="sm" onClick={onDelete} className="gap-1.5">
          <TrashIcon size={13} />
          Delete
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => {
            if (dirtyRef.current) commitRef.current()
            onClose()
          }}
        >
          Done
          <Kbd className="bg-transparent border-current text-current opacity-60">⌘↵</Kbd>
        </Button>
      </footer>
    </aside>
  )
}
