import * as THREE from 'three'

/** What lies under a point of the screen (in normalized device coordinates), if anything does. */
export type StagePick = (ndc: THREE.Vector2) => THREE.Vector3 | null

type Gesture = 'none' | 'pending' | 'turn' | 'move' | 'roll' | 'touch'

// A press becomes a drag once the pointer has left it by this much (CSS px): a click stays a click.
const SLOP = 3
// The view turns by this much for a pixel the pointer travels.
const TURN = (0.3 * Math.PI) / 180
// A wheel's step, per pixel it reports; a pinch on a trackpad comes as a wheel with Ctrl held, in finer steps.
const WHEEL = 0.0012
const PINCH = 0.01
// A wheel that reports lines or pages instead of pixels.
const LINE = 40
const PAGE = 800

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const isOrtho = (camera: THREE.Camera): camera is THREE.OrthographicCamera =>
  (camera as THREE.OrthographicCamera).isOrthographicCamera === true

/**
 * The stage's camera control: the view is turned freely, as CAD systems turn it.
 *
 * - drag: the view turns with the pointer, about the line in the screen that lies across the way
 *   the pointer goes: sideways about the screen's upright, up and down about its horizontal, at
 *   the same rate wherever on the stage the drag is. It goes all the way round, over the top and
 *   under the bottom. It turns about what was under the pointer when the drag began, so that
 *   stays where it is; a drag that begins beside the model turns about the model's middle.
 * - drag with the right or the middle button, or with Ctrl / Cmd held: the view moves with the pointer
 * - drag with Alt held: the view rolls about the line of sight
 * - wheel, pinch: zooms at the pointer
 * - touch: one finger turns, two move and zoom
 *
 * `target` is the point at the middle of the screen the camera looks at. Events: `start`, `change`, `end`.
 */
export class StageControls extends THREE.EventDispatcher<any> {
  object: THREE.Camera
  domElement: HTMLElement | null = null

  enabled = true
  target = new THREE.Vector3()

  rotateSpeed = 1
  zoomSpeed = 1
  noRotate = false
  noZoom = false
  noPan = false
  minZoom = 1e-4
  maxZoom = 1e6

  /** What a drag turns about: what lies under the pointer where it begins. */
  pick: StagePick | null = null
  /** What a drag that begins over nothing turns about: the model's middle. Without it, the target. */
  center: (() => THREE.Vector3 | null) | null = null

  private gesture: Gesture = 'none'
  private wanted: Gesture = 'none'
  private pointers = new Map<number, { x: number; y: number }>()
  private last = { x: 0, y: 0 }
  private spread = 0
  private pivot = new THREE.Vector3()
  // the press that is on, or was last: whether it became a drag, and the menu that came with it
  private dragged = false
  private menu: MouseEvent | null = null
  private replayed: MouseEvent | null = null

  constructor(object: THREE.Camera, domElement?: HTMLElement) {
    super()
    this.object = object
    if (domElement) this.connect(domElement)
  }

  connect(domElement: HTMLElement) {
    this.dispose()
    this.domElement = domElement
    domElement.style.touchAction = 'none'
    domElement.addEventListener('pointerdown', this.onPointerDown)
    domElement.addEventListener('pointermove', this.onPointerMove)
    domElement.addEventListener('pointerup', this.onPointerUp)
    domElement.addEventListener('pointercancel', this.onPointerUp)
    domElement.addEventListener('mousedown', this.onMouseDown)
    domElement.addEventListener('contextmenu', this.onContextMenu)
    domElement.addEventListener('wheel', this.onWheel, { passive: false })
    this.update()
  }

  dispose() {
    const el = this.domElement
    if (!el) return
    el.style.touchAction = ''
    el.removeEventListener('pointerdown', this.onPointerDown)
    el.removeEventListener('pointermove', this.onPointerMove)
    el.removeEventListener('pointerup', this.onPointerUp)
    el.removeEventListener('pointercancel', this.onPointerUp)
    el.removeEventListener('mousedown', this.onMouseDown)
    el.removeEventListener('contextmenu', this.onContextMenu)
    el.removeEventListener('wheel', this.onWheel)
    this.pointers.clear()
    this.gesture = 'none'
    this.domElement = null
  }

  /**
   * Keeps the target on the line of sight. The control itself never leaves it; this is for what
   * else moves the camera (a fit, a view that is flown to), and it never turns the camera.
   */
  update() {
    const camera = this.object
    const forward = _forward.set(0, 0, -1).applyQuaternion(camera.quaternion)
    const depth = _v.subVectors(this.target, camera.position).dot(forward)
    if (Number.isFinite(depth)) this.target.copy(camera.position).addScaledVector(forward, depth)
  }

  // ---- the view

  /** Turns the camera, and the target with it, about a point. */
  private turnAbout(pivot: THREE.Vector3, turn: THREE.Quaternion) {
    const camera = this.object
    camera.position.sub(pivot).applyQuaternion(turn).add(pivot)
    this.target.sub(pivot).applyQuaternion(turn).add(pivot)
    camera.quaternion.premultiply(turn).normalize()
    // (what flies the camera to a view reads its up from here)
    camera.up.set(0, 1, 0).applyQuaternion(camera.quaternion)
  }

  private turn(dx: number, dy: number) {
    const travel = Math.hypot(dx, dy)
    if (!travel) return
    const camera = this.object
    const right = _right.set(1, 0, 0).applyQuaternion(camera.quaternion)
    const top = _top.set(0, 1, 0).applyQuaternion(camera.quaternion)
    // the line in the screen that lies across the way the pointer went
    const axis = _v.set(0, 0, 0).addScaledVector(top, dx).addScaledVector(right, dy).normalize()
    this.turnAbout(this.pivot, _turn.setFromAxisAngle(axis, -travel * TURN * this.rotateSpeed))
  }

  /** Rolls about the line of sight, as far as the pointer went round the middle of the stage. */
  private roll(x: number, y: number) {
    const box = this.domElement!.getBoundingClientRect()
    const cx = box.left + box.width / 2
    const cy = box.top + box.height / 2
    const before = Math.atan2(cy - this.last.y, this.last.x - cx)
    const after = Math.atan2(cy - y, x - cx)
    const back = _back.set(0, 0, 1).applyQuaternion(this.object.quaternion)
    this.turnAbout(this.target, _turn.setFromAxisAngle(back, before - after))
  }

  /** What a pixel of the stage measures in the model, at the target's depth. */
  private pixel(box: DOMRect) {
    const camera = this.object
    if (isOrtho(camera)) {
      return {
        x: (camera.right - camera.left) / camera.zoom / box.width,
        y: (camera.top - camera.bottom) / camera.zoom / box.height,
      }
    }
    const persp = camera as THREE.PerspectiveCamera
    const depth = _v.subVectors(this.target, camera.position).length()
    const y = (2 * depth * Math.tan((persp.fov * Math.PI) / 360)) / persp.zoom / box.height
    return { x: y, y }
  }

  private shift(x: number, y: number) {
    const camera = this.object
    const right = _right.set(1, 0, 0).applyQuaternion(camera.quaternion)
    const top = _top.set(0, 1, 0).applyQuaternion(camera.quaternion)
    _v.set(0, 0, 0).addScaledVector(right, x).addScaledVector(top, y)
    camera.position.add(_v)
    this.target.add(_v)
  }

  /** Moves the view by pixels: what is under the pointer stays under it. */
  private move(dx: number, dy: number) {
    const px = this.pixel(this.domElement!.getBoundingClientRect())
    this.shift(-dx * px.x, dy * px.y)
  }

  /** Zooms by a factor at a point of the screen: what is there stays there. */
  private zoomAt(x: number, y: number, factor: number) {
    const camera = this.object
    const box = this.domElement!.getBoundingClientRect()
    const px = this.pixel(box)
    // where the pointer is, from the middle of the stage, in the model's measure
    const ox = (x - box.left - box.width / 2) * px.x
    const oy = (box.top + box.height / 2 - y) * px.y
    if (isOrtho(camera)) {
      const zoom = clamp(camera.zoom * factor, this.minZoom, this.maxZoom)
      const kept = 1 - camera.zoom / zoom
      camera.zoom = zoom
      camera.updateProjectionMatrix()
      this.shift(ox * kept, oy * kept)
    } else {
      // (a camera with perspective goes towards the point instead)
      const kept = 1 - 1 / factor
      const forward = _forward.set(0, 0, -1).applyQuaternion(camera.quaternion)
      const depth = _v.subVectors(this.target, camera.position).dot(forward)
      this.shift(ox * kept, oy * kept)
      camera.position.addScaledVector(forward, depth * kept)
    }
  }

  // ---- the pointer

  private ndc(x: number, y: number) {
    const box = this.domElement!.getBoundingClientRect()
    return _ndc.set(((x - box.left) / box.width) * 2 - 1, -((y - box.top) / box.height) * 2 + 1)
  }

  private changed() {
    this.dispatchEvent({ type: 'change' })
  }

  private begin(gesture: Gesture, pointerId: number) {
    // (start first: a view that is still being flown to hands its target over on it)
    this.dispatchEvent({ type: 'start' })
    this.gesture = gesture
    this.dragged = true
    try {
      // the drag goes on over whatever lies beside the stage, and its release is seen
      this.domElement!.setPointerCapture(pointerId)
    } catch {
      // (a pointer that is gone already)
    }
    if (gesture === 'turn') {
      const hit = this.pick?.(this.ndc(this.last.x, this.last.y))
      this.pivot.copy(hit ?? this.center?.() ?? this.target)
      // the target takes the depth of what is turned about, and the camera keeps its distance to
      // it: nothing moves on screen, and the next view that is flown to starts from the model
      const forward = _forward.set(0, 0, -1).applyQuaternion(this.object.quaternion)
      if (hit && isOrtho(this.object)) {
        const deeper = _v.subVectors(hit, this.target).dot(forward)
        this.target.addScaledVector(forward, deeper)
        this.object.position.addScaledVector(forward, deeper)
      }
    }
  }

  private end() {
    if (this.gesture !== 'none' && this.gesture !== 'pending') this.dispatchEvent({ type: 'end' })
    this.gesture = 'none'
  }

  private onPointerDown = (e: PointerEvent) => {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (this.pointers.size === 2 && e.pointerType === 'touch') {
      if (!this.enabled) return
      // a second finger: the two move and zoom
      if (this.gesture === 'none' || this.gesture === 'pending') this.begin('touch', e.pointerId)
      else this.gesture = 'touch'
      const [a, b] = [...this.pointers.values()]
      this.last = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      this.spread = Math.hypot(a.x - b.x, a.y - b.y)
      return
    }
    if (this.pointers.size !== 1) return
    this.dragged = false
    this.menu = null
    const moves = e.button === 1 || e.button === 2 || e.ctrlKey || e.metaKey
    this.wanted = e.pointerType === 'touch' ? 'turn' : moves ? 'move' : e.altKey ? 'roll' : 'turn'
    // Not a drag yet. Whether it becomes one is decided when the pointer has moved: by then
    // whatever else takes a press (a sketch's point, a selection rectangle) has claimed it.
    this.gesture = 'pending'
    this.last = { x: e.clientX, y: e.clientY }
  }

  private onPointerMove = (e: PointerEvent) => {
    const pointer = this.pointers.get(e.pointerId)
    if (!pointer) return
    // (a press that ended off the stage, where its release was not seen)
    if (e.pointerType !== 'touch' && e.buttons === 0) return this.onPointerUp(e)
    pointer.x = e.clientX
    pointer.y = e.clientY
    if (this.gesture === 'none') return
    if (!this.enabled) return this.end()

    if (this.gesture === 'touch') {
      const [a, b] = [...this.pointers.values()]
      if (!b) return
      const x = (a.x + b.x) / 2
      const y = (a.y + b.y) / 2
      const spread = Math.hypot(a.x - b.x, a.y - b.y)
      if (!this.noPan) this.move(x - this.last.x, y - this.last.y)
      if (!this.noZoom && this.spread > 0 && spread > 0) this.zoomAt(x, y, spread / this.spread)
      this.last = { x, y }
      this.spread = spread
      return this.changed()
    }

    const dx = e.clientX - this.last.x
    const dy = e.clientY - this.last.y
    if (this.gesture === 'pending') {
      if (Math.hypot(dx, dy) < SLOP) return
      const off = this.wanted === 'move' ? this.noPan : this.noRotate
      if (off) return this.end()
      this.begin(this.wanted, e.pointerId)
    }
    if (this.gesture === 'turn') this.turn(dx, dy)
    else if (this.gesture === 'move') this.move(dx, dy)
    else if (this.gesture === 'roll') this.roll(e.clientX, e.clientY)
    this.last = { x: e.clientX, y: e.clientY }
    this.changed()
  }

  private onPointerUp = (e: PointerEvent) => {
    if (!this.pointers.delete(e.pointerId)) return
    if (this.pointers.size === 0) {
      const menu = this.menu
      this.menu = null
      this.end()
      // the menu that was held back at the press: a press that stayed a click gets it now
      if (menu && !this.dragged && e.type === 'pointerup') this.replay(menu, e)
      return
    }
    if (this.gesture === 'touch') {
      // one of two fingers left: the other turns the view on
      const [rest] = [...this.pointers.values()]
      this.last = { x: rest.x, y: rest.y }
      this.pivot.copy(this.center?.() ?? this.target)
      this.gesture = this.noRotate ? 'none' : 'turn'
    }
  }

  // The stage does not take the focus from a field that is being filled in, and a press on it is
  // nobody else's (the app is built on both).
  private onMouseDown = (e: MouseEvent) => {
    if (!this.enabled) return
    e.preventDefault()
    e.stopPropagation()
  }

  // Where the menu comes with the press of the button (as on a Mac) it would come up under every
  // drag with the right button. It waits for the release instead, and a drag gets none.
  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault()
    if (e === this.replayed) return
    if (this.pointers.size > 0) {
      e.stopPropagation()
      this.menu = e
    } else if (this.dragged) {
      e.stopPropagation()
    }
  }

  private replay(menu: MouseEvent, at: PointerEvent) {
    const { clientX, clientY, screenX, screenY } = at
    const { ctrlKey, shiftKey, altKey, metaKey, button } = menu
    const keys = { ctrlKey, shiftKey, altKey, metaKey, button }
    const place = { clientX, clientY, screenX, screenY }
    this.replayed = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window, ...place, ...keys })
    this.domElement?.dispatchEvent(this.replayed)
    this.replayed = null
  }

  private onWheel = (e: WheelEvent) => {
    if (!this.enabled || this.noZoom) return
    e.preventDefault()
    e.stopPropagation()
    const pixels = e.deltaY * (e.deltaMode === 1 ? LINE : e.deltaMode === 2 ? PAGE : 1)
    // (a pinch comes in small steps; a wheel turned with Ctrl held comes in large ones, and is held to a pinch's)
    const step = e.ctrlKey ? clamp(pixels, -30, 30) * PINCH : pixels * WHEEL
    const factor = Math.exp(-step * this.zoomSpeed)
    this.dispatchEvent({ type: 'start' })
    this.zoomAt(e.clientX, e.clientY, factor)
    this.changed()
    this.dispatchEvent({ type: 'end' })
  }
}

const _v = new THREE.Vector3()
const _forward = new THREE.Vector3()
const _right = new THREE.Vector3()
const _top = new THREE.Vector3()
const _back = new THREE.Vector3()
const _ndc = new THREE.Vector2()
const _turn = new THREE.Quaternion()
