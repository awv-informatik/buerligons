import { DrawingID, Plugin, PluginID } from '@buerli.io/core'
import { useRCadTheme } from '@buerli.io/react-cad'
import React from 'react'
import { PmiTable } from './PmiPanel'
import { PmiAnnotations } from './PmiView'
import { setPmiState, usePmiState } from './store'
import { usePmiDocument } from './usePmiDocument'

// GD&T / PMI, Phase 4a ("see and check"): read-only display of the semantic PMI of the current part.
//
// The reusable parts are plain components, a hook and a store, independent of the plugin system:
//   usePmiDocument(drawingId)    the PMI document of the current part, kept up to date
//   <PmiAnnotations ... />       datum symbols, dimensions, feature control frames (inside the r3f Canvas)
//   <PmiTable ... />             the inspection table (any DOM panel)
//   <PmiLayer drawingId />       PmiAnnotations wired to the store: mount it once in the app's canvas
//   usePmiState / setPmiState    document, visibility, hover and selection per drawing
// A customer app mounts them where it likes. The global plugin below is only Buerligons' window for the table:
// a global plugin's View renders only while its window is open, so the annotations live in PmiLayer instead.

export const PMI_PLUGIN_NAME = 'GD&T'

type Props = { drawingId: DrawingID; pluginId: PluginID }

/** Loads the PMI document of the current part and draws its annotations. Mount once inside the app's Canvas. */
export const PmiLayer: React.FC<{ drawingId: DrawingID }> = ({ drawingId }) => {
  const { doc, error } = usePmiDocument(drawingId)
  React.useEffect(() => setPmiState(drawingId, { doc, error }), [drawingId, doc, error])
  const state = usePmiState(drawingId)
  return (
    <PmiAnnotations
      drawingId={drawingId}
      doc={state.doc}
      show={state.showAnnotations}
      active={state.hovered ?? state.selected}
      onHover={id => setPmiState(drawingId, { hovered: id })}
      onSelect={id => setPmiState(drawingId, { selected: id })}
    />
  )
}

/** The window of the plugin: show/hide the annotations and the inspection table. */
const PmiPluginRoot: React.FC<Props> = ({ drawingId }) => {
  const state = usePmiState(drawingId)
  const colors = useRCadTheme()
  return (
    <div style={{ width: '100%', color: colors.ink, font: '12px "Segoe UI", Arial, sans-serif' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', margin: '2px 0 6px' }}>
        <input
          type="checkbox"
          checked={state.showAnnotations}
          onChange={e => setPmiState(drawingId, { showAnnotations: e.target.checked })}
        />
        Show annotations
        <span style={{ flex: 1 }} />
        {state.doc && <span style={{ color: colors.dim }}>{state.doc.standard}</span>}
      </label>
      <PmiTable
        doc={state.doc}
        error={state.error}
        active={state.hovered}
        selected={state.selected}
        onHover={id => setPmiState(drawingId, { hovered: id })}
        onSelect={id => setPmiState(drawingId, { selected: id })}
      />
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
export { PmiTable } from './PmiPanel'
export { usePmiDocument, usePmiSetId } from './usePmiDocument'
export { usePmiState, setPmiState, usePmiStore } from './store'
export * from './types'
