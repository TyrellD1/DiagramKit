import { useId, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { Kbd, TextInput } from './ui/controls'

interface Props {
  screenPosition: { x: number; y: number }
  onClose: () => void
  onCreate: (title: string, position: { x: number; y: number }) => void
}

const WIDTH = 240

export default function CreateNodeDialog({ screenPosition, onClose, onCreate }: Props) {
  const [title, setTitle] = useState('')
  const titleId = useId()
  const { screenToFlowPosition } = useReactFlow()

  const handleCreate = () => {
    if (!title.trim()) return
    const flowPos = screenToFlowPosition(screenPosition)
    onCreate(title.trim(), flowPos)
    onClose()
  }

  // Keep the popover on screen near the viewport edges.
  const left = Math.min(Math.max(screenPosition.x, WIDTH / 2 + 8), window.innerWidth - WIDTH / 2 - 8)
  const above = screenPosition.y > 120
  const top = above ? screenPosition.y - 10 : screenPosition.y + 10

  return (
    <div
      role="dialog"
      aria-label="New node"
      className="animate-pop fixed z-20 rounded-lg border border-border bg-overlay p-2 shadow-menu"
      style={{
        left,
        top,
        width: WIDTH,
        ['--pop-x' as string]: '-50%',
        ['--pop-y' as string]: above ? '-100%' : '0%',
      }}
    >
      <TextInput
        id={titleId}
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') handleCreate()
          if (e.key === 'Escape') onClose()
        }}
        placeholder="Name this node"
        aria-label="Node title"
        autoComplete="off"
        className="font-medium"
      />
      <div className="mt-2 flex items-center justify-between px-0.5 text-2xs text-faint">
        <span className="flex items-center gap-1"><Kbd>↵</Kbd> create</span>
        <span className="flex items-center gap-1"><Kbd>esc</Kbd> cancel</span>
      </div>
    </div>
  )
}
