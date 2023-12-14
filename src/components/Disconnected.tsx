import { DrawingID } from '@buerli.io/core'
import { useDrawing } from '@buerli.io/react'
import React from 'react'

/**
 * Adds an absolute positioned div with a high z-Index to block
 * user inputs if the CAD-Server is not connected anymore.
 */
export const Disconnected = ({ drawingId }: { drawingId: DrawingID }) => {
  const isActive = useDrawing(drawingId, d => d.cad.connection.active)
  const isConnected = useDrawing(drawingId, d => d.cad.connection.connected)
  if (isConnected) {
    return null
  }
  if (!isActive) {
    return null
  }
  return (
    <div
      style={{
        display: 'grid',
        width: '100%',
        height: '100%',
        position: 'absolute',
        left: 0,
        top: 0,
        zIndex: 100000,
        background: 'rgba(0,0,0,0.6)',
        color: 'white',
        alignContent: 'center',
        textAlign: 'center',
      }}>
      <div style={{ fontSize: '48px' }}>DISCONNECTED</div>
      <div>Please check your network. Trying to re-connect...</div>
    </div>
  )
}
