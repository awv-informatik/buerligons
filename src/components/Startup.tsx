import { useBuerli } from '@buerli.io/react'
import React from 'react'
import { useIPC } from '../ipc'
import { ChooseCCApp } from './ChooseCCApp'
import { WelcomePage } from './WelcomePage'
import { Buerligons } from './Buerligons'

export const Startup: React.FC = () => {
  const count = useBuerli(s => s.drawing.ids.length)
  const drawingId = useBuerli(s => s.drawing.active || '')
  const ipc = useIPC()
  React.useEffect(() => void (document.title = 'buerligons'), [])
  return (
    <div style={{ backgroundColor: '#fff', height: '100%', width: '100%' }}>
      {ipc.isEmbeddedApp && !ipc.hasClassFile ? (
        <ChooseCCApp />
      ) : count === 0 || !drawingId ? (
        <WelcomePage />
      ) : (
        <Buerligons />
      )}
    </div>
  )
}
