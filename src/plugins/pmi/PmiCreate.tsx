import { getApiFacade } from '@buerli.io/classcad'
import { DrawingID } from '@buerli.io/core'
import { useDrawing } from '@buerli.io/react'
import { useRCadTheme } from '@buerli.io/react-cad'
import React from 'react'
import { dimensionName, toleranceName } from './format'
import { ErrorLine, errorText, parseTolerance, ThemedButton } from './PmiPromote'
import { pickedFaces, PmiPick } from './selection'
import { pmiCommand, setPmiState, usePmiState } from './store'
import { PmiCreateMode, PmiDimension, PmiDocument, PmiEntry } from './types'

// Phase 4b, guided creation and editing: datums, dimensions and geometric tolerances on faces picked in the view
// (context menu of a face: GD&T > Add datum / dimension / tolerance), and editing or deleting the item selected in
// the table. The forms call the existing api.v1.pmi.* functions. A cylinder stands for its axis where the type
// relates an axis (a distance to a hole, the position of a hole).

const SIZE_TYPES = ['diameter', 'radius', 'sphericalDiameter', 'sphericalRadius', 'thickness']
const LOCATION_TYPES = ['linearDistance', 'angular']
const TOLERANCE_TYPES = [
  'flatness',
  'straightness',
  'roundness',
  'cylindricity',
  'surfaceProfile',
  'lineProfile',
  'parallelism',
  'perpendicularity',
  'angularity',
  'position',
  'coaxiality',
  'concentricity',
  'symmetry',
  'circularRunout',
  'totalRunout',
]
/** form tolerances: no datum reference */
const FORM_TYPES = ['flatness', 'straightness', 'roundness', 'cylindricity']
/** types that tolerance the axis of a cylinder rather than its surface */
const AXIS_TYPES = ['parallelism', 'perpendicularity', 'angularity', 'position', 'coaxiality', 'concentricity', 'symmetry']

const isRound = (p: PmiPick) => p.surface === 'cylinder' || p.surface === 'cone'

/** What a dimension on the picked faces most likely is, and what else it could be. */
export const proposeDimension = (picks: PmiPick[]): { types: string[]; hint?: string } => {
  if (picks.length === 1) {
    if (isRound(picks[0])) return { types: ['diameter', 'radius'] }
    if (picks[0].surface === 'sphere') return { types: ['sphericalDiameter', 'sphericalRadius'] }
    return { types: [], hint: 'A dimension on one plane needs a second face: select two faces.' }
  }
  if (picks.length === 2) return { types: ['linearDistance', 'angular', 'thickness'] }
  return { types: [], hint: 'Select one face for a size or two faces for a distance.' }
}

/** What a geometric tolerance on the picked faces most likely is. */
export const proposeTolerance = (picks: PmiPick[]): string[] => {
  if (picks.length === 1 && isRound(picks[0])) return ['position', 'perpendicularity', 'cylindricity', 'roundness', 'coaxiality', 'totalRunout', ...TOLERANCE_TYPES]
  if (picks.length >= 1 && picks.every(p => p.surface === 'plane')) return ['flatness', 'parallelism', 'perpendicularity', 'position', ...TOLERANCE_TYPES]
  return ['surfaceProfile', ...TOLERANCE_TYPES]
}

const unique = (a: string[]) => a.filter((t, i) => a.indexOf(t) === i)

/** The next datum letter that is not used yet (I, O and Q are skipped, as by the server). */
export const nextDatumLetter = (doc: PmiDocument | undefined) => {
  const used = new Set((doc?.datums ?? []).map(d => d.letter))
  for (let c = 65; c <= 90; c++) {
    const l = String.fromCharCode(c)
    if (!'IOQ'.includes(l) && !used.has(l)) return l
  }
  return ''
}

/** The datum system of a tolerance as the server reads it: "A|B-C|D[MMR]". */
export const datumSystemText = (system: { datums: string[]; modifiers: string[] }[] | undefined) =>
  (system ?? [])
    .map(c => c.datums.join('-') + (c.modifiers?.length ? `[${c.modifiers.join(',')}]` : ''))
    .join('|')

/** The tolerance of a dimension as the user would type it. */
export const toleranceText = (dim: PmiDimension) => {
  const v = dim?.value
  if (!v || v.type === 'none') return ''
  if (v.type === 'isoClass') return v.isoClass ?? ''
  if (Math.abs(v.upper + v.lower) < 1e-12) return String(+v.upper.toFixed(6))
  return `+${+v.upper.toFixed(6)}/${+v.lower.toFixed(6)}`
}

const useField = () => {
  const colors = useRCadTheme()
  return {
    font: 'inherit',
    color: colors.ink,
    background: colors.panel,
    border: `1px solid ${colors.line}`,
    borderRadius: 3,
    padding: '2px 4px',
    minWidth: 0,
  } as React.CSSProperties
}

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const colors = useRCadTheme()
  return (
    <label style={{ display: 'grid', gridTemplateColumns: '70px 1fr', alignItems: 'center', gap: 6 }}>
      <span style={{ color: colors.dim }}>{label}</span>
      {children}
    </label>
  )
}

/** Runs one facade call and returns its result (intermediate steps; the last step goes through pmiCommand). */
const call = async (drawingId: DrawingID, func: string, args: any) => {
  const res: any = await getApiFacade(drawingId).callSafeApiV('v1', 'pmi', func, args)
  return res?.result
}

/** The PMI feature of a face, or of its axis. */
const featureOf = async (drawingId: DrawingID, part: number, pick: PmiPick, axis: boolean) => {
  const face = await call(drawingId, 'feature', { id: part, elements: [pick.id] })
  if (!axis || typeof face !== 'number') return face
  return call(drawingId, 'feature', { id: part, kind: 'axis', parents: [face] })
}

/**
 * The creation form (DOM component) for the request in the store (context menu of a face): datum, dimension or
 * tolerance on the picked faces. "Use selection" takes the faces selected in the view now.
 */
export const PmiCreateForm: React.FC<{ drawingId: DrawingID; doc: PmiDocument | undefined }> = ({ drawingId, doc }) => {
  const colors = useRCadTheme()
  const field = useField()
  const state = usePmiState(drawingId)
  const part = useDrawing(drawingId, d => d.structure.currentProduct) as number | undefined
  const request = state.create
  const [mode, setMode] = React.useState<PmiCreateMode>(request?.mode ?? 'datum')
  const [picks, setPicks] = React.useState<PmiPick[]>(request?.elements ?? [])
  const [letter, setLetter] = React.useState('')
  const [dimType, setDimType] = React.useState('')
  const [tolText, setTolText] = React.useState('')
  const [qualifier, setQualifier] = React.useState('')
  const [tolType, setTolType] = React.useState('')
  const [magnitude, setMagnitude] = React.useState('')
  const [datums, setDatums] = React.useState('')
  const [mmr, setMmr] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string>()

  React.useEffect(() => {
    if (!request) return
    setMode(request.mode)
    setPicks(request.elements)
    setError(undefined)
  }, [request])

  const dimProposal = proposeDimension(picks)
  const tolTypes = unique(proposeTolerance(picks))
  const dimTypeNow = dimProposal.types.includes(dimType) ? dimType : dimProposal.types[0] ?? ''
  const tolTypeNow = tolTypes.includes(tolType) ? tolType : tolTypes[0]
  const needsDatums = !FORM_TYPES.includes(tolTypeNow)
  const axisTolerance = picks.length === 1 && isRound(picks[0]) && AXIS_TYPES.includes(tolTypeNow)
  const letters = (doc?.datums ?? []).map(d => d.letter)

  if (!request) return null
  const close = () => setPmiState(drawingId, { create: null })

  const submit = async () => {
    if (!part || busy) return
    setBusy(true)
    setError(undefined)
    try {
      let res: any
      if (picks.length === 0) throw new Error('Select at least one face.')
      if (mode === 'datum') {
        const args: any = { id: part, elements: picks.map(p => p.id) }
        if (letter.trim()) args.letter = letter.trim().toUpperCase()
        res = await pmiCommand(drawingId, 'datum', args)
      } else if (mode === 'dimension') {
        if (!dimTypeNow) throw new Error(dimProposal.hint ?? 'No dimension type fits the selection.')
        const tol = qualifier === 'basic' ? {} : parseTolerance(tolText)
        if (tol.error) throw new Error(tol.error)
        const location = LOCATION_TYPES.includes(dimTypeNow)
        const features: number[] = []
        for (const p of picks) features.push(await featureOf(drawingId, part, p, location && isRound(p)))
        const args: any = { id: part, type: dimTypeNow, features }
        if (tol.value !== undefined) args.tolerance = tol.value
        if (qualifier) args.qualifier = qualifier
        res = await pmiCommand(drawingId, 'dimension', args)
      } else {
        const m = parseFloat(magnitude.replace(',', '.'))
        if (!(m > 0)) throw new Error('Enter the tolerance value, e.g. 0.05.')
        const args: any = { id: part, type: tolTypeNow, magnitude: m }
        if (axisTolerance) args.feature = await featureOf(drawingId, part, picks[0], true)
        else args.elements = picks.map(p => p.id)
        if (needsDatums && datums.trim()) args.datumSystem = datums.trim().toUpperCase()
        if (mmr) args.modifiers = ['MMR']
        res = await pmiCommand(drawingId, 'geometricTolerance', args)
      }
      const id = res?.result
      if (typeof id === 'number' && id > 0) setPmiState(drawingId, { create: null, selected: id })
      else setError(errorText(res, 'The item could not be created.'))
    } catch (e: any) {
      setError(errorText(e, 'The item could not be created.'))
    } finally {
      setBusy(false)
    }
  }

  const tab = (m: PmiCreateMode, label: string) => (
    <a
      onClick={() => setMode(m)}
      style={{
        padding: '1px 8px',
        borderBottom: `2px solid ${mode === m ? '#1677ff' : 'transparent'}`,
        color: mode === m ? colors.ink : colors.dim,
        cursor: 'pointer',
      }}>
      {label}
    </a>
  )

  return (
    <div
      data-pmi-create={mode}
      style={{ display: 'grid', gap: 6, padding: 6, marginBottom: 8, border: `1px solid ${colors.line}`, borderRadius: 4 }}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {tab('datum', 'Datum')}
        {tab('dimension', 'Dimension')}
        {tab('tolerance', 'Tolerance')}
        <span style={{ flex: 1 }} />
        <ThemedButton
          title="Take the faces selected in the view"
          onClick={() => {
            const now = pickedFaces(drawingId)
            if (now.length) setPicks(now)
          }}>
          Use selection
        </ThemedButton>
      </div>
      <div style={{ color: colors.dim }} data-pmi-picks={picks.map(p => p.id).join(',')}>
        {picks.length === 0
          ? 'No face selected.'
          : `${picks.length} face${picks.length > 1 ? 's' : ''}: ${picks.map(p => p.surface).join(', ')}`}
      </div>

      {mode === 'datum' && (
        <Row label="Letter">
          <input
            aria-label="Datum letter"
            value={letter}
            placeholder={nextDatumLetter(doc)}
            maxLength={2}
            onChange={e => setLetter(e.target.value)}
            style={field}
          />
        </Row>
      )}

      {mode === 'dimension' && (
        <>
          {dimProposal.types.length === 0 ? (
            <div style={{ color: '#fa8c16' }}>{dimProposal.hint}</div>
          ) : (
            <Row label="Type">
              <select aria-label="Dimension type" value={dimTypeNow} onChange={e => setDimType(e.target.value)} style={field}>
                {dimProposal.types.map(t => (
                  <option key={t} value={t}>
                    {dimensionName(t)}
                    {LOCATION_TYPES.includes(t) && picks.some(isRound) ? ' (to the axis)' : ''}
                  </option>
                ))}
              </select>
            </Row>
          )}
          <Row label="Tolerance">
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                aria-label="Tolerance"
                placeholder="0.1, +0.1/-0.05, H7"
                value={tolText}
                disabled={qualifier === 'basic'}
                onChange={e => setTolText(e.target.value)}
                style={{ ...field, flex: 1 }}
              />
              <select aria-label="Qualifier" value={qualifier} onChange={e => setQualifier(e.target.value)} style={field}>
                <option value="">toleranced</option>
                <option value="basic">basic</option>
                <option value="reference">reference</option>
              </select>
            </div>
          </Row>
        </>
      )}

      {mode === 'tolerance' && (
        <>
          <Row label="Type">
            <select aria-label="Tolerance type" value={tolTypeNow} onChange={e => setTolType(e.target.value)} style={field}>
              {tolTypes.map(t => (
                <option key={t} value={t}>
                  {toleranceName(t)}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Value">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                aria-label="Tolerance value"
                placeholder="0.05"
                value={magnitude}
                onChange={e => setMagnitude(e.target.value)}
                style={{ ...field, flex: 1 }}
              />
              {axisTolerance && <span style={{ color: colors.dim }}>⌀ zone (axis)</span>}
              <label style={{ display: 'flex', gap: 3, alignItems: 'center' }} title="Maximum material requirement">
                <input type="checkbox" checked={mmr} onChange={e => setMmr(e.target.checked)} />Ⓜ
              </label>
            </div>
          </Row>
          {needsDatums && (
            <Row label="Datums">
              <input
                aria-label="Datum system"
                placeholder={letters.length ? letters.slice(0, 3).join('|') : 'no datums yet'}
                value={datums}
                onChange={e => setDatums(e.target.value)}
                style={field}
              />
            </Row>
          )}
        </>
      )}

      {error && <ErrorLine text={error} />}
      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
        <ThemedButton onClick={close} disabled={busy}>
          Cancel
        </ThemedButton>
        <ThemedButton primary onClick={submit} disabled={busy || picks.length === 0}>
          {busy ? 'Creating ...' : 'Create'}
        </ThemedButton>
      </div>
    </div>
  )
}

/**
 * Editing of the item selected in the table (DOM component): tolerance and qualifier of a dimension, value and
 * datum system of a geometric tolerance, and deleting any item.
 */
export const PmiItemEditor: React.FC<{ drawingId: DrawingID; entry: PmiEntry }> = ({ drawingId, entry }) => {
  const colors = useRCadTheme()
  const field = useField()
  const item: any = entry.item
  const [tolText, setTolText] = React.useState(entry.kind === 'dimension' ? toleranceText(item) : '')
  const [qualifier, setQualifier] = React.useState(entry.kind === 'dimension' ? item.qualifier ?? '' : '')
  const [magnitude, setMagnitude] = React.useState(entry.kind === 'tolerance' ? String(item.magnitude) : '')
  const [datums, setDatums] = React.useState(entry.kind === 'tolerance' ? datumSystemText(item.datumSystem) : '')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string>()
  const planeMode = item.display?.plane?.mode ?? (item.display ? 'screen' : 'auto')

  React.useEffect(() => {
    setTolText(entry.kind === 'dimension' ? toleranceText(item) : '')
    setQualifier(entry.kind === 'dimension' ? item.qualifier ?? '' : '')
    setMagnitude(entry.kind === 'tolerance' ? String(item.magnitude) : '')
    setDatums(entry.kind === 'tolerance' ? datumSystemText(item.datumSystem) : '')
    setError(undefined)
  }, [item.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (func: string, args: any, after?: () => void) => {
    setBusy(true)
    setError(undefined)
    try {
      await pmiCommand(drawingId, func, args)
      after?.()
    } catch (e: any) {
      setError(errorText(e, 'The change failed.'))
    } finally {
      setBusy(false)
    }
  }

  const save = () => {
    if (entry.kind === 'dimension') {
      const tol = qualifier === 'basic' ? {} : parseTolerance(tolText)
      if (tol.error) return setError(tol.error)
      const args: any = { id: item.id, qualifier }
      if (tol.value !== undefined) args.tolerance = tol.value
      run('updateDimension', args)
    } else if (entry.kind === 'tolerance') {
      const m = parseFloat(magnitude.replace(',', '.'))
      if (!(m > 0)) return setError('Enter the tolerance value, e.g. 0.05.')
      const args: any = { id: item.id, magnitude: m }
      if (!FORM_TYPES.includes(item.type)) args.datumSystem = datums.trim().toUpperCase()
      run('updateGeometricTolerance', args)
    }
  }

  return (
    <div
      data-pmi-edit={item.id}
      style={{ display: 'grid', gap: 6, padding: 6, marginTop: 6, border: `1px solid ${colors.line}`, borderRadius: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontWeight: 600 }}>{item.name}</span>
        <span style={{ flex: 1 }} />
        <ThemedButton
          disabled={busy}
          onClick={() => run('delete', { id: item.id }, () => setPmiState(drawingId, { selected: null, hovered: null }))}>
          Delete
        </ThemedButton>
      </div>
      {entry.kind === 'dimension' && (
        <Row label="Tolerance">
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              aria-label="Tolerance"
              placeholder="0.1, +0.1/-0.05, H7"
              value={tolText}
              disabled={qualifier === 'basic'}
              onChange={e => setTolText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && save()}
              style={{ ...field, flex: 1 }}
            />
            <select aria-label="Qualifier" value={qualifier} onChange={e => setQualifier(e.target.value)} style={field}>
              <option value="">toleranced</option>
              <option value="basic">basic</option>
              <option value="reference">reference</option>
            </select>
          </div>
        </Row>
      )}
      {entry.kind === 'tolerance' && (
        <>
          <Row label="Value">
            <input
              aria-label="Tolerance value"
              value={magnitude}
              onChange={e => setMagnitude(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && save()}
              style={field}
            />
          </Row>
          {!FORM_TYPES.includes(item.type) && (
            <Row label="Datums">
              <input
                aria-label="Datum system"
                value={datums}
                onChange={e => setDatums(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && save()}
                style={field}
              />
            </Row>
          )}
        </>
      )}
      <Row label="Plane">
        <select
          aria-label="Annotation plane"
          value={planeMode}
          disabled={busy}
          onChange={e => run('setPlacement', { id: item.id, plane: e.target.value })}
          style={field}>
          <option value="auto">Automatic</option>
          <option value="XY">XY plane</option>
          <option value="XZ">XZ plane</option>
          <option value="YZ">YZ plane</option>
          <option value="screen">Facing the viewer</option>
        </select>
      </Row>
      {error && <ErrorLine text={error} />}
      {entry.kind !== 'datum' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <ThemedButton primary disabled={busy} onClick={save}>
            {busy ? 'Saving ...' : 'Save'}
          </ThemedButton>
        </div>
      )}
    </div>
  )
}
