import { useBuerli } from '@buerli.io/react'
import { useRCadThemeMode } from '@buerli.io/react-cad'
import React from 'react'
import { Buerligons } from './Buerligons'
import { WelcomePage } from './WelcomePage'

const startupBg = { light: '#fff', dark: '#1a1a1a' }

export const Startup: React.FC = () => {
  const count = useBuerli(s => s.drawing.ids.length)
  const drawingId = useBuerli(s => s.drawing.active || '')
  const mode = useRCadThemeMode()
  React.useEffect(() => void (document.title = 'buerligons'), [])
  return (
    <div style={{ backgroundColor: startupBg[mode], height: '100%', width: '100%' }}>
      {count === 0 || !drawingId ? <WelcomePage /> : <Buerligons />}
    </div>
  )
}
