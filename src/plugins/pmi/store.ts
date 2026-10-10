import { DrawingID } from '@buerli.io/core'
import { create } from 'zustand'
import { PmiDocument, PmiPluginState } from './types'

// The PMI view state per drawing: the document and what is shown, hovered and selected. Shared by the canvas layer
// (always mounted in the app's canvas) and any panel (the plugin window, or a customer's own UI), which live in
// different React roots, so a store instead of context or plugin state.

export type PmiViewState = PmiPluginState & { doc?: PmiDocument; error?: string }

const initial: PmiViewState = { showAnnotations: true, hovered: null, selected: null }

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
