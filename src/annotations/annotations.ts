import { getApiFacade } from '@buerli.io/classcad'
import { DrawingID, getDrawing } from '@buerli.io/core'
import { useDrawing } from '@buerli.io/react'
import React, { useSyncExternalStore } from 'react'
import * as THREE from 'three'

// Model annotations (comment threads pinned to geometry). The data lives in
// the ClassCAD tree as CC_Annotation objects — children of the product they
// were attached to, with the click point as the local coordinate-system
// origin and an 'entries' array member of [author, comment, created] rows.
// Because it is ordinary model structure it persists with the file, works
// over every IO (cli/wasm/node) and syncs to all clients of a shared session
// through the regular structure broadcast; this module only wraps the
// v1.annotation API and parses the tree nodes for the UI.

export type AnnotationEntry = { author: string; comment: string; created: number }

export type Annotation = {
  id: number
  name: string
  parent: number | null
  /** Local position relative to the parent product (csys origin). */
  position: [number, number, number]
  entries: AnnotationEntry[]
}

/** A comment being placed (right-click → Add comment) that has no ClassCAD
 *  object yet — it becomes one when the first entry is submitted. */
export type AnnotationDraft = {
  targetId: number
  /** Local position relative to targetId. */
  position: [number, number, number]
}

// ---------------------------------------------------------------------------
// Commands — thin wrappers over the generic v1.annotation API.
// ---------------------------------------------------------------------------

export const createAnnotation = async (
  drawingId: DrawingID,
  targetId: number,
  position: [number, number, number],
  author: string,
  comment: string,
): Promise<number | null> => {
  const fr = await getApiFacade(drawingId).callSafeApiV('v1', 'annotation', 'create', {
    id: targetId,
    position,
    author,
    comment,
    created: Date.now(),
  })
  return typeof fr?.result === 'number' ? fr.result : null
}

export const addAnnotationEntry = async (
  drawingId: DrawingID,
  annotationId: number,
  author: string,
  comment: string,
): Promise<void> => {
  await getApiFacade(drawingId).callSafeApiV('v1', 'annotation', 'addEntry', {
    id: annotationId,
    author,
    comment,
    created: Date.now(),
  })
}

export const removeAnnotationEntry = async (drawingId: DrawingID, annotationId: number, index: number): Promise<void> => {
  await getApiFacade(drawingId).callSafeApiV('v1', 'annotation', 'removeEntry', { id: annotationId, index })
}

export const deleteAnnotation = async (drawingId: DrawingID, annotationId: number): Promise<void> => {
  await getApiFacade(drawingId).callSafeApiV('v1', 'annotation', 'remove', { id: annotationId })
}

// ---------------------------------------------------------------------------
// Reading — CC_Annotation nodes from the structure tree.
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
const parseAnnotations = (tree: Record<string, any>): Annotation[] => {
  const out: Annotation[] = []
  for (const key of Object.keys(tree)) {
    const node = tree[key]
    if (!node || node.class !== 'CC_Annotation') continue
    const rows: any[] = node.members?.entries?.members ?? []
    const entries: AnnotationEntry[] = rows.map(row => {
      const vals: any[] = row?.members ?? []
      return {
        author: String(vals[0]?.value ?? ''),
        comment: String(vals[1]?.value ?? ''),
        created: Number(vals[2]?.value ?? 0),
      }
    })
    const origin: number[] = node.coordinateSystem?.[0] ?? [0, 0, 0]
    out.push({
      id: Number(node.id),
      name: String(node.name ?? ''),
      parent: node.parent ?? null,
      position: [origin[0] ?? 0, origin[1] ?? 0, origin[2] ?? 0],
      entries,
    })
  }
  return out
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const useAnnotations = (drawingId: DrawingID): Annotation[] => {
  const tree = useDrawing(drawingId, d => d.structure.tree)
  return React.useMemo(() => parseAnnotations(tree ?? {}), [tree])
}

/** World transformation of an annotation (or any tree object): walks the
 *  parent chain, so assembly instance transforms are included. */
export const annotationWorldMatrix = (drawingId: DrawingID, objectId: number): THREE.Matrix4 =>
  getDrawing(drawingId).api.structure.calculateGlobalTransformation(objectId)

// ---------------------------------------------------------------------------
// Draft store — set from the context menu, rendered by <Annotations>.
// ---------------------------------------------------------------------------

let draft: AnnotationDraft | null = null
const listeners = new Set<() => void>()

const notify = () => listeners.forEach(l => l())
const subscribe = (cb: () => void): (() => void) => {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

const getDraft = (): AnnotationDraft | null => draft

export const useAnnotationDraft = (): AnnotationDraft | null => useSyncExternalStore(subscribe, getDraft, getDraft)

export const clearAnnotationDraft = (): void => {
  if (!draft) return
  draft = null
  notify()
}

/** Entry point used by the canvas context menu: converts the world-space
 *  click point into coordinates local to the picked product and stages a
 *  draft marker there. */
export const startAnnotationDraft = (drawingId: DrawingID, targetId: number, worldPoint: THREE.Vector3): void => {
  const matrix = annotationWorldMatrix(drawingId, targetId)
  const local = worldPoint.clone().applyMatrix4(matrix.clone().invert())
  draft = { targetId, position: [local.x, local.y, local.z] }
  notify()
}

// ---------------------------------------------------------------------------
// Author colors — stable identity color per author NAME (not per connection:
// annotations persist with the model, peer ids do not). A curated palette
// keeps every color dark enough for white chip text and readable as name
// text on the white panel (no yellows at hostile lightness).
// ---------------------------------------------------------------------------

const AUTHOR_PALETTE = [
  'hsl(354, 66%, 46%)', // red
  'hsl(21, 78%, 42%)', // orange
  'hsl(36, 85%, 34%)', // amber
  'hsl(88, 55%, 33%)', // olive
  'hsl(145, 55%, 32%)', // green
  'hsl(172, 65%, 30%)', // teal
  'hsl(196, 75%, 36%)', // cyan
  'hsl(214, 70%, 45%)', // blue
  'hsl(248, 55%, 50%)', // indigo
  'hsl(281, 50%, 44%)', // purple
  'hsl(316, 60%, 42%)', // magenta
  'hsl(340, 65%, 47%)', // pink
]

const NEUTRAL_AUTHOR_COLOR = 'hsl(0, 0%, 45%)'

/** Deterministic palette color for an author name; same name = same color on
 *  every client and across sessions. Unnamed authors get a neutral gray. */
export const authorColor = (author: string): string => {
  const key = (author || '').trim().toLowerCase()
  if (!key) return NEUTRAL_AUTHOR_COLOR
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return AUTHOR_PALETTE[h % AUTHOR_PALETTE.length]
}

// ---------------------------------------------------------------------------
// Author identity — last used name wins, session identity as first default.
// ---------------------------------------------------------------------------

const AUTHOR_KEY = 'buerligons-comment-author'

export const getStoredAuthor = (): string => {
  try {
    return window.localStorage.getItem(AUTHOR_KEY) ?? ''
  } catch {
    return ''
  }
}

export const rememberAuthor = (name: string): void => {
  try {
    window.localStorage.setItem(AUTHOR_KEY, name)
  } catch {
    // storage unavailable (private mode etc.) — prefill just won't stick
  }
}
