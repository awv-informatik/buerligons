import { DrawingID } from '@buerli.io/core'
import { useDrawing } from '@buerli.io/react'

/**
 * Adds an absolute positioned div with a high z-Index to block
 * user inputs if the CAD-Server is not connected anymore.
 */
export const Disconnected = ({ drawingId }: { drawingId: DrawingID }) => {
  // TODO: styling
  // TODO: keep it hidden right after buerli drawing creation?
  // TODO: handle and display connection retries right here instead of `initBuerli`?
  const isConnected = useDrawing(drawingId, d => d.cad.connected)
  return isConnected ? null : (
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
      <div>Please check your network</div>
    </div>
  )
}
