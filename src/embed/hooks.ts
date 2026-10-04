import { ccUtils, ScgClassType } from '@buerli.io/classcad'
import { useDrawing } from '@buerli.io/react'
import React from 'react'
import { EditedPart, EditorController, EditorStatus, productKind, stateMarkerOf } from './EditorController'

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

/** The parts that were changed since the drawing was opened or the host cleared them (see `getEditedParts`). */
export const useEditedParts = (controller: EditorController): EditedPart[] => {
  const [parts, setParts] = React.useState(controller.getEditedParts())
  React.useEffect(() => {
    setParts(controller.getEditedParts())
    return controller.subscribeEditedParts(setParts)
  }, [controller])
  return parts
}

/**
 * The template the user is working in while an assembly is open: the current product when it is a part or a
 * sub-assembly and the drawing is an assembly. `null` in the root assembly itself and in a part drawing.
 */
export const useCurrentPart = (controller: EditorController): EditedPart | null => {
  const status = useEditorStatus(controller)
  const drawingId = status.drawingId ?? ''
  const id = useDrawing(drawingId, d => d.structure.currentProduct)
  const productClass = useDrawing(drawingId, d => (id ? d.structure.tree[id]?.class : undefined))
  const name = useDrawing(drawingId, d => (id ? d.structure.tree[id]?.name : undefined))
  const rootId = useDrawing(drawingId, d => d.structure.root)
  const rootClass = useDrawing(drawingId, d => (d.structure.root ? d.structure.tree[d.structure.root]?.class : undefined))
  return React.useMemo(() => {
    if (!id || !rootClass || ccUtils.base.isA(rootClass, ScgClassType.CCPart)) return null
    const kind = productKind(productClass, id === rootId)
    return kind ? { id, name: name ?? '', kind } : null
  }, [id, name, productClass, rootClass, rootId])
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
