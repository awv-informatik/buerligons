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
// annotations persist with the model, peer ids do not).
// ---------------------------------------------------------------------------

// Predefined pastel palette: each identity is a self-contained color PAIR -
// a light pastel surface plus a dark same-hue text tone - so contrast is
// built in and the colored chips/threads look identical under the app's
// light and dark themes. The pick is random-looking but deterministic
// (author-name hash), so every client and every session shows the same
// color for the same author; a per-client random pick would diverge.
const AUTHOR_HUES = [354, 21, 45, 88, 145, 172, 196, 214, 248, 281, 316, 340]

export type AuthorColors = {
  /** Light pastel surface (chip and thread background). */
  bg: string
  /** Medium tone for borders, strips and accents. */
  accent: string
  /** Dark same-hue tone - always readable on bg. */
  text: string
}

export const authorColors = (author: string): AuthorColors => {
  const key = (author || '').trim().toLowerCase()
  if (!key) return { bg: 'hsl(0, 0%, 88%)', accent: 'hsl(0, 0%, 60%)', text: 'hsl(0, 0%, 25%)' }
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  const hue = AUTHOR_HUES[h % AUTHOR_HUES.length]
  return {
    bg: `hsl(${hue}, 70%, 86%)`,
    accent: `hsl(${hue}, 50%, 60%)`,
    text: `hsl(${hue}, 65%, 24%)`,
  }
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
