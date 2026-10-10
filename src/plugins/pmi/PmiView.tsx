import { DrawingID } from '@buerli.io/core'
import { Overlay, useDrawing } from '@buerli.io/react'
import { useRCadTheme } from '@buerli.io/react-cad'
import { Html, Line } from '@react-three/drei'
import React from 'react'
import * as THREE from 'three'
import { entriesOf, featuresOf, formatDimension, formatFrame, statusColor } from './format'
import { DatumTriangle, ToleranceGlyph } from './glyphs'
import { PmiDocument, PmiElement, PmiEntry, Vec3 } from './types'

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

/** One annotation (datum symbol, dimension or feature control frame) with its leaders (canvas component). */
export const PmiAnnotation: React.FC<{
  entry: PmiEntry
  decimals?: number
  highlighted?: boolean
  background?: string
  text?: string
  onHover?: (id: number | null) => void
  onSelect?: (id: number) => void
}> = ({ entry, decimals = 3, highlighted = false, background = '#ffffff', text = '#000000', onHover, onSelect }) => {
  const d = entry.item.display
  if (!d?.textPos) return null
  const color = highlighted ? HIGHLIGHT : statusColor(entry.item.status, text)
  const anchors = d.anchors ?? (d.anchor ? [d.anchor] : [])
  const id = entry.item.id
  return (
    <group>
      {anchors.map((a, i) => (
        <Line
          key={i}
          points={[toV(d.textPos as Vec3), toV(a)]}
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
      <Html position={toV(d.textPos)} center zIndexRange={[30, 0]}>
        <div
          data-pmi-item={id}
          onMouseEnter={() => onHover?.(id)}
          onMouseLeave={() => onHover?.(null)}
          onClick={() => onSelect?.(id)}
          style={{
            color,
            background,
            font: '12px/1.2 "Segoe UI", Arial, sans-serif',
            padding: entry.kind === 'tolerance' ? 0 : '1px 4px',
            border: entry.kind === 'datum' ? '1px solid currentColor' : 'none',
            borderRadius: 1,
            cursor: onSelect ? 'pointer' : 'default',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            boxShadow: highlighted ? `0 0 0 1px ${HIGHLIGHT}` : 'none',
          }}>
          {entry.kind === 'datum' && <span style={{ fontWeight: 600 }}>{entry.item.letter}</span>}
          {entry.kind === 'dimension' && <DimensionLabel entry={entry} decimals={decimals} />}
          {entry.kind === 'tolerance' && <ToleranceFrame entry={entry} decimals={decimals} />}
        </div>
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
}> = ({ drawingId, doc, show = true, active = null, onHover, onSelect }) => {
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
          />
        ))}
      {activeEntry && <PmiFeatureHighlight drawingId={drawingId} doc={doc} entry={activeEntry} />}
    </group>
  )
}
