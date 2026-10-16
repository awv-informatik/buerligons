import { useBuerli, useDrawing } from '@buerli.io/react'
import { sessionClient } from '@buerli.io/react-cad'
import React from 'react'
import { getFilteredRedoStack, getFilteredUndoStack, redoNext, undoNext } from './FileMenu'

export const UndoRedoKeyHandler: React.FC = () => {
  const drId = useBuerli(buerli => buerli.drawing.active)!
  const states = useDrawing(drId, d => d.cad.states)
  const readOnly = sessionClient.useSessionRole() === 'view'

  // (a guest who can only view does not undo, and with nothing to go back to there is nothing to
  // undo. The keys do nothing then, as the buttons)
  const handleUndo = React.useCallback(() => {
    if (readOnly || !states) return
    const stack = getFilteredUndoStack(states)
    if (stack.length > 1) undoNext(drId, states, stack)
  }, [drId, states, readOnly])

  const handleRedo = React.useCallback(() => {
    if (readOnly || !states) return
    redoNext(drId, getFilteredRedoStack(states))
  }, [drId, states, readOnly])

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
