import 'antd/dist/antd.less'
import './ipc'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { initBuerli } from './initBuerli'
import { Global } from './styles/Global'

initBuerli()

const container = document.getElementById('root')
const root = createRoot(container!)

root.render(
  <>
    <Global />
    <App />
  </>
)
