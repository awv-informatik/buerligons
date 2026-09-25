import { BuerliCadFacade, createApi } from '@buerli.io/classcad'
import { api as buerliApi, DrawingID, getDrawing } from '@buerli.io/core'

/** Formats `v1/common/load` accepts. */
export type EditorLoadFormat = 'OFB' | 'STP' | 'IWP'
/** Formats `v1/common/save` produces. */
export type EditorSaveFormat = 'OFB' | 'STP' | 'STL'

export type EditorSource = {
  /** Drawing name, typically the file name of the source. */
  name: string
  format: EditorLoadFormat
  data: ArrayBuffer
}

export type EditorState = 'idle' | 'opening' | 'ready' | 'saving' | 'failed' | 'closed'

export type EditorStatus = {
  state: EditorState
  drawingId: DrawingID | null
  /** Undo/redo state id that was last loaded or saved; `null` before the first open. */
  savedState: number | null
  error?: string
}

type Listener = (status: EditorStatus) => void

/** Maps a file name to a load format; `null` when the type is not loadable. */
export const loadFormatOf = (fileName: string): EditorLoadFormat | null => {
  const ext = fileName.toLowerCase().split('.').pop() ?? ''
  if (ext === 'ofb') return 'OFB'
  if (ext === 'stp' || ext === 'step') return 'STP'
  if (ext === 'iwp') return 'IWP'
  return null
}

const decodeBase64 = (content: string): Uint8Array => {
  const binary = atob(content)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * Document lifecycle of an embedded Buerligons editor: open a source (or a new part) in a fresh
 * drawing, save it back as bytes, close the drawing. The host (e.g. a PDM) owns files, versions and
 * permissions; the controller only talks to the ClassCAD session of the active drawing.
 *
 * `initBuerli` must have been called once per page before `open`.
 */
export class EditorController {
  private status: EditorStatus = { state: 'idle', drawingId: null, savedState: null }
  private listeners = new Set<Listener>()

  getStatus(): EditorStatus {
    return this.status
  }

  get drawingId(): DrawingID | null {
    return this.status.drawingId
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Creates a drawing and loads `source` into it. Without a source an empty part named `name` is
   * created. A previously opened drawing of this controller is removed first.
   */
  async open(source?: EditorSource, name = 'Part'): Promise<DrawingID> {
    await this.close()
    this.set({ state: 'opening', drawingId: null, savedState: null })
    try {
      const drawingId = await BuerliCadFacade.utils.connect(source?.name ?? name)
      if (!drawingId) throw new Error('Drawing could not be created.')
      buerliApi.getState().api.setActiveDrawing(drawingId)
      if (source) {
        await createApi(drawingId).v1.common.load({ data: source.data, format: source.format })
      } else {
        await createApi(drawingId).v1.part.create({ name })
      }
      this.set({ state: 'ready', drawingId, savedState: this.currentState(drawingId) })
      return drawingId
    } catch (error) {
      this.set({ state: 'failed', drawingId: null, savedState: null, error: messageOf(error) })
      throw error
    }
  }

  /** Serialises the drawing (`v1/common/save`) and marks the current undo state as saved. */
  async save(format: EditorSaveFormat = 'OFB'): Promise<Uint8Array> {
    const drawingId = this.status.drawingId
    if (!drawingId) throw new Error('No drawing is open.')
    const before = this.status
    this.set({ ...before, state: 'saving', error: undefined })
    try {
      const res = await createApi(drawingId).v1.common.save({ format, encoding: 'base64' })
      const content = res?.result?.content as string | undefined
      if (!content) throw new Error('ClassCAD returned no content.')
      const bytes = decodeBase64(content)
      this.set({ state: 'ready', drawingId, savedState: this.currentState(drawingId) })
      return bytes
    } catch (error) {
      this.set({ ...before, state: 'ready', error: messageOf(error) })
      throw error
    }
  }

  /** Undo/redo state id the drawing is at now; `null` when unknown. */
  currentState(drawingId = this.status.drawingId): number | null {
    if (!drawingId) return null
    const current = getDrawing(drawingId)?.cad?.states?.current
    return typeof current === 'number' ? current : null
  }

  /** True when the drawing moved to another undo state since the last open or save. */
  isDirty(): boolean {
    const { drawingId, savedState } = this.status
    if (!drawingId || savedState === null) return false
    const current = this.currentState(drawingId)
    return current !== null && current !== savedState
  }

  /** Removes the drawing from the buerli store (and thereby ends its ClassCAD session). */
  async close(): Promise<void> {
    const drawingId = this.status.drawingId
    if (drawingId) {
      try {
        buerliApi.getState().api.removeDrawing(drawingId)
      } catch (error) {
        console.warn('[buerligons/embed] removing the drawing failed', error)
      }
    }
    this.set({ state: 'closed', drawingId: null, savedState: null })
  }

  private set(status: EditorStatus) {
    this.status = status
    this.listeners.forEach(l => l(status))
  }
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))
