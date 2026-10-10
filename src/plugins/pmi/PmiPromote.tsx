import { getApiFacade } from '@buerli.io/classcad'
import { DrawingID, ObjectID } from '@buerli.io/core'
import { useDrawing } from '@buerli.io/react'
import { useRCadTheme } from '@buerli.io/react-cad'
import React from 'react'
import { dimensionName } from './format'
import { pmiCommand, setPmiState, usePmiState } from './store'
import { DesignDimension } from './types'

// Phase 4b: promotion of design dimensions. A sketch dimension or the height of an extrusion becomes an
// inspection dimension on the faces it produced (api.v1.pmi.promoteDimension); it stays linked to its source, so
// the nominal follows the design.

export type Tolerance = number | string | { upper: number; lower: number }

const NUM = '([+-]?(?:\\d+\\.?\\d*|\\.\\d+))'

/**
 * What the user typed as tolerance: "0.1" or "±0.1" (symmetric), "+0.1/-0.05" or "+0.1 -0.05" (deviations),
 * "H7" / "h6" (ISO 286 class); empty is no tolerance. Commas count as decimal points.
 */
export const parseTolerance = (text: string): { value?: Tolerance; error?: string } => {
  const t = text.trim().replace(/,/g, '.').replace(/±|\+\/-/g, '')
  if (!t) return {}
  if (/^[A-Za-z]{1,3}\s*\d{1,2}$/.test(t)) return { value: t.replace(/\s+/g, '') }
  const single = t.match(new RegExp(`^${NUM}$`))
  if (single) return { value: Math.abs(parseFloat(single[1])) }
  const pair = t.match(new RegExp(`^${NUM}\\s*(?:/|\\s)\\s*${NUM}$`))
  if (pair) {
    const a = parseFloat(pair[1])
    const b = parseFloat(pair[2])
    return { value: { upper: Math.max(a, b), lower: Math.min(a, b) } }
  }
  return { error: 'Tolerance: 0.1, +0.1/-0.05 or an ISO class like H7' }
}

/** A small button in the colours of the app theme (native buttons are light on the dark theme). */
export const ThemedButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }> = ({
  primary,
  style,
  ...props
}) => {
  const colors = useRCadTheme()
  return (
    <button
      type="button"
      {...props}
      style={{
        font: 'inherit',
        fontSize: 11,
        padding: '1px 8px',
        borderRadius: 3,
        cursor: props.disabled ? 'default' : 'pointer',
        opacity: props.disabled ? 0.5 : 1,
        color: primary ? '#fff' : colors.ink,
        background: primary ? '#1677ff' : 'transparent',
        border: `1px solid ${primary ? '#1677ff' : colors.line}`,
        ...style,
      }}
    />
  )
}

/** A message line of a form. */
export const ErrorLine: React.FC<{ text: string }> = ({ text }) => <div style={{ color: '#f5222d' }}>{text}</div>

export const messageOf = (res: any, fallback: string): string => {
  const msgs: any[] = res?.messages ?? []
  const worst = [...msgs].sort((a, b) => (b?.level ?? 0) - (a?.level ?? 0))[0]
  return worst?.message ?? fallback
}

/** The text of a failed call: the facade rejects with the API response ({ result, messages }) or an Error. */
export const errorText = (e: any, fallback: string): string =>
  e?.messages ? messageOf(e, fallback) : String(e?.message ?? e ?? fallback)

/**
 * The design dimensions of the current part (or of `partId`) that can be promoted, with their promotion state,
 * loaded again after every command of the drawing and when `revision` changes.
 */
export const useDesignDimensions = (drawingId: DrawingID, partId?: ObjectID, revision = 0) => {
  const currentProduct = useDrawing(drawingId, d => d.structure.currentProduct)
  const part = partId ?? currentProduct
  const stateCounter = useDrawing(drawingId, d => d.cad.states?.current)
  const [state, setState] = React.useState<{ items: DesignDimension[]; error?: string }>({ items: [] })
  const request = React.useRef(0)

  React.useEffect(() => {
    if (!part) {
      setState({ items: [] })
      return
    }
    const ticket = ++request.current
    const timer = setTimeout(async () => {
      try {
        const res: any = await getApiFacade(drawingId).callSafeApiV('v1', 'pmi', 'listDesignDimensions', { id: part })
        if (ticket !== request.current) return
        if (Array.isArray(res?.result)) setState({ items: res.result as DesignDimension[] })
        else setState({ items: [], error: messageOf(res, 'The design dimensions could not be read.') })
      } catch (e: any) {
        if (ticket === request.current) setState({ items: [], error: errorText(e, 'The design dimensions could not be read.') })
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [drawingId, part, stateCounter, revision])

  return { part, ...state }
}

/** The tolerance form of one design dimension. */
const ToleranceForm: React.FC<{
  item: DesignDimension
  busy: boolean
  error?: string
  onSubmit: (tolerance: Tolerance | undefined, qualifier: string) => void
  onCancel: () => void
}> = ({ item, busy, error, onSubmit, onCancel }) => {
  const colors = useRCadTheme()
  const [text, setText] = React.useState('')
  const [qualifier, setQualifier] = React.useState('')
  const parsed = qualifier === 'basic' ? {} : parseTolerance(text)
  const input = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => input.current?.focus(), [])
  const submit = () => {
    if (!parsed.error && !busy) onSubmit(parsed.value, qualifier)
  }
  const field = {
    font: 'inherit',
    color: colors.ink,
    background: colors.panel,
    border: `1px solid ${colors.line}`,
    borderRadius: 3,
    padding: '2px 4px',
  }
  return (
    <div
      data-pmi-promote-form={item.id}
      style={{ display: 'grid', gap: 4, padding: '4px 4px 6px 22px', borderBottom: `1px solid ${colors.line}` }}>
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          ref={input}
          aria-label="Tolerance"
          placeholder="0.1, +0.1/-0.05, H7"
          value={text}
          disabled={qualifier === 'basic'}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') onCancel()
          }}
          style={{ ...field, flex: 1, minWidth: 0 }}
        />
        <select aria-label="Qualifier" value={qualifier} onChange={e => setQualifier(e.target.value)} style={field}>
          <option value="">toleranced</option>
          <option value="basic">basic</option>
          <option value="reference">reference</option>
        </select>
      </div>
      {(parsed.error || error) && <ErrorLine text={(parsed.error ?? error) as string} />}
      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
        <ThemedButton onClick={onCancel} disabled={busy}>
          Cancel
        </ThemedButton>
        <ThemedButton primary onClick={submit} disabled={busy || !!parsed.error}>
          {busy ? 'Promoting ...' : 'Promote'}
        </ThemedButton>
      </div>
    </div>
  )
}

/**
 * The design dimensions of the part (DOM component): each one either names the PMI dimension that stands for it,
 * offers "Tolerance ..." to promote it, or says why it cannot be promoted yet.
 */
export const DesignDimensionList: React.FC<{ drawingId: DrawingID; partId?: ObjectID; maxHeight?: number }> = ({
  drawingId,
  partId,
  maxHeight = 240,
}) => {
  const colors = useRCadTheme()
  const state = usePmiState(drawingId)
  const { part, items, error } = useDesignDimensions(drawingId, partId, state.revision)
  const open = state.promoteTarget ?? null
  const [busy, setBusy] = React.useState(false)
  const [formError, setFormError] = React.useState<string>()
  const listRef = React.useRef<HTMLDivElement>(null)

  // a new target clears the message of the last attempt (a reload of the list after the attempt does not)
  React.useEffect(() => setFormError(undefined), [open])
  React.useEffect(() => {
    if (open === null) return
    listRef.current?.querySelector(`[data-pmi-design="${open}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, items])

  const promote = async (item: DesignDimension, tolerance: Tolerance | undefined, qualifier: string) => {
    if (!part) return
    setBusy(true)
    setFormError(undefined)
    try {
      const args: any = { id: part, dimension: item.id }
      if (tolerance !== undefined) args.tolerance = tolerance
      if (qualifier) args.qualifier = qualifier
      const res: any = await pmiCommand(drawingId, 'promoteDimension', args)
      const id = res?.result
      if (typeof id === 'number' && id > 0) setPmiState(drawingId, { promoteTarget: null, selected: id })
      else setFormError(messageOf(res, 'The dimension could not be promoted.'))
    } catch (e: any) {
      setFormError(errorText(e, 'The dimension could not be promoted.'))
    } finally {
      setBusy(false)
    }
  }

  if (error) return <div style={{ color: '#f5222d' }}>{error}</div>
  if (items.length === 0) return <div style={{ color: colors.dim }}>No sketch or feature dimensions.</div>
  const unknownTarget = open !== null && !items.some(i => i.id === open)
  return (
    <div ref={listRef} style={{ maxHeight, overflowY: 'auto', borderTop: `1px solid ${colors.line}` }}>
      {unknownTarget && (
        <div style={{ color: '#fa8c16', padding: '3px 4px' }}>
          The picked constraint is no dimension of this part.{' '}
          <a onClick={() => setPmiState(drawingId, { promoteTarget: null })}>Close</a>
        </div>
      )}
      {items.map(item => (
        <React.Fragment key={item.id}>
          <div
            data-pmi-design={item.id}
            onMouseEnter={() => item.promoted && setPmiState(drawingId, { hovered: item.promoted })}
            onMouseLeave={() => item.promoted && setPmiState(drawingId, { hovered: null })}
            title={item.reason ?? (item.promoted ? `Promoted as ${item.promotedName}` : undefined)}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              alignItems: 'center',
              gap: 6,
              padding: '3px 4px',
              borderBottom: open === item.id ? 'none' : `1px solid ${colors.line}`,
              background: open === item.id ? colors.hover : 'transparent',
            }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.name}
              <div style={{ color: colors.dim, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.owner}
                {item.type ? ` · ${dimensionName(item.type)}` : ''}
              </div>
            </span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Number(item.value.toFixed(4))}</span>
            <span style={{ textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.promoted ? (
                <a onClick={() => setPmiState(drawingId, { selected: item.promoted })}>{item.promotedName}</a>
              ) : item.type ? (
                open === item.id ? null : (
                  <ThemedButton onClick={() => setPmiState(drawingId, { promoteTarget: item.id })}>
                    Tolerance ...
                  </ThemedButton>
                )
              ) : (
                <span style={{ color: colors.dim }}>not yet</span>
              )}
            </span>
          </div>
          {open === item.id && !item.promoted && item.type && (
            <ToleranceForm
              item={item}
              busy={busy}
              error={formError}
              onSubmit={(t, q) => promote(item, t, q)}
              onCancel={() => setPmiState(drawingId, { promoteTarget: null })}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}
