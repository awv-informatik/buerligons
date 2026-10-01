import { BuerliCadFacade, createApi, getApiFacade } from '@buerli.io/classcad'
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

/**
 * An assembly as a definition (`v1.assembly.importDefinition`, JSON): structure, instances and constraints, with
 * templates that carry their part inline or point at locations the ClassCAD process loads itself.
 */
export type EditorDefinition = {
  name: string
  format: 'JSON'
  /** The definition as JSON text. */
  data: string
}

/** Options of `v1.assembly.exportDefinition`. */
export type ExportDefinitionOptions = {
  mode?: 'INLINE' | 'REFERENCED'
  partFormat?: 'OFB' | 'SCG'
  dir?: string
  baseUrl?: string
}

export type ExportedFile =
  | { name: string; type: 'ofb' | 'scg'; encoding: 'base64'; content: string }
  | { name: string; type: 'json'; content: unknown }

/** Result of `v1.assembly.exportDefinition`. */
export type ExportedDefinition = {
  /** The root assembly definition. */
  json: Record<string, unknown>
  rootFile?: string
  fileNames?: string[]
  /** REFERENCED without `dir`: the content of all files, the root definition last. */
  files?: ExportedFile[]
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
  async open(source?: EditorSource | EditorDefinition, name = 'Part'): Promise<DrawingID> {
    await this.close()
    this.set({ state: 'opening', drawingId: null, savedState: null })
    try {
      const drawingId = await BuerliCadFacade.utils.connect(source?.name ?? name)
      if (!drawingId) throw new Error('Drawing could not be created.')
      buerliApi.getState().api.setActiveDrawing(drawingId)
      if (source?.format === 'JSON') {
        // Called by name: importDefinition is newer than the typed client some hosts build against.
        const res = await getApiFacade(drawingId).callSafeApiV(
          'v1',
          'assembly',
          'importDefinition',
          { data: source.data, format: 'JSON' },
          { undoable: true },
        )
        if (res?.result === undefined || res.result === null) {
          throw new Error(errorsOf(res?.messages) || 'ClassCAD could not build the assembly from its definition.')
        }
      } else if (source) {
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

  /**
   * Writes the assembly of the drawing as a definition (`v1.assembly.exportDefinition`) and marks the current undo
   * state as saved. The host stores the definition; with `mode: 'REFERENCED'` the parts come as separate files.
   */
  async exportDefinition(options: ExportDefinitionOptions = {}): Promise<ExportedDefinition> {
    const drawingId = this.status.drawingId
    if (!drawingId) throw new Error('No drawing is open.')
    const before = this.status
    this.set({ ...before, state: 'saving', error: undefined })
    try {
      const res = await getApiFacade(drawingId).callSafeApiV('v1', 'assembly', 'exportDefinition', options, { undoable: false })
      const result = res?.result as ExportedDefinition | undefined
      if (!result?.json) throw new Error(errorsOf(res?.messages) || 'ClassCAD returned no assembly definition.')
      this.set({ state: 'ready', drawingId, savedState: this.currentState(drawingId) })
      return result
    } catch (error) {
      this.set({ ...before, state: 'ready', error: messageOf(error) })
      throw error
    }
  }

  /** Marker of the undo/redo state the drawing is at now (see `stateMarkerOf`); `null` when unknown. */
  currentState(drawingId = this.status.drawingId): number | null {
    if (!drawingId) return null
    return stateMarkerOf(getDrawing(drawingId)?.cad?.states)
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

/**
 * A number that changes whenever the drawing changes. A runtime that reports its undo stack (WASM, Socket.IO) is at
 * the state `current`, so undoing back to the saved state is clean again. The Drogon WebSocket client does not report
 * the stack; there every undoable command still registers its caption, and their count (negative, so it never meets
 * a state id) marks the state.
 */
export const stateMarkerOf = (
  states: { current?: number; stack?: unknown[]; captionMap?: Record<string, unknown> } | undefined,
): number | null => {
  if (!states) return null
  if (states.stack?.length) return typeof states.current === 'number' ? states.current : null
  return -Object.keys(states.captionMap ?? {}).length
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

/** The error texts of a ClassCAD response, joined; empty without errors. */
const errorsOf = (messages?: { message?: string; level?: number }[]): string =>
  (messages ?? [])
    .filter(m => (m.level ?? 0) >= 2 && m.message)
    .map(m => m.message)
    .join(' | ')
