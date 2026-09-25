import { BuerliCadFacade } from '@buerli.io/classcad'
import { DrawingID } from '@buerli.io/core'

/** Undo/redo bookkeeping of a drawing (`d.cad.states`). */
export type States = {
  current: number
  stack: string[]
  captionMap: Record<string, { stateName: string; caption: string; undoable?: boolean }>
}

export const getCaption = (state: string, states?: States): string => {
  if (states?.captionMap) {
    const key = Object.keys(states.captionMap).find(c => states.captionMap[c].stateName === state)
    return key ? states.captionMap[key].caption : 'undefined caption'
  }
  return 'undefined caption'
}

const isUndoable = (stateName: string, states?: States): boolean => {
  if (states?.captionMap) {
    const key = Object.keys(states.captionMap).find(c => states.captionMap[c].stateName === stateName)
    const state = key ? states.captionMap[key] : undefined
    return state ? (state.undoable ? state.undoable : false) : false
  }
  return false
}

/** States that can be undone: undoable and not newer than the current one. */
export const getFilteredUndoStack = (states: States): string[] => {
  return states.stack.filter(file => Number.parseInt(file) <= states.current && isUndoable(file, states))
}

export const undoNext = (drawingId: DrawingID, states: States, stack: string[]) => {
  const index = stack.indexOf(states.current.toString())
  if (index > -1) {
    const stateToLoad = stack.at(index - 1)
    stateToLoad && BuerliCadFacade.utils.undo(drawingId, stateToLoad)
  } else {
    BuerliCadFacade.utils.undo(drawingId)
  }
}

/** States that can be redone: undoable and newer than the current one. */
export const getFilteredRedoStack = (states: States): string[] => {
  return states.stack.filter(file => Number.parseInt(file) > states.current && isUndoable(file, states))
}

export const redoNext = (drawingId: DrawingID, stack: string[]) => {
  if (stack.length > 0) {
    drawingId && BuerliCadFacade.utils.redo(drawingId, stack[0])
  }
}
