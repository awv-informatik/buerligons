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
import type { PmiIssue, PmiValidation } from './usePmiValidation'

const ISSUE_COLOR = { error: '#f5222d', warning: '#fa8c16' }
const issueColor = (issues: PmiIssue[] | undefined) =>
  issues?.some(i => i.level === 'error') ? ISSUE_COLOR.error : issues?.length ? ISSUE_COLOR.warning : undefined

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
  /** findings of the validation per item (usePmiValidation().byItem): shown as the row's mark and tooltip */
  issues?: Record<number, PmiIssue[]>
}> = ({ doc, error, active = null, selected = null, onHover, onSelect, maxHeight = 360, issues }) => {
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
          const rowIssues = issues?.[id]
          const markCol = issueColor(rowIssues)
          return (
            <div
              key={`${e.kind}-${id}`}
              data-pmi-row={id}
              onMouseEnter={() => onHover?.(id)}
              onClick={() => onSelect?.(selected === id ? null : id)}
              title={[`${e.item.name}: ${statusLabel(e.item.status)}`, ...(rowIssues ?? []).map(i => i.message)].join('\n')}
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
                data-pmi-mark={markCol ? (markCol === ISSUE_COLOR.error ? 'error' : 'warning') : e.item.status}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: markCol ? 1 : 4,
                  transform: markCol ? 'rotate(45deg)' : undefined,
                  background: markCol ?? (e.item.status === 'valid' ? '#52c41a' : statusCol),
                }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

const CATEGORY_NAMES: Record<string, string> = { syntax: 'Syntax', semantics: 'Rules of the standard', model: 'Model' }

/**
 * The findings of the validation (DOM component), grouped by level: syntax (names and values), rules of the
 * standard (allowed combinations) and model (geometry and relations, e.g. a +/- location without datum). A click
 * on a finding selects its item.
 */
export const PmiIssueList: React.FC<{ validation: PmiValidation; onSelect?: (id: number) => void }> = ({
  validation,
  onSelect,
}) => {
  const colors = useRCadTheme()
  if (validation.issues.length === 0) return <div style={{ color: colors.dim }}>No findings.</div>
  const groups = ['syntax', 'semantics', 'model']
    .map(c => ({ c, items: validation.issues.filter(i => (i.category ?? 'semantics') === c) }))
    .filter(g => g.items.length > 0)
  return (
    <div data-pmi-issues={validation.issues.length} style={{ display: 'grid', gap: 4 }}>
      {groups.map(g => (
        <div key={g.c}>
          <div style={{ color: colors.dim, fontSize: 11 }}>{CATEGORY_NAMES[g.c] ?? g.c}</div>
          {g.items.map((i, k) => (
            <div
              key={k}
              data-pmi-issue={i.category}
              onClick={() => typeof i.id === 'number' && onSelect?.(i.id)}
              style={{
                display: 'grid',
                gridTemplateColumns: '10px 1fr',
                gap: 6,
                padding: '2px 0',
                cursor: typeof i.id === 'number' && onSelect ? 'pointer' : 'default',
              }}>
              <span style={{ color: i.level === 'error' ? ISSUE_COLOR.error : ISSUE_COLOR.warning }}>
                {i.level === 'error' ? '\u2716' : '\u26A0'}
              </span>
              <span>
                {i.name && <b>{i.name}: </b>}
                {i.message}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
