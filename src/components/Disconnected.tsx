import { DrawingID } from '@buerli.io/core'
import { useDrawing } from '@buerli.io/react'
import React from 'react'
import styled from 'styled-components'

/**
 * Lies over the whole app, and takes its input, while the engine cannot be reached: a scrim, and
 * one card that says so.
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
    <Scrim className="rcad" role="alert" aria-live="assertive">
      <Card>
        <Kicker>
          <i aria-hidden="true" /> Disconnected
        </Kicker>
        <p>The engine cannot be reached. Check your network: the app is trying to connect again.</p>
      </Card>
    </Scrim>
  )
}

const Scrim = styled.div`
  position: absolute;
  inset: 0;
  z-index: 100000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: color-mix(in srgb, var(--rcad-viewport) 72%, transparent);
  backdrop-filter: blur(2px);
`

const Card = styled.div`
  width: min(360px, 100%);
  padding: 16px 18px 18px;
  border-radius: var(--rcad-r-window);
  background: var(--rcad-toast-bg);
  box-shadow: var(--rcad-shadow-lg);
  color: var(--rcad-toast-text);

  p {
    margin: 10px 0 0;
    font: 500 12px/1.55 var(--rcad-font-mono);
  }
`

const Kicker = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--rcad-toast-strong);
  font: 600 10.5px/1 var(--rcad-font-mono);
  letter-spacing: 0.14em;
  text-transform: uppercase;

  /* orange is for work under way */
  i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--rcad-orange);
    animation: buerligons-wait 1.2s ease-in-out infinite alternate;
  }
  @keyframes buerligons-wait {
    to {
      opacity: 0.25;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    i {
      animation: none;
    }
  }
`
