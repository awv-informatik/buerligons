import React from 'react'
import Layout from '@theme/Layout'
import { Section } from '@site/src/components/section'

import { ccAPI } from '@buerli.io/classcad'
import { Readfile } from '@buerli.io/react-cad'
import { Dropdown } from 'antd'
import 'antd/dist/antd.css'
import { BorderOutlined, BuildOutlined, FileAddOutlined, GiftOutlined } from '@ant-design/icons'
import { FiDisc, FiGitMerge, FiLayers, FiZap, FiPackage } from 'react-icons/fi'
//import DemoPart from '@site/src/components/buerligons/resources/as1_ac_214.stp?url'
//console.log('DemoPart', DemoPart)

import { initBuerli } from '@site/src/components/buerligons/initBuerli'

initBuerli()

export default function App() {
  return (
    <Layout title="ClassCAD" description="ClassCAD is a modern, API-driven CAD system that runs everywhere.">
      <div className="h-full w-full flex flex-col justify-start">
        <div className="relative top-12 w-full h-hull flex overflow-hidden justify-start flex-1 flex-wrap">
          <div className="flex w-10 h-2 flex-1 basis-10" />
          <div className="relative h-full w-5xl px-8 overflow-hidden flex flex-col min-w-3xs">
            <h2
              className="absolute mb-2 font-extrabold text-4xl md:text-6xl lg:text-8xl"
              style={{ textShadow: '0 0 1.5em white, 0 0 1.5em white' }}>
              BUERLI <br /> <span style={{ paddingLeft: '1.3em' }}>GONS</span>
              <span style={{ position: 'relative', display: 'inline-block', top: '0.3em', fontWeight: 200 }}>+</span>              
            </h2>
            <video className="flex-1 min-h-64 mt-26 ml-0 lg:ml-26 mb-0 lg:mb-6 object-contain" autoPlay muted loop>
              <source src="1728647677004558.mp4" type="video/mp4" />
            </video>
            <div className="h-auto flex flex-row overflow-hidden gap-10 pl-0 lg:pl-26 pb-20">
              <div className="mt-6 mb-6 w-3xl text-justify text-base/6 text-gray-600">
                <Buerligons />
              </div>
            </div>
          </div>
          <div className="flex w-10 h-2 flex-1 basis-10" />
        </div>
      </div>
    </Layout>
  )
}

function Buerligons() {
  const rfRef = React.useRef(null)

  const createPart = React.useCallback(async () => {
    const newDrawingId = await ccAPI.base.createCCDrawing()
    newDrawingId && (await ccAPI.feature.newPart(newDrawingId, 'Part').catch(console.info))
  }, [])

  const createAssembly = React.useCallback(async () => {
    const newDrawingId = await ccAPI.base.createCCDrawing()
    newDrawingId && (await ccAPI.assemblyBuilder.createRootAssembly(newDrawingId, 'New Assembly').catch(console.info))
  }, [])

  React.useEffect(() => {
    async function run() {
      const query = new URLSearchParams(window.location.search)
      const file = query.get('file')
      if (file) {
        const newDrawingId = await ccAPI.base.createCCDrawing()
        if (newDrawingId) {
          const type = file.substring(file.lastIndexOf('.') + 1, file.length)
          const content = await (await fetch(file)).arrayBuffer()
          await ccAPI.baseModeler.load(newDrawingId, content, type).catch(console.info)
        }
      }
    }
    run()
  }, [])

  const createNewProps = {
    items: [
      { label: 'Part', key: 'Part', icon: <BorderOutlined /> },
      { label: 'Assembly', key: 'Assembly', icon: <BuildOutlined /> },
    ],
    onClick: e => {
      if (e.key === 'Part') createPart()
      else createAssembly()
    },
  }

  const openProps = {
    items: [
      { label: 'Demo', key: 'Demo', icon: <GiftOutlined /> },
      { label: 'File ...', key: 'File', icon: <FileAddOutlined /> },
    ],
    onClick: async e => {
      if (e.key === 'Demo') {
        const newDrawingId = await ccAPI.base.createCCDrawing()
        if (newDrawingId) {
          const type = DemoPart.substring(DemoPart.lastIndexOf('.') + 1, DemoPart.length)
          const content = await (await fetch(DemoPart)).arrayBuffer()
          await ccAPI.baseModeler.load(newDrawingId, content, type).catch(console.info)
        }
      } else rfRef.current.click()
    },
  }

  return <button onClick={() => createNewProps.onClick({ key: 'Part' })}>Create new</button>
}
