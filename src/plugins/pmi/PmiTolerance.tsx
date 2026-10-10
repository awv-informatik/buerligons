import { getApiFacade } from '@buerli.io/classcad'
import { DrawingID } from '@buerli.io/core'
import { useRCadTheme } from '@buerli.io/react-cad'
import React from 'react'
import { PmiDimension } from './types'

// The tolerance of a dimension as a structured form: a type and the fields that type needs, a quick entry that
// fills them from text ("0.1", "+0.1/-0.05", "H7"), and a live line with nominal, minimum and maximum. Used for
// promotion, creation and editing of dimensions.

export type ToleranceType = 'none' | 'symmetric' | 'deviation' | 'limits' | 'fit' | 'basic' | 'reference'

export type ToleranceState = {
  type: ToleranceType
  /** symmetric: the +/- value */
  value: string
  /** deviation: upper and lower deviation */
  upper: string
  lower: string
  /** limits: maximum and minimum size */
  max: string
  min: string
  /** fit: ISO 286 class */
  fit: string
}

export const TOLERANCE_TYPES: { type: ToleranceType; label: string }[] = [
  { type: 'none', label: 'None' },
  { type: 'symmetric', label: 'Symmetric ±' },
  { type: 'deviation', label: 'Deviation +/−' },
  { type: 'limits', label: 'Limits min/max' },
  { type: 'fit', label: 'Fit (ISO 286)' },
  { type: 'basic', label: 'Basic (exact)' },
  { type: 'reference', label: 'Reference' },
]

export const emptyTolerance = (type: ToleranceType = 'symmetric'): ToleranceState => ({
  type,
  value: '',
  upper: '',
  lower: '',
  max: '',
  min: '',
  fit: '',
})

const num = (s: string) => {
  const v = parseFloat(s.replace(',', '.'))
  return Number.isFinite(v) ? v : undefined
}
const fmt = (v: number) => String(+v.toFixed(6))

/** The form state of an existing dimension. */
export const toleranceOf = (dim: PmiDimension | undefined): ToleranceState => {
  if (!dim) return emptyTolerance()
  if (dim.qualifier === 'basic') return emptyTolerance('basic')
  if (dim.qualifier === 'reference') return emptyTolerance('reference')
  const v = dim.value
  if (!v || v.type === 'none') return emptyTolerance('none')
  if (v.type === 'isoClass') return { ...emptyTolerance('fit'), fit: v.isoClass ?? '' }
  if (v.type === 'limits') return { ...emptyTolerance('limits'), max: fmt(v.upperLimit), min: fmt(v.lowerLimit) }
  if (Math.abs(v.upper + v.lower) < 1e-12) return { ...emptyTolerance('symmetric'), value: fmt(v.upper) }
  return { ...emptyTolerance('deviation'), upper: fmt(v.upper), lower: fmt(v.lower) }
}

/**
 * The form state for a quick entry: "0.1" or "±0.1" (symmetric), "+0.1/-0.05" (deviation), "12.0/11.95" (two
 * sizes: limits, when a nominal is known and both lie near it), "H7" / "g6" (fit). Undefined when not understood.
 */
export const toleranceFromText = (text: string, nominal?: number): ToleranceState | undefined => {
  const t = text.trim().replace(/,/g, '.').replace(/±|\+\/-/g, '')
  if (!t) return emptyTolerance('none')
  if (/^[A-Za-z]{1,3}\s*\d{1,2}$/.test(t)) return { ...emptyTolerance('fit'), fit: t.replace(/\s+/g, '') }
  const NUM = '([+-]?(?:\\d+\\.?\\d*|\\.\\d+))'
  const single = t.match(new RegExp(`^${NUM}$`))
  if (single) return { ...emptyTolerance('symmetric'), value: fmt(Math.abs(parseFloat(single[1]))) }
  const pair = t.match(new RegExp(`^${NUM}\\s*(?:/|\\s)\\s*${NUM}$`))
  if (pair) {
    const a = parseFloat(pair[1])
    const b = parseFloat(pair[2])
    const signed = /^[+-]/.test(pair[1]) || /^[+-]/.test(pair[2])
    if (!signed && nominal !== undefined && Math.abs(a - nominal) < 0.5 * nominal && Math.abs(b - nominal) < 0.5 * nominal)
      return { ...emptyTolerance('limits'), max: fmt(Math.max(a, b)), min: fmt(Math.min(a, b)) }
    return { ...emptyTolerance('deviation'), upper: fmt(Math.max(a, b)), lower: fmt(Math.min(a, b)) }
  }
  return undefined
}

/** The arguments of api.v1.pmi (tolerance, qualifier) for a form state, or the reason it is not complete. */
export const toleranceArgs = (s: ToleranceState): { tolerance?: any; qualifier: string; error?: string } => {
  switch (s.type) {
    case 'none':
      return { tolerance: 'none', qualifier: '' }
    case 'basic':
    case 'reference':
      return { tolerance: 'none', qualifier: s.type }
    case 'symmetric': {
      const v = num(s.value)
      if (v === undefined || v <= 0) return { qualifier: '', error: 'Enter the ± value, e.g. 0.1.' }
      return { tolerance: Math.abs(v), qualifier: '' }
    }
    case 'deviation': {
      const u = num(s.upper)
      const l = num(s.lower)
      if (u === undefined || l === undefined) return { qualifier: '', error: 'Enter the upper and the lower deviation.' }
      if (l > u) return { qualifier: '', error: 'The lower deviation is above the upper one.' }
      return { tolerance: { upper: u, lower: l }, qualifier: '' }
    }
    case 'limits': {
      const mx = num(s.max)
      const mn = num(s.min)
      if (mx === undefined || mn === undefined) return { qualifier: '', error: 'Enter the maximum and the minimum size.' }
      if (mn > mx) return { qualifier: '', error: 'The minimum is above the maximum.' }
      return { tolerance: { limits: [mn, mx] }, qualifier: '' }
    }
    case 'fit':
      if (!/^[A-Za-z]{1,3}\d{1,2}$/.test(s.fit.trim())) return { qualifier: '', error: 'Enter an ISO 286 class, e.g. H7 or g6.' }
      return { tolerance: s.fit.trim(), qualifier: '' }
  }
}

/** Minimum and maximum of a form state for a nominal (fit deviations from the server). */
const useLimits = (drawingId: DrawingID, s: ToleranceState, nominal: number | undefined) => {
  const [fit, setFit] = React.useState<{ upper: number; lower: number } | null | undefined>()
  React.useEffect(() => {
    setFit(undefined)
    if (s.type !== 'fit' || nominal === undefined || !/^[A-Za-z]{1,3}\d{1,2}$/.test(s.fit.trim())) return
    let live = true
    const timer = setTimeout(() => {
      getApiFacade(drawingId)
        .callSafeApiV('v1', 'pmi', 'fitDeviations', { isoClass: s.fit.trim(), nominal })
        .then((res: any) => live && setFit(res?.result ?? null))
        .catch(() => live && setFit(null))
    }, 250)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [drawingId, s.type, s.fit, nominal])
  if (nominal === undefined) return undefined
  switch (s.type) {
    case 'symmetric': {
      const v = num(s.value)
      return v === undefined ? undefined : { min: nominal - Math.abs(v), max: nominal + Math.abs(v) }
    }
    case 'deviation': {
      const u = num(s.upper)
      const l = num(s.lower)
      return u === undefined || l === undefined ? undefined : { min: nominal + l, max: nominal + u }
    }
    case 'limits': {
      const mx = num(s.max)
      const mn = num(s.min)
      return mx === undefined || mn === undefined ? undefined : { min: mn, max: mx }
    }
    case 'fit':
      return fit ? { min: nominal + fit.lower, max: nominal + fit.upper } : fit === null ? null : undefined
    default:
      return undefined
  }
}

/**
 * The tolerance editor (DOM component): type, the fields of the type, a quick entry and the resulting minimum
 * and maximum. \`nominal\` is the size the tolerance applies to (design value or measured nominal); without it the
 * preview shows the deviations only.
 */
export const ToleranceEditor: React.FC<{
  drawingId: DrawingID
  value: ToleranceState
  onChange: (s: ToleranceState) => void
  nominal?: number
  decimals?: number
  onSubmit?: () => void
  autoFocus?: boolean
}> = ({ drawingId, value, onChange, nominal, decimals = 3, onSubmit, autoFocus }) => {
  const colors = useRCadTheme()
  const [quick, setQuick] = React.useState('')
  const [quickError, setQuickError] = React.useState(false)
  const limits = useLimits(drawingId, value, nominal)
  const first = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    if (autoFocus) first.current?.focus()
  }, [autoFocus])
  const field: React.CSSProperties = {
    font: 'inherit',
    color: colors.ink,
    background: colors.panel,
    border: `1px solid ${colors.line}`,
    borderRadius: 3,
    padding: '2px 4px',
    minWidth: 0,
  }
  const input = (key: keyof ToleranceState, label: string, placeholder: string) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
      <span style={{ color: colors.dim, whiteSpace: 'nowrap' }}>{label}</span>
      <input
        aria-label={label}
        value={value[key]}
        placeholder={placeholder}
        onChange={e => onChange({ ...value, [key]: e.target.value })}
        onKeyDown={e => e.key === 'Enter' && onSubmit?.()}
        style={{ ...field, flex: 1, width: 0 }}
      />
    </label>
  )
  const f = (v: number) => v.toFixed(decimals)
  const preview = (() => {
    if (value.type === 'basic') return 'Theoretically exact: no tolerance of its own, toleranced by a frame.'
    if (value.type === 'reference') return 'For information only, not inspected.'
    if (value.type === 'none') return 'No tolerance of its own (the general tolerance applies).'
    if (nominal === undefined) return 'Min and max follow from the measured size after creation.'
    if (limits === null) return 'The class is not known for this size.'
    if (!limits) return `Nominal ${f(nominal)}`
    return `Nominal ${f(nominal)}   Min ${f(limits.min)}   Max ${f(limits.max)}`
  })()
  return (
    <div data-pmi-tolerance={value.type} style={{ display: 'grid', gap: 4 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        <select
          aria-label="Tolerance type"
          value={value.type}
          onChange={e => onChange({ ...value, type: e.target.value as ToleranceType })}
          style={{ ...field, flex: 1 }}>
          {TOLERANCE_TYPES.map(t => (
            <option key={t.type} value={t.type}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          ref={first}
          aria-label="Quick entry"
          title="Quick entry: 0.1, +0.1/-0.05, 12.05/11.98 or H7"
          placeholder="quick: 0.1, H7"
          value={quick}
          onChange={e => {
            setQuick(e.target.value)
            const s = toleranceFromText(e.target.value, nominal)
            setQuickError(!s && e.target.value.trim() !== '')
            if (s && e.target.value.trim() !== '') onChange(s)
          }}
          onKeyDown={e => e.key === 'Enter' && onSubmit?.()}
          style={{ ...field, width: 90, borderColor: quickError ? '#f5222d' : colors.line }}
        />
      </div>
      {value.type === 'symmetric' && <div style={{ display: 'flex', gap: 6 }}>{input('value', '±', '0.1')}</div>}
      {value.type === 'deviation' && (
        <div style={{ display: 'flex', gap: 6 }}>
          {input('upper', 'Upper', '+0.1')}
          {input('lower', 'Lower', '-0.05')}
        </div>
      )}
      {value.type === 'limits' && (
        <div style={{ display: 'flex', gap: 6 }}>
          {input('max', 'Max', nominal !== undefined ? f(nominal + 0.1) : '')}
          {input('min', 'Min', nominal !== undefined ? f(nominal - 0.1) : '')}
        </div>
      )}
      {value.type === 'fit' && <div style={{ display: 'flex', gap: 6 }}>{input('fit', 'Class', 'H7')}</div>}
      <div data-pmi-limits style={{ color: colors.dim, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
        {preview}
      </div>
    </div>
  )
}
