import { DrawingID } from '@buerli.io/core'

// Where a drawing's engine runs: in this page, as WebAssembly, or on a server. The two cannot do
// all of the same yet, and the app asks before it offers what one of them lacks.
const inPage = new Set<DrawingID>()

/** Notes where a drawing's engine runs (initBuerli says so when it makes the drawing's client). */
export const setRunsInPage = (drawingId: DrawingID, yes: boolean) => {
  if (yes) inPage.add(drawingId)
  else inPage.delete(drawingId)
}

/** Whether a drawing's engine runs in the page, as WebAssembly. */
export const runsInPage = (drawingId?: DrawingID) => drawingId !== undefined && inPage.has(drawingId)
