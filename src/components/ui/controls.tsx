import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { ChevronDownIcon } from './icons'

/*
  One control vocabulary for the whole app. Inputs sit in a slightly recessed
  "field" surface with a hairline border; focus is a soft 3px ring in the
  accent, never a hard outline. Primary actions use ink (the text color) so the
  saffron accent stays reserved for selection and state.
*/

export const controlClass =
  'w-full bg-field text-text placeholder:text-faint border border-border rounded-md px-3 py-[7px] text-sm leading-[1.4] outline-none ' +
  'transition-[border-color,box-shadow,background-color] duration-150 ' +
  'hover:border-strong focus:border-accent focus:shadow-focus ' +
  'disabled:opacity-50 disabled:cursor-not-allowed'

export function Field({
  label,
  hint,
  htmlFor,
  trailing,
  children,
  className,
}: {
  label: string
  hint?: string
  htmlFor?: string
  trailing?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-xs font-medium text-muted select-none">
          {label}
        </label>
        {trailing}
      </div>
      {children}
      {hint ? <p className="m-0 text-2xs leading-snug text-faint">{hint}</p> : null}
    </div>
  )
}

export function SectionLabel({ children, trailing, className }: { children: ReactNode; trailing?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-2', className)}>
      <span className="text-2xs font-semibold tracking-[0.08em] uppercase text-faint select-none">{children}</span>
      {trailing}
    </div>
  )
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className, ...props }, ref) {
    return <input ref={ref} className={cn(controlClass, className)} {...props} />
  },
)

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(controlClass, 'min-h-[9rem] resize-y leading-relaxed', className)} {...props} />
  },
)

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(controlClass, 'appearance-none pr-9 cursor-pointer', className)} {...props}>
        {children}
      </select>
      <ChevronDownIcon
        size={14}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-faint"
      />
    </div>
  )
}

type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger' | 'icon'
type ButtonSize = 'sm' | 'md'

const variantClass: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-ink-fg border-transparent hover:opacity-90 active:opacity-80',
  accent: 'bg-accent text-accent-fg border-transparent hover:brightness-105 active:brightness-95',
  secondary: 'bg-surface text-text border-border hover:bg-elevated hover:border-strong active:bg-elevated',
  ghost: 'bg-transparent text-muted border-transparent hover:bg-elevated hover:text-text active:bg-elevated',
  danger: 'bg-transparent text-danger border-transparent hover:bg-danger-soft active:bg-danger-soft',
  icon: 'bg-transparent text-muted border-transparent hover:bg-elevated hover:text-text active:bg-elevated p-0 shrink-0',
}

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-8 px-3 text-sm gap-2',
}

const iconSizeClass: Record<ButtonSize, string> = {
  sm: 'w-7 h-7',
  md: 'w-8 h-8',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-md border font-medium whitespace-nowrap select-none',
        'cursor-pointer transition-[background-color,border-color,color,opacity] duration-150',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent',
        variant === 'icon' ? iconSizeClass[size] : sizeClass[size],
        variantClass[variant],
        className,
      )}
      {...props}
    />
  )
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-sm border border-border bg-elevated',
        'font-mono text-[10.5px] font-medium text-muted leading-none',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

export function MenuItem({
  className,
  destructive,
  icon,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { destructive?: boolean; icon?: ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-2.5 px-2.5 h-8 rounded text-left text-sm cursor-pointer border-none bg-transparent',
        'transition-colors duration-100',
        destructive ? 'text-danger hover:bg-danger-soft' : 'text-text hover:bg-elevated',
        className,
      )}
      {...props}
    >
      {icon ? <span className={cn('shrink-0', destructive ? 'text-danger' : 'text-muted')}>{icon}</span> : null}
      <span className="flex-1 truncate">{children}</span>
    </button>
  )
}

export const chromeClass =
  'bg-chrome backdrop-blur-[10px] border border-border shadow-chrome rounded-lg'

export const menuClass =
  'bg-overlay border border-border shadow-menu rounded-lg p-1'
