import { BuerliCadFacade, ccUtils, createApi, getApiFacade, ScgClassType } from '@buerli.io/classcad'
import { api as buerliApi, DrawingID, getDrawing, ObjectID } from '@buerli.io/core'

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

/**
 * A product of the drawing that was changed since it was opened (or since the host cleared it): a part, or a
 * sub-assembly (an assembly template, never the root assembly).
 */
export type EditedPart = { id: ObjectID; name: string; kind: 'part' | 'assembly' }

/** An assembly of the drawing that uses a product: the root assembly or an assembly template. */
export type ProductUser = { id: ObjectID; name: string; root: boolean }

/** A product a host inserts into the assembly: where ClassCAD loads it from, and how the host recognises it. */
export type InsertSource = {
  /** Location the ClassCAD process reaches. */
  url: string
  /** `JSON`: an assembly definition, added as a sub-assembly (`importDefinition` with `asTemplate`). */
  format: 'OFB' | 'STP' | 'SCG' | 'JSON'
  /** Name of the product (template) in the drawing. */
  name: string
  /** The host's bookkeeping on the product (see `setUserData`). */
  userData?: Record<string, string>
}

type EditedListener = (parts: EditedPart[]) => void

/**
 * Commands that move around in the model without changing it. Their captions are registered like every undoable
 * command, but they do not make the part they were issued in an edited one.
 */
const NAVIGATION: ReadonlySet<string> = new Set([
  'v1.assembly.setCurrentInstance',
  'v1.assembly.setCurrentProduct',
  'v1.part.openFeature',
  'v1.part.closeFeature',
  'v1.part.operationMoveBefore',
  'v1.part.operationMoveToEnd',
])

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
  private edited: EditedPart[] = []
  private editedListeners = new Set<EditedListener>()
  private unwatch: (() => void) | null = null

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
    let created: DrawingID | undefined
    try {
      const drawingId = await BuerliCadFacade.utils.connect(source?.name ?? name)
      if (!drawingId) throw new Error('Drawing could not be created.')
      created = drawingId
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
      this.watchEdits(drawingId)
      return drawingId
    } catch (error) {
      // A drawing that could not be filled is of no use: it goes again, and its ClassCAD session with it.
      if (created) {
        try {
          buerliApi.getState().api.removeDrawing(created)
        } catch (removal) {
          console.warn('[buerligons/embed] removing the failed drawing failed', removal)
        }
      }
      // ClassCAD rejects with its response, not with an Error: the host gets the text of its messages.
      const failure = error instanceof Error ? error : new Error(messageOf(error))
      this.set({ state: 'failed', drawingId: null, savedState: null, error: failure.message })
      throw failure
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

  /**
   * The parts that were changed since the drawing was opened: a part is edited when a command that changes the model
   * was issued while it was the current product. In an assembly these are the part templates the user went into and
   * worked on; the host saves exactly those (`exportPart`) and clears them.
   */
  getEditedParts(): EditedPart[] {
    return this.edited
  }

  subscribeEditedParts(listener: EditedListener): () => void {
    this.editedListeners.add(listener)
    return () => this.editedListeners.delete(listener)
  }

  /** Forgets edited parts, all of them or the given ones (after the host has saved them). */
  clearEditedParts(ids?: ObjectID[]): void {
    this.setEdited(ids ? this.edited.filter(p => !ids.includes(p.id)) : [])
  }

  /** One part of the drawing as bytes (`v1/assembly/exportNode`): the part alone, as it would be saved on its own. */
  async exportPart(id: ObjectID, format: 'OFB' | 'STP' = 'OFB'): Promise<Uint8Array> {
    const drawingId = this.status.drawingId
    if (!drawingId) throw new Error('No drawing is open.')
    const res = await createApi(drawingId).v1.assembly.exportNode({ id, format, encoding: 'base64' })
    const content = res?.result?.content as string | undefined
    if (!content) throw new Error(errorsOf(res?.messages) || 'ClassCAD returned no content for the part.')
    return decodeBase64(content)
  }

  /**
   * The assemblies that use a product directly: those with an instance of it among their own children. A template
   * that sits in two sub-assemblies has both as users; the root assembly is marked.
   */
  usersOf(productId: ObjectID): ProductUser[] {
    const structure = this.status.drawingId ? getDrawing(this.status.drawingId)?.structure : undefined
    if (!structure) return []
    const { tree, root } = structure
    return Object.values(tree)
      .filter(object => object.id === root || ccUtils.base.isA(object.class, ScgClassType.CCAssembly))
      .filter(assembly =>
        (assembly.children ?? []).some(child => {
          const instance = tree[child]
          return (
            instance &&
            ccUtils.base.isA(instance.class, ScgClassType.IProductReference) &&
            instance.members?.productId?.value === productId
          )
        }),
      )
      .map(assembly => ({ id: assembly.id, name: assembly.name, root: assembly.id === root }))
  }

  /** The products (templates) of the drawing: parts and sub-assemblies, without the root. */
  products(): EditedPart[] {
    const structure = this.status.drawingId ? getDrawing(this.status.drawingId)?.structure : undefined
    if (!structure) return []
    return Object.values(structure.tree).flatMap(object => {
      const kind = productKind(object.class, object.id === structure.root)
      return kind ? [{ id: object.id, name: object.name, kind }] : []
    })
  }

  /**
   * The assembly an inserted product goes into: the current product when it is an assembly (the root or a
   * sub-assembly the user has gone into), else the root. `null` while the user works inside a part.
   */
  insertTarget(): ProductUser | null {
    const structure = this.status.drawingId ? getDrawing(this.status.drawingId)?.structure : undefined
    const root = structure?.root ? structure.tree[structure.root] : undefined
    if (!structure || !root) return null
    const current = structure.currentProduct ? structure.tree[structure.currentProduct] : undefined
    if (!current || current.id === root.id) return { id: root.id, name: root.name, root: true }
    if (ccUtils.base.isA(current.class, ScgClassType.CCAssembly)) return { id: current.id, name: current.name, root: false }
    return null
  }

  /**
   * Loads a product from a location the ClassCAD process reaches (a part with `v1/assembly/loadProduct`, an assembly
   * definition with `v1/assembly/importDefinition` as a template), names it, puts the host's user data on it and adds one instance of it to the insert target. The name is made unique among the
   * products, since a host recognises a template by it. The assembly that received the instance counts as edited,
   * the loaded product does not.
   */
  async insertProduct(source: InsertSource): Promise<EditedPart> {
    const drawingId = this.status.drawingId
    const owner = this.insertTarget()
    if (!drawingId || !owner) throw new Error('A product is inserted into an assembly; leave the part first.')
    const facade = getApiFacade(drawingId)
    const taken = new Set(this.products().map(p => p.name))
    let name = source.name
    for (let n = 2; taken.has(name); n++) name = `${source.name}_${n}`
    const isAssembly = source.format === 'JSON'
    const loaded = isAssembly
      ? await facade.callSafeApiV(
          'v1',
          'assembly',
          'importDefinition',
          { url: source.url, format: 'JSON', asTemplate: true, name },
          { undoable: true },
        )
      : await facade.callSafeApiV('v1', 'assembly', 'loadProduct', { url: source.url, format: source.format }, { undoable: true })
    const result = loaded?.result as ObjectID | { id?: ObjectID } | undefined
    const id = typeof result === 'object' ? result?.id : result
    if (!id) throw new Error(errorsOf(loaded?.messages) || `ClassCAD could not load ${source.name}.`)
    if (!isAssembly) await facade.callSafeApiV('v1', 'common', 'setObjectName', { id, name }, { undoable: true })
    if (source.userData) await this.setUserData(id, source.userData)
    await this.addInstance(id, owner)
    return { id, name, kind: isAssembly ? 'assembly' : 'part' }
  }

  /** Adds an instance of a product of the drawing to the insert target (or to `owner`); returns the instance. */
  async addInstance(productId: ObjectID, owner = this.insertTarget()): Promise<ObjectID> {
    const drawingId = this.status.drawingId
    if (!drawingId || !owner) throw new Error('An instance is added to an assembly; leave the part first.')
    const res = await getApiFacade(drawingId).callSafeApiV(
      'v1',
      'assembly',
      'instance',
      { productId, ownerId: owner.id },
      { undoable: true },
    )
    const instance = (Array.isArray(res?.result) ? res.result[0] : res?.result) as ObjectID | undefined
    if (!instance) throw new Error(errorsOf(res?.messages) || 'ClassCAD could not create the instance.')
    // Whatever product was current while the commands ran: the change belongs to the assembly that got the instance.
    const others = this.edited.filter(p => p.id !== productId && p.id !== owner.id)
    this.setEdited(owner.root ? others : [...others, { id: owner.id, name: owner.name, kind: 'assembly' }])
    return instance
  }

  /**
   * True when the part starts from imported geometry (`CC_Import`). Such a part has no feature tree that ClassCAD
   * could rebuild its geometry from, so a host that loaded it without its BRep (as SCG) must not save it.
   */
  isImportedPart(id: ObjectID): boolean {
    const tree = this.status.drawingId ? getDrawing(this.status.drawingId)?.structure.tree : undefined
    if (!tree) return false
    const pending = [id]
    // The list grows while it is walked; the loop reaches what is appended.
    for (const next of pending) {
      const object = tree[next]
      if (!object) continue
      if (ccUtils.base.isA(object.class, ScgClassType.CCImport)) return true
      pending.push(...(object.children ?? []))
    }
    return false
  }

  /** User data of an object of the drawing (`v1/common/getUserData`); keys without a value are left out. */
  async getUserData(id: ObjectID, keys: string[]): Promise<Record<string, string>> {
    const drawingId = this.status.drawingId
    if (!drawingId) throw new Error('No drawing is open.')
    const data: Record<string, string> = {}
    for (const key of keys) {
      const res = await getApiFacade(drawingId).callSafeApiV('v1', 'common', 'getUserData', { id, key }, { undoable: false })
      if (typeof res?.result === 'string' && res.result) data[key] = res.result
    }
    return data
  }

  /**
   * Sets user data on an object of the drawing (`v1/common/setUserData`). It is the host's bookkeeping, not a change
   * of the model: it is not undoable and does not make the drawing or a part edited.
   *
   * ClassCAD keeps the value of a key that exists already, so the key is removed before it is set.
   */
  async setUserData(id: ObjectID, data: Record<string, string>): Promise<void> {
    const drawingId = this.status.drawingId
    if (!drawingId) throw new Error('No drawing is open.')
    const facade = getApiFacade(drawingId)
    for (const [key, value] of Object.entries(data)) {
      await facade.callSafeApiV('v1', 'common', 'removeUserData', { id, key }, { undoable: false })
      await facade.callSafeApiV('v1', 'common', 'setUserData', { id, key, value }, { undoable: false })
    }
  }

  /** Follows the commands of the drawing and collects the parts they change. */
  private watchEdits(drawingId: DrawingID) {
    this.unwatch?.()
    this.setEdited([])
    let known = new Set(Object.keys(getDrawing(drawingId)?.cad?.states?.captionMap ?? {}))
    this.unwatch = buerliApi.subscribe(state => {
      const drawing = state.drawing.refs[drawingId]
      const captions = drawing?.cad?.states?.captionMap
      if (!captions) return
      const keys = Object.keys(captions)
      const added = keys.filter(key => !known.has(key))
      if (!added.length) return
      known = new Set(keys)
      // The caption of a command is registered when it is issued, so the current product is still the one it acts on.
      if (added.every(key => NAVIGATION.has(captions[key]?.caption))) return
      const product = drawing.structure.tree[drawing.structure.currentProduct ?? -1]
      const kind = product && productKind(product.class, product.id === drawing.structure.root)
      if (!product || !kind) return
      if (this.edited.some(p => p.id === product.id)) return
      this.setEdited([...this.edited, { id: product.id, name: product.name, kind }])
    })
  }

  private setEdited(parts: EditedPart[]) {
    this.edited = parts
    this.editedListeners.forEach(l => l(parts))
  }

  /** Removes the drawing from the buerli store (and thereby ends its ClassCAD session). */
  async close(): Promise<void> {
    this.unwatch?.()
    this.unwatch = null
    this.setEdited([])
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
 * What a current product is for the host: a part, a sub-assembly (an assembly template), or nothing it tracks (the
 * root assembly, or no product).
 */
export const productKind = (productClass: string | undefined, isRoot: boolean): EditedPart['kind'] | null => {
  if (!productClass) return null
  if (ccUtils.base.isA(productClass, ScgClassType.CCPart)) return 'part'
  if (!isRoot && ccUtils.base.isA(productClass, ScgClassType.CCAssembly)) return 'assembly'
  return null
}

/**
 * A number that changes whenever the drawing changes. A runtime that reports its undo stack (WASM, Socket.IO) is at
 * the state `current`, so undoing back to the saved state is clean again. The Drogon WebSocket client does not report
 * the stack; there every undoable command still registers its caption, and the count of those that change the model
 * (negative, so it never meets a state id) marks the state. Going into a part or opening a feature is no change.
 */
export const stateMarkerOf = (
  states: { current?: number; stack?: unknown[]; captionMap?: Record<string, { caption?: string }> } | undefined,
): number | null => {
  if (!states) return null
  if (states.stack?.length) return typeof states.current === 'number' ? states.current : null
  return -Object.values(states.captionMap ?? {}).filter(entry => !NAVIGATION.has(entry?.caption ?? '')).length
}

const messageOf = (error: unknown): string => {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const { messages, message } = error as { messages?: { message?: string }[]; message?: unknown }
    const text = errorsOf(messages) || (typeof message === 'string' ? message : '')
    if (text) return text
  }
  return String(error)
}

/**
 * The texts of the messages of a ClassCAD response, joined; empty without messages. The first ones name the cause,
 * the rest follow from it, so two are enough.
 */
const errorsOf = (messages?: { message?: string }[]): string =>
  [...new Set((messages ?? []).map(m => m.message).filter((text): text is string => Boolean(text)))].slice(0, 2).join(' | ')
