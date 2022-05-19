import { ccAPI } from '@buerli.io/classcad'
import { useBuerli } from '@buerli.io/react'
import React from 'react'

export const UndoRedoKeyHandler: React.FC = () => {
  const drId = useBuerli(buerli => buerli.drawing.active)
  const handleUndo = React.useCallback(() => drId && ccAPI.base.undo(drId), [drId])
  const handleRedo = React.useCallback(() => drId && ccAPI.base.redo(drId), [drId])
  useKeyHandler(['z'], true, false, false, undefined, handleUndo)
  useKeyHandler(['y'], true, false, false, undefined, handleRedo)
  return null
}

export const useKeyHandler = (
  keys: string[],
  ctrl: boolean = false,
  shift: boolean = false,
  alt: boolean = false,
  onDown?: (key: string) => void,
  onUp?: (key: string) => void,
) => {
  const handleUp = React.useCallback(
    (e: KeyboardEvent) => {
      if (ctrl && !e.ctrlKey) return
      if (shift && !e.shiftKey) return
      if (alt && !e.altKey) return
      if (keys.indexOf(e.key) >= 0 && onUp) {
        onUp(e.key)
      }
    },
    [ctrl, shift, alt, keys, onUp],
  )

  const handleDown = React.useCallback(
    (e: KeyboardEvent) => {
      if (ctrl && !e.ctrlKey) return
      if (shift && !e.shiftKey) return
      if (alt && !e.altKey) return
      if (keys.indexOf(e.key) >= 0 && onDown) {
        onDown(e.key)
      }
    },
    [ctrl, shift, alt, keys, onDown],
  )

  React.useEffect(() => {
    onUp && window.addEventListener('keyup', handleUp, true)
    onDown && window.addEventListener('keydown', handleDown, true)
    return () => {
      onUp && window.removeEventListener('keyup', handleUp, true)
      onDown && window.removeEventListener('keydown', handleDown, true)
    }
  }, [handleDown, handleUp, onDown, onUp])
  return null
}
