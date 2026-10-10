import { DrawingID, getDrawing } from '@buerli.io/core'
import { create } from 'zustand'
import { pickedFaces } from './selection'
import { PMI_PLUGIN_NAME, PmiCreateMode, PmiDocument, PmiPluginState } from './types'

// The PMI view state per drawing: the document and what is shown, hovered and selected. Shared by the canvas layer
// (always mounted in the app's canvas) and any panel (the plugin window, or a customer's own UI), which live in
// different React roots, so a store instead of context or plugin state.

export type PmiViewState = PmiPluginState & {
  doc?: PmiDocument
  error?: string
  /** bumped after every PMI command of this client, so the document is loaded again */
  revision: number
}

const initial: PmiViewState = { showAnnotations: true, inPlanes: true, hovered: null, selected: null, revision: 0 }

type Store = {
  states: Record<string, PmiViewState>
  set: (drawingId: DrawingID, patch: Partial<PmiViewState>) => void
}

export const usePmiStore = create<Store>(set => ({
  states: {},
  set: (drawingId, patch) =>
    set(s => ({ states: { ...s.states, [String(drawingId)]: { ...initial, ...s.states[String(drawingId)], ...patch } } })),
}))

export const usePmiState = (drawingId: DrawingID): PmiViewState =>
  usePmiStore(s => s.states[String(drawingId)] ?? initial)

export const setPmiState = (drawingId: DrawingID, patch: Partial<PmiViewState>) =>
  usePmiStore.getState().set(drawingId, patch)

/** Opens the window of the GD&T plugin (if the app registered it). */
export const openPmiWindow = (drawingId: DrawingID) => {
  const drawing = getDrawing(drawingId)
  const pluginId = drawing?.plugin.global.find(id => drawing.plugin.refs[id]?.name === PMI_PLUGIN_NAME)
  if (pluginId !== undefined && !drawing.plugin.active.global.includes(pluginId)) {
    drawing.api.plugin.setActiveGlobal(pluginId, true)
  }
}

/** Opens the tolerance form for a design dimension (sketch dimension constraint or extrusion). */
export const promoteDesignDimension = (drawingId: DrawingID, dimensionId: number) => {
  setPmiState(drawingId, { promoteTarget: dimensionId })
  openPmiWindow(drawingId)
}

/** Opens the creation form of a datum, dimension or tolerance on the selected faces (and the clicked one). */
export const startPmiCreate = (drawingId: DrawingID, mode: PmiCreateMode, clickedFace?: number | null) => {
  setPmiState(drawingId, { create: { mode, elements: pickedFaces(drawingId, clickedFace) }, promoteTarget: null })
  openPmiWindow(drawingId)
}

/** Runs a PMI API command (api.v1.pmi.<func>) and loads the document again afterwards. */
export const pmiCommand = async (drawingId: DrawingID, func: string, args: any) => {
  const { getApiFacade } = await import('@buerli.io/classcad')
  try {
    return await getApiFacade(drawingId).callSafeApiV('v1', 'pmi', func, args)
  } finally {
    const s = usePmiStore.getState().states[String(drawingId)]
    setPmiState(drawingId, { revision: (s?.revision ?? 0) + 1 })
  }
}
