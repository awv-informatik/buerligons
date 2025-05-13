import React, { useEffect } from 'react'
import { Buerligons } from '@site/src/components/buerligons/Buerligons'
import { initBuerli } from '@site/src/components/buerligons/initBuerli'

initBuerli()

export default function App() {
  useEffect(() => {
    // get reference to first tab
    const parent_window = window.opener
    if (parent_window) {
      console.log('parent_window', window.cadFile)
    }
  }, [])
  return <Buerligons />
}
