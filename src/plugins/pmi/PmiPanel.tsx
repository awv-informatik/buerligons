import { useRCadTheme } from '@buerli.io/react-cad'
import React from 'react'
import {
  dimensionName,
  entriesOf,
  featureLabel,
  formatDimension,
  formatFrame,
  statusColor,
  statusLabel,
  toleranceName,
} from './format'
import { DatumTriangle, ToleranceGlyph } from './glyphs'
import { PmiDocument, PmiEntry } from './types'

const valueText = (entry: PmiEntry, decimals: number): string => {
  if (entry.kind === 'datum') return entry.item.letter
  if (entry.kind === 'dimension') {
    const t = formatDimension(entry.item, decimals)
    return [t.main, t.upper !== undefined ? `${t.upper}/${t.lower}` : ''].filter(Boolean).join(' ')
  }
  const f = formatFrame(entry.item, decimals)
  return [f.tolerance, ...f.datums].join(' | ')
}

const typeText = (entry: PmiEntry): string => {
  if (entry.kind === 'datum') return 'Datum'
  if (entry.kind === 'dimension') return dimensionName(entry.item.type)
  return toleranceName(entry.item.type)
}

/**
 * The inspection table of a PMI document (DOM component, usable in any panel): one row per datum, dimension
 * and tolerance with value, feature and status; hover and click are reported through callbacks.
 */
export const PmiTable: React.FC<{
  doc: PmiDocument | undefined
  error?: string
  active?: number | null
  selected?: number | null
  onHover?: (id: number | null) => void
  onSelect?: (id: number | null) => void
  maxHeight?: number
}> = ({ doc, error, active = null, selected = null, onHover, onSelect, maxHeight = 360 }) => {
  const colors = useRCadTheme()
  const entries = React.useMemo(() => entriesOf(doc), [doc])
  const decimals = Math.max(doc?.decimals ?? 2, 3)
  const counts = React.useMemo(() => {
    const c = { check: 0, unresolved: 0 }
    entries.forEach(e => {
      if (e.item.status === 'check') c.check++
      if (e.item.status === 'unresolved') c.unresolved++
    })
    return c
  }, [entries])

  // keep the row of an item picked in the view visible
  const listRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (selected === null || selected === undefined) return
    listRef.current?.querySelector(`[data-pmi-row="${selected}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  if (error) return <div style={{ color: '#f5222d' }}>{error}</div>
  if (!doc) return <div style={{ color: colors.dim }}>The part has no PMI.</div>
  return (
    <div style={{ width: '100%', color: colors.ink, font: '12px "Segoe UI", Arial, sans-serif' }}>
      <div style={{ color: colors.dim, marginBottom: 4 }}>
        {doc.datums.length} datums, {doc.dimensions.length} dimensions, {doc.tolerances.length} tolerances
        {counts.check > 0 && <span style={{ color: statusColor('check', colors.ink) }}>, {counts.check} to check</span>}
        {counts.unresolved > 0 && (
          <span style={{ color: statusColor('unresolved', colors.ink) }}>, {counts.unresolved} missing geometry</span>
        )}
      </div>
      <div
        ref={listRef}
        style={{ maxHeight, overflowY: 'auto', borderTop: `1px solid ${colors.line}` }}
        onMouseLeave={() => onHover?.(null)}>
        {entries.map(e => {
          const id = e.item.id
          const isActive = id === active || id === selected
          const statusCol = statusColor(e.item.status, colors.ink)
          return (
            <div
              key={`${e.kind}-${id}`}
              data-pmi-row={id}
              onMouseEnter={() => onHover?.(id)}
              onClick={() => onSelect?.(selected === id ? null : id)}
              title={`${e.item.name}: ${statusLabel(e.item.status)}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '18px 1fr 1.2fr 8px',
                alignItems: 'center',
                gap: 6,
                padding: '3px 4px',
                borderBottom: `1px solid ${colors.line}`,
                background: isActive ? colors.hover : 'transparent',
                cursor: onSelect ? 'pointer' : 'default',
              }}>
              <span style={{ display: 'flex', justifyContent: 'center' }}>
                {e.kind === 'tolerance' ? (
                  <ToleranceGlyph type={e.item.type} size={13} />
                ) : e.kind === 'datum' ? (
                  <DatumTriangle size={9} />
                ) : (
                  <span>&#x2194;</span>
                )}
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {typeText(e)}
                <div style={{ color: colors.dim, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {featureLabel(doc, e)}
                </div>
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {valueText(e, decimals)}
              </span>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  background: e.item.status === 'valid' ? '#52c41a' : statusCol,
                }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
