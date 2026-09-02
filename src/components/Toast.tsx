import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckIcon } from './ui/icons'
import { chromeClass } from './ui/controls'
import { cn } from '@/lib/cn'

export interface ToastMessage {
  id: number
  text: string
}

export function useToast(duration = 1800) {
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const counter = useRef(0)

  const notify = useCallback((text: string) => {
    counter.current += 1
    setToast({ id: counter.current, text })
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), duration)
    return () => clearTimeout(t)
  }, [toast, duration])

  return { toast, notify }
}

export function Toast({ toast }: { toast: ToastMessage | null }) {
  if (!toast) return null
  return (
    <div
      key={toast.id}
      role="status"
      aria-live="polite"
      className={cn(
        'animate-pop fixed bottom-4 left-1/2 z-50 flex h-8 items-center gap-2 px-3 text-sm text-text pointer-events-none',
        chromeClass,
      )}
      style={{ ['--pop-x' as string]: '-50%', ['--pop-y' as string]: '0%' }}
    >
      <CheckIcon size={13} className="text-accent" />
      {toast.text}
    </div>
  )
}
