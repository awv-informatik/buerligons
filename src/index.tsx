import '@buerli.io/react/build/middleware/batchedUpdates'
import 'antd/dist/antd.less'
import React from 'react'
import ReactDOM from 'react-dom'
import App from './App'
import initBuerli from './initBuerli'
import Global from './styles/Global'

initBuerli()

ReactDOM.render(
  <>
    <Global />
    <App />
  </>,
  document.getElementById('root'),
)
