import { useEffect, useId, useRef, useState } from 'react'
import { Button, Field, TextInput } from './ui/controls'
import { CloseIcon, SettingsIcon } from './ui/icons'
import { useSettings } from '@/settings/SettingsProvider'
import { parseOpacity } from '@/lib/settings'

export function SettingsButton({
  open,
  onClick,
  className,
}: {
  open: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <Button
      type="button"
      variant="icon"
      className={className}
      onClick={onClick}
      title="Settings"
      aria-label="Settings"
      aria-haspopup="dialog"
      aria-expanded={open}
    >
      <SettingsIcon size={15} />
    </Button>
  )
}

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const { settings, setSidebarLeftOpacity, setSidebarRightOpacity } = useSettings()

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

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-canvas/35"
        aria-label="Close settings"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="animate-pop absolute left-1/2 top-[18%] w-[min(100%-2rem,20rem)] rounded-lg border border-border bg-overlay p-4 shadow-menu outline-none"
        style={{ ['--pop-x' as string]: '-50%', ['--pop-y' as string]: '0%' }}
      >
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="m-0 text-sm font-semibold text-text">
            Settings
          </h2>
          <Button type="button" variant="icon" size="sm" onClick={onClose} aria-label="Close settings" title="Close (Esc)">
            <CloseIcon size={15} />
          </Button>
        </header>

        <div className="flex flex-col gap-4">
          <OpacityField
            label="Boards sidebar"
            value={settings.sidebarLeftOpacity}
            onChange={setSidebarLeftOpacity}
          />
          <OpacityField
            label="Node editor"
            value={settings.sidebarRightOpacity}
            onChange={setSidebarRightOpacity}
          />
        </div>
      </div>
    </div>
  )
}

function OpacityField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  const sliderId = useId()
  const inputId = useId()
  const [draft, setDraft] = useState(String(value))

  useEffect(() => {
    setDraft(String(value))
  }, [value])

  const commitDraft = () => {
    const next = parseOpacity(draft, value)
    onChange(next)
    setDraft(String(next))
  }

  return (
    <Field label={label} htmlFor={sliderId}>
      <div className="flex items-center gap-3">
        <input
          id={sliderId}
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="dk-slider min-w-0 flex-1"
          style={{ ['--slider-pct' as string]: `${value}%` }}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={value}
          aria-valuetext={`${value} percent`}
        />
        <div className="relative w-[3.25rem] shrink-0">
          <TextInput
            id={inputId}
            inputMode="numeric"
            min={0}
            max={100}
            value={draft}
            aria-label={`${label} percent`}
            onChange={e => {
              const next = e.target.value
              setDraft(next)
              if (/^\d{1,3}$/.test(next.trim())) {
                const n = Number.parseInt(next, 10)
                if (n >= 0 && n <= 100) onChange(n)
              }
            }}
            onBlur={commitDraft}
            onKeyDown={e => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
            className="px-2 py-[5px] pr-6 text-right font-mono text-xs tabular-nums"
          />
          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-2xs text-faint">
            %
          </span>
        </div>
      </div>
    </Field>
  )
}
