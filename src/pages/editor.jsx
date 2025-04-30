import React from 'react'
import { Buerligons } from '@site/src/components/buerligons/Buerligons'
import { initBuerli } from '@site/src/components/buerligons/initBuerli'

initBuerli()

export default function App() {
  return <Buerligons />
}
