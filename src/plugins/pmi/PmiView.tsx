import { DrawingID } from '@buerli.io/core'
import { Overlay, useDrawing } from '@buerli.io/react'
import { useRCadTheme } from '@buerli.io/react-cad'
import { Html, Line } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import React from 'react'
import * as THREE from 'three'
import { entriesOf, featuresOf, formatDimension, formatFrame, statusColor } from './format'
import { DatumTriangle, ToleranceGlyph } from './glyphs'
import { PmiDocument, PmiElement, PmiEntry, PmiPlane, Vec3 } from './types'

const HIGHLIGHT = '#e36b7c'
const toV = (p: Vec3) => new THREE.Vector3(p.x, p.y, p.z)

/** The graphic id of an element: the face/edge/vertex id the reference object reports, else the element id. */
const graphicIdOf = (tree: Record<number, any>, el: PmiElement): number => {
  const ref = tree[el.reference]
  const v = ref?.members?.faceId?.value ?? ref?.members?.edgeId?.value ?? ref?.members?.vertexId?.value
  return typeof v === 'number' ? v : el.id
}

/** Highlights the faces and edges of the features an entry is attached to (canvas component). */
export const PmiFeatureHighlight: React.FC<{ drawingId: DrawingID; doc: PmiDocument; entry: PmiEntry; color?: string }> = ({
  drawingId,
  doc,
  entry,
  color = HIGHLIGHT,
}) => {
  const tree = useDrawing(drawingId, d => d.structure.tree)
  const cache = useDrawing(drawingId, d => d.geometry.cache)
  const elems = React.useMemo(() => {
    const meshes: any[] = []
    const curves: any[] = []
    if (!tree || !cache) return { meshes, curves }
    for (const f of featuresOf(doc, entry)) {
      for (const el of f.elements) {
        const gid = graphicIdOf(tree, el)
        for (const c of Object.values(cache) as any[]) {
          const mesh = c?.meshes?.find((m: any) => m.graphicId === gid)
          if (mesh) {
            meshes.push(mesh)
            break
          }
          const curve = c?.map?.[gid]
          if (curve) {
            curves.push(curve)
            break
          }
        }
      }
    }
    return { meshes, curves }
  }, [tree, cache, doc, entry])
  return (
    <>
      {elems.meshes.map((m, i) => (
        <Overlay.Mesh key={`m${i}`} elem={m} color={color} opacity={0.45} renderOrder={1500} />
      ))}
      {elems.curves.map((c, i) => (
        <Overlay.Spline key={`c${i}`} elem={c} color={color} renderOrder={1500} lineWidth={5} />
      ))}
    </>
  )
}

const DimensionLabel: React.FC<{ entry: PmiEntry & { kind: 'dimension' }; decimals: number }> = ({ entry, decimals }) => {
  const t = formatDimension(entry.item, decimals)
  const body = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {t.main && <span>{t.main}</span>}
      {t.upper !== undefined && (
        <span style={{ display: 'inline-flex', flexDirection: 'column', fontSize: '0.75em', lineHeight: 1.05 }}>
          <span>{t.upper}</span>
          <span>{t.lower}</span>
        </span>
      )}
    </span>
  )
  if (t.basic) return <span style={{ border: '1px solid currentColor', padding: '0 3px' }}>{body}</span>
  if (t.reference) return <span>({body})</span>
  return body
}

const ToleranceFrame: React.FC<{ entry: PmiEntry & { kind: 'tolerance' }; decimals: number }> = ({ entry, decimals }) => {
  const cells = formatFrame(entry.item, decimals)
  const cell: React.CSSProperties = { padding: '1px 4px', borderLeft: '1px solid currentColor', whiteSpace: 'nowrap' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'stretch', border: '1px solid currentColor' }}>
      <span style={{ padding: '2px 3px', display: 'flex', alignItems: 'center' }}>
        <ToleranceGlyph type={entry.item.type} size={13} />
      </span>
      <span style={cell}>{cells.tolerance}</span>
      {cells.datums.map((d, i) => (
        <span key={i} style={cell}>
          {d}
        </span>
      ))}
    </span>
  )
}

/**
 * Dragging a label: the label follows the pointer on the plane through its position that faces the camera; on
 * release the new position is reported (a release without movement is a click). Returns the position to show
 * while dragging and the mouse-down handler for the label.
 */
const useLabelDrag = (
  textPos: Vec3 | undefined,
  onDrop: ((p: Vec3) => void) | undefined,
  onClick: (() => void) | undefined,
  /** the label moves in this plane (its annotation plane); without it in the plane facing the camera */
  planeNormal?: Vec3,
) => {
  const camera = useThree(s => s.camera)
  const gl = useThree(s => s.gl)
  const controls = useThree(s => s.controls) as any
  const invalidate = useThree(s => s.invalidate)
  const [dragPos, setDragPos] = React.useState<THREE.Vector3 | null>(null)
  // a dropped label keeps its dragged position until the new document arrives
  React.useEffect(() => setDragPos(null), [textPos?.x, textPos?.y, textPos?.z])

  const onMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0 || !textPos) return
      e.stopPropagation()
      e.preventDefault()
      const start = { x: e.clientX, y: e.clientY }
      const normal = planeNormal ? toV(planeNormal).normalize() : camera.getWorldDirection(new THREE.Vector3()).negate()
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, toV(textPos))
      const raycaster = new THREE.Raycaster()
      let moved = false
      let last: THREE.Vector3 | null = null
      const wasEnabled = controls?.enabled
      if (onDrop && controls) controls.enabled = false
      const pointAt = (x: number, y: number) => {
        const r = gl.domElement.getBoundingClientRect()
        const ndc = new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1)
        raycaster.setFromCamera(ndc, camera)
        return raycaster.ray.intersectPlane(plane, new THREE.Vector3())
      }
      const move = (ev: MouseEvent) => {
        if (!onDrop) return
        if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 4) return
        moved = true
        const p = pointAt(ev.clientX, ev.clientY)
        if (p) {
          last = p
          setDragPos(p.clone())
          invalidate()
        }
      }
      const up = () => {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
        if (controls && wasEnabled !== undefined) controls.enabled = wasEnabled
        if (moved && last && onDrop) onDrop({ x: last.x, y: last.y, z: last.z })
        else {
          setDragPos(null)
          onClick?.()
        }
      }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    },
    [textPos, onDrop, onClick, camera, gl, controls, invalidate, planeNormal],
  )
  return { dragPos, onMouseDown }
}

const projectToPlane = (p: THREE.Vector3, origin: THREE.Vector3, normal: THREE.Vector3) =>
  p.clone().sub(normal.clone().multiplyScalar(p.clone().sub(origin).dot(normal)))

/**
 * The lines of a distance in its annotation plane: two extension lines from the features (projected into the
 * plane) past the dimension line, the dimension line through the text, and an arrow head at each end.
 */
const dimensionLines = (anchors: THREE.Vector3[], textPos: THREE.Vector3, normal: THREE.Vector3, size: number) => {
  const n = normal.clone().normalize()
  const a0 = projectToPlane(anchors[0], textPos, n)
  const a1 = projectToPlane(anchors[1], textPos, n)
  const span = a1.clone().sub(a0)
  if (span.length() < 1e-9) return [[textPos, a0]]
  const u = span.clone().normalize()
  const toText = textPos.clone().sub(a0)
  const side = toText.clone().sub(u.clone().multiplyScalar(toText.dot(u)))
  const d0 = a0.clone().add(side)
  const d1 = d0.clone().add(u.clone().multiplyScalar(span.dot(u)))
  const over = side.length() > 1e-9 ? side.clone().normalize().multiplyScalar(0.015 * size) : new THREE.Vector3()
  const h = 0.025 * size
  const w = side.length() > 1e-9 ? side.clone().normalize() : new THREE.Vector3().crossVectors(n, u)
  const arrow = (tip: THREE.Vector3, back: THREE.Vector3) => [
    [tip, tip.clone().add(back.clone().multiplyScalar(h)).add(w.clone().multiplyScalar(0.3 * h))],
    [tip, tip.clone().add(back.clone().multiplyScalar(h)).sub(w.clone().multiplyScalar(0.3 * h))],
  ]
  // the text may sit beside the measured span: the dimension line runs on to it
  const t = toText.dot(u)
  const lineStart = t < 0 ? a0.clone().add(side).add(u.clone().multiplyScalar(t)) : d0
  const lineEnd = t > span.dot(u) ? a0.clone().add(side).add(u.clone().multiplyScalar(t)) : d1
  return [
    [a0, d0.clone().add(over)],
    [a1, d1.clone().add(over)],
    [lineStart, lineEnd],
    ...arrow(d0, u),
    ...arrow(d1, u.clone().negate()),
  ] as THREE.Vector3[][]
}

/**
 * A label lying in its annotation plane. It is turned to the viewer's side of the plane and so that the text
 * reads from left to right; seen almost edge-on it fades out.
 */
const PlaneLabel: React.FC<{ position: THREE.Vector3; plane: PmiPlane; partSize: number; children: React.ReactNode }> = ({
  position,
  plane,
  partSize,
  children,
}) => {
  const group = React.useRef<THREE.Group>(null)
  const fade = React.useRef<HTMLDivElement>(null)
  const basis = React.useMemo(() => {
    const z = toV(plane.normal).normalize()
    const x = toV(plane.xDir).normalize()
    return { x, z, y: new THREE.Vector3().crossVectors(z, x) }
  }, [plane])
  useFrame(({ camera }) => {
    const g = group.current
    if (!g) return
    const toCamera = camera.position.clone().sub(position).normalize()
    let { x, y, z } = basis
    if (z.dot(toCamera) < 0) {
      // seen from the back: turn over about the reading direction's normal
      x = x.clone().negate()
      z = z.clone().negate()
    }
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
    if (x.dot(right) < 0) {
      x = x.clone().negate()
      y = y.clone().negate()
    }
    const m = new THREE.Matrix4().makeBasis(x, new THREE.Vector3().crossVectors(z, x), z)
    g.quaternion.setFromRotationMatrix(m)
    if (fade.current) {
      const facing = Math.abs(z.dot(toCamera))
      fade.current.style.opacity = String(Math.min(1, Math.max(0.12, (facing - 0.08) / 0.25)))
    }
  })
  return (
    <group ref={group} position={position}>
      <Html transform center distanceFactor={Math.max(1, partSize)} zIndexRange={[30, 0]}>
        <div ref={fade}>{children}</div>
      </Html>
    </group>
  )
}

/** One annotation (datum symbol, dimension or feature control frame) with its leaders (canvas component). */
export const PmiAnnotation: React.FC<{
  entry: PmiEntry
  decimals?: number
  highlighted?: boolean
  background?: string
  text?: string
  onHover?: (id: number | null) => void
  onSelect?: (id: number) => void
  /** called with the new label position when the label was dragged; without it labels cannot be moved */
  onMove?: (id: number, textPosition: Vec3) => void
  /** draw the annotation in its annotation plane (when it has one) instead of facing the viewer */
  inPlane?: boolean
  /** size of the part: the text height in a plane is a fraction of it */
  partSize?: number
}> = ({
  entry,
  decimals = 3,
  highlighted = false,
  background = '#ffffff',
  text = '#000000',
  onHover,
  onSelect,
  onMove,
  inPlane = true,
  partSize = 100,
}) => {
  const d = entry.item.display
  const id = entry.item.id
  const plane = inPlane ? d?.plane : undefined
  const onDrop = React.useMemo(() => (onMove ? (p: Vec3) => onMove(id, p) : undefined), [onMove, id])
  const onClick = React.useMemo(() => (onSelect ? () => onSelect(id) : undefined), [onSelect, id])
  const { dragPos, onMouseDown } = useLabelDrag(d?.textPos, onDrop, onClick, plane?.normal)
  if (!d?.textPos) return null
  const color = highlighted ? HIGHLIGHT : statusColor(entry.item.status, text)
  const anchors = d.anchors ?? (d.anchor ? [d.anchor] : [])
  const textPos = dragPos ?? toV(d.textPos)
  const label = (
    <div
      data-pmi-item={id}
      data-pmi-plane={plane?.mode ?? 'screen'}
      title={onMove ? 'Drag to move, click to select' : undefined}
      onMouseEnter={() => onHover?.(id)}
      onMouseLeave={() => onHover?.(null)}
      onMouseDown={onMouseDown}
      style={{
        color,
        background: plane ? 'transparent' : background,
        font: '12px/1.2 "Segoe UI", Arial, sans-serif',
        padding: entry.kind === 'tolerance' ? 0 : '1px 4px',
        border: entry.kind === 'datum' ? '1px solid currentColor' : 'none',
        borderRadius: 1,
        cursor: onMove ? 'move' : onSelect ? 'pointer' : 'default',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        boxShadow: highlighted ? `0 0 0 1px ${HIGHLIGHT}` : 'none',
      }}>
      {entry.kind === 'datum' && <span style={{ fontWeight: 600 }}>{entry.item.letter}</span>}
      {entry.kind === 'dimension' && <DimensionLabel entry={entry} decimals={decimals} />}
      {entry.kind === 'tolerance' && <ToleranceFrame entry={entry} decimals={decimals} />}
    </div>
  )
  if (plane) {
    const lines =
      entry.kind === 'dimension' && anchors.length === 2
        ? dimensionLines(anchors.map(toV), textPos, toV(plane.normal), partSize)
        : anchors.map(a => [textPos, projectToPlane(toV(a), textPos, toV(plane.normal))] as THREE.Vector3[])
    return (
      <group>
        {lines.map((pts, i) => (
          <Line key={i} points={pts} color={color} lineWidth={highlighted ? 2 : 1} depthTest={false} renderOrder={2000} />
        ))}
        {entry.kind === 'datum' && d.anchor && (
          <Html position={toV(d.anchor)} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none', color }}>
            <DatumTriangle size={10} />
          </Html>
        )}
        <PlaneLabel position={textPos} plane={plane} partSize={partSize}>
          {label}
        </PlaneLabel>
      </group>
    )
  }
  return (
    <group>
      {anchors.map((a, i) => (
        <Line
          key={i}
          points={[textPos, toV(a)]}
          color={color}
          lineWidth={highlighted ? 2 : 1}
          depthTest={false}
          renderOrder={2000}
        />
      ))}
      {entry.kind === 'datum' && d.anchor && (
        <Html position={toV(d.anchor)} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none', color }}>
          <DatumTriangle size={10} />
        </Html>
      )}
      <Html position={textPos} center zIndexRange={[30, 0]}>
        {label}
      </Html>
    </group>
  )
}

/**
 * All annotations of a PMI document plus the highlight of the active item's faces (canvas component, place it
 * inside the r3f Canvas of any buerli app). State comes in through props, so the host decides where hover and
 * selection live.
 */
export const PmiAnnotations: React.FC<{
  drawingId: DrawingID
  doc: PmiDocument | undefined
  show?: boolean
  active?: number | null
  onHover?: (id: number | null) => void
  onSelect?: (id: number) => void
  onMove?: (id: number, textPosition: Vec3) => void
  /** draw the annotations in their annotation planes (default) or all facing the viewer */
  inPlanes?: boolean
}> = ({ drawingId, doc, show = true, active = null, onHover, onSelect, onMove, inPlanes = true }) => {
  const colors = useRCadTheme()
  const entries = React.useMemo(() => entriesOf(doc), [doc])
  if (!doc) return null
  const activeEntry = entries.find(e => e.item.id === active)
  const decimals = Math.max(doc.decimals ?? 2, 3)
  return (
    <group name="pmi">
      {show &&
        entries.map(e => (
          <PmiAnnotation
            key={`${e.kind}-${e.item.id}`}
            entry={e}
            decimals={decimals}
            highlighted={e.item.id === active}
            background={colors.panel}
            text={colors.ink}
            onHover={onHover}
            onSelect={onSelect}
            onMove={onMove}
            inPlane={inPlanes}
            partSize={doc.display?.size}
          />
        ))}
      {activeEntry && <PmiFeatureHighlight drawingId={drawingId} doc={doc} entry={activeEntry} />}
    </group>
  )
}
