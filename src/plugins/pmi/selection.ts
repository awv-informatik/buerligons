import { DrawingID, getDrawing } from '@buerli.io/core'

/** A face picked for a PMI item: its element id (= graphic id) and its surface type. */
export type PmiPick = { id: number; surface: string }

/** The surface type of a face of the drawing (plane, cylinder, cone, sphere, ...), undefined for non-faces. */
export const faceSurface = (drawingId: DrawingID, graphicId: number): string | undefined => {
  const containers = getDrawing(drawingId)?.graphic.containers ?? {}
  for (const c of Object.values(containers) as any[]) {
    const mesh = c?.meshes?.find((m: any) => m.id === graphicId)
    if (mesh) return mesh.properties?.surface?.type ?? 'face'
  }
  return undefined
}

/**
 * The faces for a new PMI item: the faces of the current selection, plus the face that was clicked (the face of
 * a context menu), in selection order and without duplicates.
 */
export const pickedFaces = (drawingId: DrawingID, clicked?: number | null): PmiPick[] => {
  const drawing = getDrawing(drawingId)
  const ids: number[] = []
  ;(drawing?.interaction.selected ?? []).forEach(info => {
    if (typeof info.graphicId === 'number') ids.push(info.graphicId)
  })
  if (typeof clicked === 'number' && !ids.includes(clicked)) ids.push(clicked)
  const picks: PmiPick[] = []
  ids.forEach(id => {
    const surface = faceSurface(drawingId, id)
    if (surface && !picks.some(p => p.id === id)) picks.push({ id, surface })
  })
  return picks
}
