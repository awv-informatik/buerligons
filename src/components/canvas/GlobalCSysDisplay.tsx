import React from 'react'

import { DrawingID } from '@buerli.io/core'
import { useDrawing } from '@buerli.io/react'
import { CSysDisplay, CSysDisplayMode } from '@buerli.io/react-cad'

const pluginBlacklist = ['Fastened Origin', 'Fastened', 'Slider', 'Revolute', 'Cylindrical', 'Planar', 'Parallel', 'LinearPattern', 'CircularPattern']

export const GlobalCSysDisplay: React.FC<{ drawingId: DrawingID }> = ({ drawingId }) => {
  const curInstanceExists = useDrawing(drawingId, d => Boolean(d.structure.currentInstance)) || false
  const activePluginId = useDrawing(drawingId, d => d.plugin.active.feature)
  const activePluginName = useDrawing(drawingId, d => d.plugin.refs[activePluginId || -1]?.name)

  const isDisplayed = curInstanceExists && (!activePluginName || !pluginBlacklist.some(plugin => activePluginName === plugin))

  return isDisplayed ? <CSysDisplay drawingId={drawingId} displayMode={CSysDisplayMode.DisplayVisible} /> : null
}
