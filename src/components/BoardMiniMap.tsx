import { useState } from 'react'
import { MiniMap, Panel } from '@xyflow/react'
import { Button, chromeClass } from './ui/controls'
import { CloseIcon, MapIcon } from './ui/icons'
import type { ThemeColors } from '@/theme/useThemeColors'
import { cn } from '@/lib/cn'

const STORAGE_KEY = 'diagramkit-minimap'

function readVisible() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'hidden'
  } catch {
    return true
  }
}

export default function BoardMiniMap({ colors }: { colors: ThemeColors }) {
  const [visible, setVisible] = useState(readVisible)

  const persist = (next: boolean) => {
    setVisible(next)
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'visible' : 'hidden')
    } catch {
      // ignore
    }
  }

  if (!visible) {
    return (
      <Panel position="bottom-right" className="pointer-events-auto !m-3">
        <Button
          type="button"
          variant="icon"
          className={cn(chromeClass, 'text-muted')}
          onClick={() => persist(true)}
          title="Show board map"
          aria-label="Show board map"
        >
          <MapIcon size={15} />
        </Button>
      </Panel>
    )
  }

  return (
    <>
      <MiniMap
        pannable
        zoomable
        ariaLabel="Board map"
        nodeColor={() => colors.faint}
        nodeStrokeColor={() => colors.surface}
        nodeStrokeWidth={2}
        nodeBorderRadius={4}
        maskColor={colors.minimapMask}
        bgColor={colors.canvas}
        style={{ margin: 12 }}
      />
      <Panel
        position="bottom-right"
        className="pointer-events-none !m-3 !bg-transparent !p-0 !border-none !shadow-none"
        style={{ width: 200, height: 150 }}
      >
        <Button
          type="button"
          variant="icon"
          size="sm"
          className="pointer-events-auto absolute top-1 right-1 h-6 w-6 bg-chrome text-faint hover:text-text opacity-0 transition-opacity [.react-flow:hover_&]:opacity-100 focus-visible:opacity-100"
          onClick={() => persist(false)}
          title="Hide board map"
          aria-label="Hide board map"
        >
          <CloseIcon size={12} />
        </Button>
      </Panel>
    </>
  )
}
