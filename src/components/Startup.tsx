import { useBuerli } from '@buerli.io/react'
import React from 'react'
import { Buerligons } from './Buerligons'
import { WelcomePage } from './WelcomePage'

export const Startup: React.FC = () => {
  const count = useBuerli(s => s.drawing.ids.length)
  const drawingId = useBuerli(s => s.drawing.active || '')
  React.useEffect(() => void (document.title = 'buerligons'), [])
  return (
    <div style={{ backgroundColor: '#fff', height: '100%', width: '100%' }}>
      {count === 0 || !drawingId ? <WelcomePage /> : <Buerligons />}
    </div>
  )
}
