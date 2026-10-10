import { DrawingID, getDrawing } from '@buerli.io/core'

/** Whether the drawing holds GD&T: a PMI set with at least one item, in any of its parts. */
export const hasPmi = (drawingId: DrawingID): boolean =>
  Object.values(getDrawing(drawingId)?.structure.tree ?? {}).some(
    (o: any) => o?.class === 'CC_PmiSet' && (o.children?.length ?? 0) > 0,
  )

/**
 * The STEP options of an export (`v1.common.save`): AP242 when the drawing holds GD&T, because semantic PMI exists
 * in AP242 only (AP214 files would silently lose it); otherwise the server's default (AP214), as before.
 */
export const stepExportOptions = (drawingId: DrawingID): { stp?: { version: number } } =>
  hasPmi(drawingId) ? { stp: { version: 3 } } : {}
