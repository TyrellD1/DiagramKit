import { useCallback } from 'react'
import type { ChildLink } from '@/types'

interface Options {
  pushBoard: (boardId: string, title?: string) => void
  notify?: (message: string) => void
}

export function useNodeActions({ pushBoard, notify }: Options) {
  const executeAction = useCallback((link: ChildLink) => {
    switch (link.type) {
      case 'url':
        window.open(link.value, '_blank', 'noopener,noreferrer')
        break
      case 'cursor':
      case 'open':
        void navigator.clipboard.writeText(link.path).then(
          () => notify?.('Path copied to clipboard'),
          () => notify?.('Could not copy path'),
        )
        break
      case 'board':
        pushBoard(link.boardId)
        break
    }
  }, [pushBoard, notify])

  return { executeAction }
}
