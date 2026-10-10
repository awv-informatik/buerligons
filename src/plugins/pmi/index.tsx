import { DrawingID, Plugin, PluginID } from '@buerli.io/core'
import { useRCadTheme } from '@buerli.io/react-cad'
import React from 'react'
import { PmiIssueList, PmiTable } from './PmiPanel'
import { usePmiValidation } from './usePmiValidation'
import { DesignDimensionList } from './PmiPromote'
import { PmiCreateForm, PmiItemEditor } from './PmiCreate'
import { entriesOf } from './format'
import { PmiAnnotations } from './PmiView'
import { pmiCommand, setPmiState, usePmiState } from './store'
import { PMI_PLUGIN_NAME } from './types'
import { usePmiDocument } from './usePmiDocument'

// GD&T / PMI: display of the semantic PMI of the current part (Phase 4a), placement of its labels and promotion of
// design dimensions (Phase 4b).
//
// The reusable parts are plain components, a hook and a store, independent of the plugin system:
//   usePmiDocument(drawingId)    the PMI document of the current part, kept up to date
//   <PmiAnnotations ... />       datum symbols, dimensions, feature control frames (inside the r3f Canvas)
//   <PmiTable ... />             the inspection table (any DOM panel)
//   <DesignDimensionList ... />  sketch and feature dimensions with "Tolerance ..." (any DOM panel)
//   <PmiCreateForm ... />        datum / dimension / tolerance on picked faces (startPmiCreate opens it)
//   <PmiItemEditor ... />        edit or delete one item
//   <PmiLayer drawingId />       PmiAnnotations wired to the store: mount it once in the app's canvas
//   usePmiState / setPmiState    document, visibility, hover and selection per drawing
// A customer app mounts them where it likes. The global plugin below is only Buerligons' window for the table:
// a global plugin's View renders only while its window is open, so the annotations live in PmiLayer instead.

type Props = { drawingId: DrawingID; pluginId: PluginID }

/** Loads the PMI document of the current part and draws its annotations. Mount once inside the app's Canvas. */
export const PmiLayer: React.FC<{ drawingId: DrawingID }> = ({ drawingId }) => {
  const state = usePmiState(drawingId)
  const { doc, error } = usePmiDocument(drawingId, undefined, state.revision)
  React.useEffect(() => setPmiState(drawingId, { doc, error }), [drawingId, doc, error])
  return (
    <PmiAnnotations
      drawingId={drawingId}
      doc={state.doc}
      show={state.showAnnotations}
      active={state.hovered ?? state.selected}
      onHover={id => setPmiState(drawingId, { hovered: id })}
      onSelect={id => setPmiState(drawingId, { selected: id })}
      onMove={(id, p) => {
        pmiCommand(drawingId, 'setPlacement', { id, textPosition: [p.x, p.y, p.z] }).catch(console.warn)
      }}
      inPlanes={state.inPlanes ?? true}
    />
  )
}

/** The window of the plugin: show/hide the annotations and the inspection table. */
const PmiPluginRoot: React.FC<Props> = ({ drawingId }) => {
  const state = usePmiState(drawingId)
  const colors = useRCadTheme()
  const validation = usePmiValidation(drawingId, state.doc)
  const [showIssues, setShowIssues] = React.useState(false)
  const selectedEntry = React.useMemo(
    () => entriesOf(state.doc).find(e => e.item.id === state.selected),
    [state.doc, state.selected],
  )
  return (
    <div style={{ width: '100%', color: colors.ink, font: '12px "Segoe UI", Arial, sans-serif' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', margin: '2px 0 6px' }}>
        <input
          type="checkbox"
          checked={state.showAnnotations}
          onChange={e => setPmiState(drawingId, { showAnnotations: e.target.checked })}
        />
        Show annotations
        <input
          type="checkbox"
          style={{ marginLeft: 10 }}
          checked={state.inPlanes ?? true}
          disabled={!state.showAnnotations}
          onChange={e => setPmiState(drawingId, { inPlanes: e.target.checked })}
        />
        In planes
        <span style={{ flex: 1 }} />
        {state.doc && <span style={{ color: colors.dim }}>{state.doc.standard}</span>}
      </label>
      <PmiCreateForm drawingId={drawingId} doc={state.doc} />
      <div style={{ color: colors.dim, margin: '4px 0' }}>Inspection table</div>
      <PmiTable
        doc={state.doc}
        error={state.error}
        active={state.hovered}
        selected={state.selected}
        onHover={id => setPmiState(drawingId, { hovered: id })}
        onSelect={id => setPmiState(drawingId, { selected: id })}
        issues={validation.byItem}
      />
      {validation.issues.length > 0 && (
        <div style={{ margin: '6px 0' }}>
          <a onClick={() => setShowIssues(!showIssues)} data-pmi-issues-toggle>
            {showIssues ? '\u25BE' : '\u25B8'} Checks: {validation.errors} errors, {validation.warnings} warnings
          </a>
          {showIssues && (
            <div style={{ marginTop: 4 }}>
              <PmiIssueList
                validation={validation}
                onSelect={id => setPmiState(drawingId, { selected: id, editFocus: null })}
                onFix={i => setPmiState(drawingId, { selected: i.id ?? null, editFocus: 'datum' })}
              />
            </div>
          )}
        </div>
      )}
      {selectedEntry && (
        <PmiItemEditor
          key={selectedEntry.item.id}
          drawingId={drawingId}
          entry={selectedEntry}
          doc={state.doc}
          focusDatum={state.editFocus === 'datum'}
        />
      )}
      <div style={{ color: colors.dim, margin: '10px 0 4px' }}>Design dimensions</div>
      <DesignDimensionList drawingId={drawingId} />
    </div>
  )
}

export const Pmi: Plugin = {
  Root: (props: Props) => React.createElement(PmiPluginRoot, props),
  description: {
    name: PMI_PLUGIN_NAME,
    version: '0.1.0',
    author: 'AWV Informatik',
    persistent: true,
    global: true,
  },
}

export { PmiAnnotations, PmiAnnotation, PmiFeatureHighlight } from './PmiView'
export { PmiTable, PmiIssueList } from './PmiPanel'
export { usePmiValidation } from './usePmiValidation'
export type { PmiIssue, PmiValidation } from './usePmiValidation'
export { DesignDimensionList, useDesignDimensions, parseTolerance } from './PmiPromote'
export { ToleranceEditor, toleranceArgs, toleranceFromText, toleranceOf, emptyTolerance } from './PmiTolerance'
export type { ToleranceState, ToleranceType } from './PmiTolerance'
export { PmiCreateForm, PmiItemEditor, proposeDimension, proposeTolerance } from './PmiCreate'
export { pickedFaces, faceSurface } from './selection'
export { hasPmi, stepExportOptions } from './step'
export type { PmiPick } from './selection'
export { usePmiDocument, usePmiSetId } from './usePmiDocument'
export {
  usePmiState,
  setPmiState,
  usePmiStore,
  pmiCommand,
  openPmiWindow,
  promoteDesignDimension,
  startPmiCreate,
} from './store'
export * from './types'
