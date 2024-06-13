import React from 'react'

import { DrawingID } from '@buerli.io/core'
import { useDrawing } from '@buerli.io/react'
import { CSysDisplay, CSysDisplayMode } from '@buerli.io/react-cad'

const pluginBlacklist = ['Fastened Origin', 'Fastened', 'Slider', 'Revolute', 'Cylindrical', 'Planar', 'Parallel', 'LinearPattern', 'CircularPattern']

export const GlobalCSysDisplay: React.FC<{ drawingId: DrawingID }> = ({ drawingId }) => {
  const activePluginId = useDrawing(drawingId, drawing => drawing.plugin.active.feature)
  const activePluginName = useDrawing(drawingId, drawing => drawing.plugin.refs[activePluginId || -1]?.name)

  const isDisplayed = !activePluginName || !pluginBlacklist.some(plugin => activePluginName === plugin)

  return isDisplayed ? <CSysDisplay drawingId={drawingId} displayMode={CSysDisplayMode.DisplayVisible} /> : null
}
