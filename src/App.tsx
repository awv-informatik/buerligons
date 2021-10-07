import { useBuerli } from '@buerli.io/react'
import { Drawing } from '@buerli.io/react-cad'
import 'antd/dist/antd.css'
import React from 'react'
import { FileMenu } from './components/FileMenu'
import { WelcomePage } from './components/WelcomePage'

export const App: React.FC = () => {
  const count = useBuerli(s => s.drawing.ids.length)
  const drawingId = useBuerli(s => s.drawing.ids[0])
  return count === 0 ? <WelcomePage /> : <Drawing drawingId={drawingId} Menu={<FileMenu drawingId={drawingId} />} />
}

export default App
