/* eslint-disable @typescript-eslint/no-redeclare */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable max-lines */
/* eslint-disable no-shadow */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable no-var */
/* eslint-disable @typescript-eslint/no-use-before-define */

// Copied from https://github.com/mrdoob/three.js/blob/r108/examples/jsm/controls/OrthographicTrackballControls.js
// TODO: convert to typescript

// @ts-nocheck
// @ts-ignore

/**
 * @author Eberhard Graether / http://egraether.com/
 * @author Mark Lundin 	/ http://mark-lundin.com
 * @author Patrick Fuller / http://patrick-fuller.com
 * @author Max Smolens / https://github.com/msmolens
 */

import { Camera, EventDispatcher, Quaternion, Vector2, Vector3 } from 'three'

export class OrthographicTrackballControls extends EventDispatcher {
  public object: Camera
  public domElement: HTMLElement

  public enabled: boolean
  public screen: { left: number; top: number; width: number; height: number }
  public radius: number
  public rotateSpeed: number
  public zoomSpeed: number
  public noRotate: boolean
  public noZoom: boolean
  public noPan: boolean
  public noRoll: boolean
  public staticMoving: boolean
  public dynamicDampingFactor: number
  public keys: number[]

  public handleResize(): void
  public rotateCamera(): void
  public zoomCamera(): void
  public panCamera(): void
  public update(): void
  public reset(): void
  public dispose(): void
  public connect(domElement: HTMLElement): void

  constructor(object: Camera, domElement?: HTMLElement) {
    super()

    const _this = this
    const STATE = { NONE: -1, ROTATE: 0, ZOOM: 1, PAN: 2, TOUCH_ROTATE: 3, TOUCH_ZOOM_PAN: 4 }

    this.object = object
    this.domElement = domElement !== undefined ? domElement : document

    // API

    this.enabled = true

    this.screen = { left: 0, top: 0, width: 0, height: 0 }

    this.radius = 0

    this.rotateSpeed = 1.0
    this.zoomSpeed = 1.2

    this.noRotate = false
    this.noZoom = false
    this.noPan = false
    this.noRoll = false

    this.staticMoving = false
    this.dynamicDampingFactor = 0.2

    this.keys = [65 /*A*/, 83 /*S*/, 68 /*D*/]

    // internals

    this.target = new Vector3()
    this.mousePosition = new Vector2()

    const EPS = 0.000001

    let _changed = true

    let _state = STATE.NONE
    let _prevState = STATE.NONE
    const _eye = new Vector3()
    const _rotateStart = new Vector3()
    const _rotateEnd = new Vector3()
    const _zoomStart = new Vector2()
    const _zoomEnd = new Vector2()
    let _touchZoomDistanceStart = 0
    let _touchZoomDistanceEnd = 0
    const _panStart = new Vector2()
    const _panEnd = new Vector2()

    // for reset

    this.target0 = this.target.clone()
    this.position0 = this.object.position.clone()
    this.up0 = this.object.up.clone()

    this.left0 = this.object.left
    this.right0 = this.object.right
    this.top0 = this.object.top
    this.bottom0 = this.object.bottom

    // events

    const changeEvent = { type: 'change' }
    const startEvent = { type: 'start' }
    const endEvent = { type: 'end' }

    // methods

    this.handleResize = function () {
      if (this.domElement === document) {
        this.screen.left = 0
        this.screen.top = 0
        this.screen.width = window.innerWidth
        this.screen.height = window.innerHeight
      } else {
        const box = this.domElement.getBoundingClientRect()
        // adjustments come from similar code in the jquery offset() function
        const d = this.domElement.ownerDocument.documentElement
        this.screen.left = box.left + window.pageXOffset - d.clientLeft
        this.screen.top = box.top + window.pageYOffset - d.clientTop
        this.screen.width = box.width
        this.screen.height = box.height
      }

      this.radius = 0.5 * Math.min(this.screen.width, this.screen.height)

      this.left0 = this.object.left
      this.right0 = this.object.right
      this.top0 = this.object.top
      this.bottom0 = this.object.bottom
    }

    const getMouseOnScreen = (() => {
      const vector = new Vector2()

      return function getMouseOnScreen(pageX, pageY) {
        vector.set((pageX - _this.screen.left) / _this.screen.width, (pageY - _this.screen.top) / _this.screen.height)

        return vector
      }
    })()

    const getMouseProjectionOnBall = (() => {
      const vector = new Vector3()
      const objectUp = new Vector3()
      const mouseOnBall = new Vector3()

      return function getMouseProjectionOnBall(pageX, pageY) {
        mouseOnBall.set(
          (pageX - _this.screen.width * 0.5 - _this.screen.left) / _this.radius,
          (_this.screen.height * 0.5 + _this.screen.top - pageY) / _this.radius,
          0.0,
        )

        const length = mouseOnBall.length()

        if (_this.noRoll) {
          if (length < Math.SQRT1_2) {
            mouseOnBall.z = Math.sqrt(1.0 - length * length)
          } else {
            mouseOnBall.z = 0.5 / length
          }
        } else if (length > 1.0) {
          mouseOnBall.normalize()
        } else {
          mouseOnBall.z = Math.sqrt(1.0 - length * length)
        }

        _eye.copy(_this.object.position).sub(_this.target)

        vector.copy(_this.object.up).setLength(mouseOnBall.y)
        vector.add(objectUp.copy(_this.object.up).cross(_eye).setLength(mouseOnBall.x))
        vector.add(_eye.setLength(mouseOnBall.z))

        return vector
      }
    })()

    this.rotateCamera = (() => {
      const axis = new Vector3()
      const quaternion = new Quaternion()

      return function rotateCamera() {
        let angle = Math.acos(_rotateStart.dot(_rotateEnd) / _rotateStart.length() / _rotateEnd.length())

        if (angle) {
          axis.crossVectors(_rotateStart, _rotateEnd).normalize()

          angle *= _this.rotateSpeed

          quaternion.setFromAxisAngle(axis, -angle)

          _eye.applyQuaternion(quaternion)
          _this.object.up.applyQuaternion(quaternion)

          _rotateEnd.applyQuaternion(quaternion)

          if (_this.staticMoving) {
            _rotateStart.copy(_rotateEnd)
          } else {
            quaternion.setFromAxisAngle(axis, angle * (_this.dynamicDampingFactor - 1.0))
            _rotateStart.applyQuaternion(quaternion)
          }

          _changed = true
        }
      }
    })()

    this.zoomCamera = function () {
      if (_state === STATE.TOUCH_ZOOM_PAN) {
        var factor = _touchZoomDistanceEnd / _touchZoomDistanceStart
        _touchZoomDistanceStart = _touchZoomDistanceEnd

        _this.object.zoom *= factor

        _changed = true
      } else {
        var factor = 1.0 + (_zoomEnd.y - _zoomStart.y) * _this.zoomSpeed

        if (Math.abs(factor - 1.0) > EPS && factor > 0.0) {
          _this.object.zoom /= factor

          if (_this.staticMoving) {
            _zoomStart.copy(_zoomEnd)
          } else {
            _zoomStart.y += (_zoomEnd.y - _zoomStart.y) * this.dynamicDampingFactor
          }

          const point = _this.mousePosition.clone()

          //determine 3D position of mouse cursor (on target plane)
          const ndcTarget = _this.target.clone().project(_this.object)
          const ndcPos = new Vector3(point.x, point.y, ndcTarget.z)
          const worldPos = ndcPos.clone().unproject(_this.object)

          //adjust target point so that "point" stays in place
          _this.target.lerpVectors(worldPos, _this.target, factor)

          _changed = true
        }
      }
    }

    this.panCamera = (() => {
      const mouseChange = new Vector2()
      const objectUp = new Vector3()
      const pan = new Vector3()

      return function panCamera() {
        mouseChange.copy(_panEnd).sub(_panStart)

        if (mouseChange.lengthSq() > EPS) {
          // Scale movement to keep clicked/dragged position under cursor
          const scale_x = (_this.object.right - _this.object.left) / _this.object.zoom
          const scale_y = (_this.object.top - _this.object.bottom) / _this.object.zoom
          mouseChange.x *= scale_x
          mouseChange.y *= scale_y

          pan.copy(_eye).cross(_this.object.up).setLength(mouseChange.x)
          pan.add(objectUp.copy(_this.object.up).setLength(mouseChange.y))

          _this.object.position.add(pan)
          _this.target.add(pan)

          if (_this.staticMoving) {
            _panStart.copy(_panEnd)
          } else {
            _panStart.add(mouseChange.subVectors(_panEnd, _panStart).multiplyScalar(_this.dynamicDampingFactor))
          }

          _changed = true
        }
      }
    })()

    this.update = () => {
      _eye.subVectors(_this.object.position, _this.target)

      if (!_this.noRotate) {
        _this.rotateCamera()
      }

      if (!_this.noZoom) {
        _this.zoomCamera()

        if (_changed) {
          _this.object.updateProjectionMatrix()
        }
      }

      if (!_this.noPan) {
        _this.panCamera()
      }

      _this.object.position.addVectors(_this.target, _eye)

      _this.object.lookAt(_this.target)

      if (_changed) {
        _this.dispatchEvent(changeEvent)

        _changed = false
      }
    }

    this.reset = () => {
      _state = STATE.NONE
      _prevState = STATE.NONE

      _this.target.copy(_this.target0)
      _this.object.position.copy(_this.position0)
      _this.object.up.copy(_this.up0)

      _eye.subVectors(_this.object.position, _this.target)

      _this.object.left = _this.left0
      _this.object.right = _this.right0
      _this.object.top = _this.top0
      _this.object.bottom = _this.bottom0

      _this.object.lookAt(_this.target)

      _this.dispatchEvent(changeEvent)

      _changed = false
    }

    // listeners

    function keydown({ keyCode }) {
      if (_this.enabled === false) return

      window.removeEventListener('keydown', keydown)

      _prevState = _state

      if (_state !== STATE.NONE) {
        return
      } else if (keyCode === _this.keys[STATE.ROTATE] && !_this.noRotate) {
        _state = STATE.ROTATE
      } else if (keyCode === _this.keys[STATE.ZOOM] && !_this.noZoom) {
        _state = STATE.ZOOM
      } else if (keyCode === _this.keys[STATE.PAN] && !_this.noPan) {
        _state = STATE.PAN
      }
    }

    function keyup() {
      if (_this.enabled === false) return

      _state = _prevState

      window.addEventListener('keydown', keydown, false)
    }

    function mousedown(event) {
      if (_this.enabled === false) return

      event.preventDefault()
      event.stopPropagation()

      if (_state === STATE.NONE) {
        _state = event.button
      }

      if (_state === STATE.ROTATE && !_this.noRotate) {
        _rotateStart.copy(getMouseProjectionOnBall(event.pageX, event.pageY))
        _rotateEnd.copy(_rotateStart)
      } else if (_state === STATE.ZOOM && !_this.noZoom) {
        _zoomStart.copy(getMouseOnScreen(event.pageX, event.pageY))
        _zoomEnd.copy(_zoomStart)
      } else if (_state === STATE.PAN && !_this.noPan) {
        _panStart.copy(getMouseOnScreen(event.pageX, event.pageY))
        _panEnd.copy(_panStart)
      }

      document.addEventListener('mousemove', mousemove, false)
      document.addEventListener('mouseup', mouseup, false)

      _this.dispatchEvent(startEvent)
    }

    function mousemove(event) {
      if (_this.enabled === false) return

      event.preventDefault()
      event.stopPropagation()

      if (_state === STATE.ROTATE && !_this.noRotate) {
        _rotateEnd.copy(getMouseProjectionOnBall(event.pageX, event.pageY))
      } else if (_state === STATE.ZOOM && !_this.noZoom) {
        _zoomEnd.copy(getMouseOnScreen(event.pageX, event.pageY))
      } else if (_state === STATE.PAN && !_this.noPan) {
        _panEnd.copy(getMouseOnScreen(event.pageX, event.pageY))
      }
    }

    function mouseup(event) {
      if (_this.enabled === false) return

      event.preventDefault()
      event.stopPropagation()

      _state = STATE.NONE

      document.removeEventListener('mousemove', mousemove)
      document.removeEventListener('mouseup', mouseup)
      _this.dispatchEvent(endEvent)
    }

    function mousewheel(event) {
      if (_this.enabled === false) return

      event.preventDefault()
      event.stopPropagation()

      switch (event.deltaMode) {
        case 2:
          // Zoom in pages
          _zoomStart.y -= event.deltaY * 0.025
          break

        case 1:
          // Zoom in lines
          _zoomStart.y -= event.deltaY * 0.01
          break

        default:
          // undefined, 0, assume pixels
          _zoomStart.y -= event.deltaY * 0.00025
          break
      }

      _this.mousePosition.x = (event.offsetX / _this.screen.width) * 2 - 1
      _this.mousePosition.y = -(event.offsetY / _this.screen.height) * 2 + 1

      _this.dispatchEvent(startEvent)
      _this.dispatchEvent(endEvent)
    }

    function touchstart({ touches }) {
      if (_this.enabled === false) return

      switch (touches.length) {
        case 1:
          _state = STATE.TOUCH_ROTATE
          _rotateStart.copy(getMouseProjectionOnBall(touches[0].pageX, touches[0].pageY))
          _rotateEnd.copy(_rotateStart)
          break

        case 2:
          _state = STATE.TOUCH_ZOOM_PAN
          const dx = touches[0].pageX - touches[1].pageX
          const dy = touches[0].pageY - touches[1].pageY
          _touchZoomDistanceEnd = _touchZoomDistanceStart = Math.sqrt(dx * dx + dy * dy)

          const x = (touches[0].pageX + touches[1].pageX) / 2
          const y = (touches[0].pageY + touches[1].pageY) / 2
          _panStart.copy(getMouseOnScreen(x, y))
          _panEnd.copy(_panStart)
          break

        default:
          _state = STATE.NONE
      }
      _this.dispatchEvent(startEvent)
    }

    function touchmove(event) {
      if (_this.enabled === false) return

      event.preventDefault()
      event.stopPropagation()

      switch (event.touches.length) {
        case 1:
          _rotateEnd.copy(getMouseProjectionOnBall(event.touches[0].pageX, event.touches[0].pageY))
          break

        case 2:
          const dx = event.touches[0].pageX - event.touches[1].pageX
          const dy = event.touches[0].pageY - event.touches[1].pageY
          _touchZoomDistanceEnd = Math.sqrt(dx * dx + dy * dy)

          const x = (event.touches[0].pageX + event.touches[1].pageX) / 2
          const y = (event.touches[0].pageY + event.touches[1].pageY) / 2
          _panEnd.copy(getMouseOnScreen(x, y))
          break

        default:
          _state = STATE.NONE
      }
    }

    function touchend({ touches }) {
      if (_this.enabled === false) return

      switch (touches.length) {
        case 1:
          _rotateEnd.copy(getMouseProjectionOnBall(touches[0].pageX, touches[0].pageY))
          _rotateStart.copy(_rotateEnd)
          break

        case 2:
          _touchZoomDistanceStart = _touchZoomDistanceEnd = 0

          const x = (touches[0].pageX + touches[1].pageX) / 2
          const y = (touches[0].pageY + touches[1].pageY) / 2
          _panEnd.copy(getMouseOnScreen(x, y))
          _panStart.copy(_panEnd)
          break
      }

      _state = STATE.NONE
      _this.dispatchEvent(endEvent)
    }

    function contextmenu(event) {
      event.preventDefault()
    }

    this.dispose = function () {
      this.domElement.removeEventListener('contextmenu', contextmenu, false)
      this.domElement.removeEventListener('mousedown', mousedown, false)
      this.domElement.removeEventListener('wheel', mousewheel, false)

      this.domElement.removeEventListener('touchstart', touchstart, false)
      this.domElement.removeEventListener('touchend', touchend, false)
      this.domElement.removeEventListener('touchmove', touchmove, false)

      document.removeEventListener('mousemove', mousemove, false)
      document.removeEventListener('mouseup', mouseup, false)

      window.removeEventListener('keydown', keydown, false)
      window.removeEventListener('keyup', keyup, false)
    }

    this.connect = function (domElement) {
      this.dispose()

      this.domElement = domElement
      this.domElement.addEventListener('contextmenu', contextmenu, false)
      this.domElement.addEventListener('mousedown', mousedown, false)
      this.domElement.addEventListener('wheel', mousewheel, false)

      this.domElement.addEventListener('touchstart', touchstart, false)
      this.domElement.addEventListener('touchend', touchend, false)
      this.domElement.addEventListener('touchmove', touchmove, false)

      window.addEventListener('keydown', keydown, false)
      window.addEventListener('keyup', keyup, false)

      this.handleResize()
      // force an update at start
      this.update()
    }

    if (domElement) {
      this.connect(this.domElement)
    }
  }
}
