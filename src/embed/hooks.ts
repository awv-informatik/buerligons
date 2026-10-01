import { useDrawing } from '@buerli.io/react'
import React from 'react'
import { EditorController, EditorStatus, stateMarkerOf } from './EditorController'

/** Current status of the controller, re-rendered on every change. */
export const useEditorStatus = (controller: EditorController): EditorStatus => {
  const [status, setStatus] = React.useState(controller.getStatus())
  React.useEffect(() => {
    setStatus(controller.getStatus())
    return controller.subscribe(setStatus)
  }, [controller])
  return status
}

/** True while the drawing is at another undo state than the one last opened or saved. */
export const useEditorDirty = (controller: EditorController): boolean => {
  const status = useEditorStatus(controller)
  const drawingId = status.drawingId ?? ''
  const current = useDrawing(drawingId, d => stateMarkerOf(d.cad.states))
  return Boolean(status.drawingId) && status.savedState !== null && current !== undefined && current !== null && current !== status.savedState
}

/**
 * Calls `onSnapshot` with the serialised drawing whenever it has been dirty for `intervalMs`.
 * Errors of `onSnapshot` are reported through `onError` and do not stop the autosave.
 */
export const useAutosave = (
  controller: EditorController,
  options: { intervalMs: number; enabled?: boolean; onSnapshot: (bytes: Uint8Array) => Promise<void>; onError?: (e: unknown) => void },
) => {
  const dirty = useEditorDirty(controller)
  const status = useEditorStatus(controller)
  const { intervalMs, enabled = true, onSnapshot, onError } = options
  const busy = React.useRef(false)

  React.useEffect(() => {
    if (!enabled || !dirty || status.state !== 'ready') return
    const timer = window.setTimeout(async () => {
      if (busy.current) return
      busy.current = true
      try {
        const bytes = await controller.save('OFB')
        await onSnapshot(bytes)
      } catch (error) {
        onError?.(error)
      } finally {
        busy.current = false
      }
    }, intervalMs)
    return () => window.clearTimeout(timer)
  }, [controller, dirty, enabled, intervalMs, onError, onSnapshot, status.state])
}
