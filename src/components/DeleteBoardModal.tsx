import { useEffect, useId, useRef, useState } from 'react'
import { Button, Field, TextInput } from './ui/controls'
import { CloseIcon } from './ui/icons'

export default function DeleteBoardModal({
  title,
  onConfirm,
  onClose,
}: {
  title: string
  onConfirm: () => Promise<void>
  onClose: () => void
}) {
  const titleId = useId()
  const inputId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const matches = typed === title

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      if (!busy) onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [busy, onClose])

  const submit = async () => {
    if (!matches || busy) return
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this board')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-canvas/35"
        aria-label="Cancel delete"
        onClick={() => { if (!busy) onClose() }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="animate-pop absolute left-1/2 top-[18%] w-[min(100%-2rem,22rem)] rounded-lg border border-border bg-overlay p-4 shadow-menu outline-none"
        style={{ ['--pop-x' as string]: '-50%', ['--pop-y' as string]: '0%' }}
      >
        <header className="mb-3 flex items-center justify-between gap-3">
          <h2 id={titleId} className="m-0 text-sm font-semibold text-text">
            Delete board
          </h2>
          <Button
            type="button"
            variant="icon"
            size="sm"
            onClick={onClose}
            disabled={busy}
            aria-label="Cancel delete"
            title="Close (Esc)"
          >
            <CloseIcon size={15} />
          </Button>
        </header>

        <p className="m-0 mb-3 text-sm leading-snug text-muted">
          This removes the board file. Nested boards stay in the list. Type the name to confirm.
        </p>

        <form
          onSubmit={e => {
            e.preventDefault()
            void submit()
          }}
          className="flex flex-col gap-3"
        >
          <Field label="Board name" htmlFor={inputId} hint={`Type ${title} exactly`}>
            <TextInput
              ref={inputRef}
              id={inputId}
              value={typed}
              autoComplete="off"
              spellCheck={false}
              onChange={e => setTyped(e.target.value)}
              placeholder={title}
            />
          </Field>
          {error ? <p className="m-0 text-2xs text-danger">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" size="sm" disabled={!matches || busy}>
              {busy ? 'Deleting' : 'Delete'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
