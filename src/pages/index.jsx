import React from 'react'
import Layout from '@theme/Layout'
import { Section } from '@site/src/components/section'

import { ccAPI } from '@buerli.io/classcad'
import { Readfile } from '@buerli.io/react-cad'
import { Dropdown } from 'antd'
import 'antd/dist/antd.css'
import { BorderOutlined, BuildOutlined, FileAddOutlined, GiftOutlined } from '@ant-design/icons'
import { FiDisc, FiGitMerge, FiLayers, FiZap, FiPackage } from 'react-icons/fi'
import { Pricing } from '@site/src/components/pricing'

import {
  Square3Stack3DIcon,
  DocumentPlusIcon,
  HeartIcon,
  CursorArrowRaysIcon,
  SignalIcon,
  PuzzlePieceIcon,
  RectangleGroupIcon,
  InboxIcon,
  TrashIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'

import { PlusIcon, CheckIcon } from '@heroicons/react/20/solid'

const includedFeatures = [
  'Private forum access',
  'Member resources',
  'Entry to annual conference',
  'Official member t-shirt',
]

const features = [
  {
    name: 'Parts',
    description: `Easily design 3D solids using parametric sketching, extrusion, and revolving. Build with basic shapes and refine them using Boolean operations, slicing, and patterning for precise control.`,
    href: '#',
    icon: PuzzlePieceIcon,
  },
  {
    name: 'Assemblies',
    description: `Our software lets you place part or assembly templates in a 3D scene using 3D constraints or a movement gizmo. Apply standard constraints—like slider, revolute, planar, and parallel—directly to part coordinate systems, and switch between assembly and part modeling with a double-click.`,
    href: '#',
    icon: Square3Stack3DIcon,
  },
  {
    name: 'STEP support',
    description: `Import STEP models (AP203, AP214, AP242) with assembly support on standard and enterprise plans; solids import as flattened. SAT and IGES formats are available on request.`,
    href: '#',
    icon: DocumentPlusIcon,
  },
  {
    name: 'WASM/WebSockets',
    description: `Buerligons runs self-contained in any browser or web app with WASM compatibility—on desktop, native, or mobile. It can also connect remotely via web-sockets for features like state storage and undo-redo.`,
    href: '#',
    icon: SignalIcon,
  },
  {
    name: 'Developed with Buerli and ClassCAD engine',
    description: `Buerligons is our end-user CAD system, built with the Buerli Client Framework and powered by the ClassCAD backend engine. Learn more at Buerli.io and ClassCAD.ch. `,
    href: '#',
    icon: CursorArrowRaysIcon,
  },
  {
    name: 'Open source',
    description: `Buerligons is open source—use it as a standalone app, integrate it into other tools, or customize it as needed. Source code is available on GitHub.`,
    href: '#',
    icon: HeartIcon,
  },
]

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
                {/*<Buerligons />*/}
                <input
                  onChange={e => {
                    const file = e.target.files[0]
                    if (file) {
                      var reader = new FileReader()
                      reader.onload = e => {
                        var contents = e.target.result
                        // Store array buffer in window object
                        console.log('contents', contents)
                        const child_window = window.open('/editor', '_blank' /*'width=800,height=600'*/)
                        if (child_window) {
                          child_window.cadFile = contents
                          child_window.focus()
                        } else {
                          alert('Please allow popups for this website')
                        }
                      }
                      reader.readAsArrayBuffer(file)
                    }
                  }}
                  type="file"
                  id="file-input"
                />
              </div>
            </div>
          </div>
          <div className="flex w-10 h-2 flex-1 basis-10" />
        </div>
      </div>

      <Section id="about">
        <div className="overflow-hidden pt-24 sm:pt-32">
          <div className="mx-auto">
            <div className="max-w-3xl">
              <p className="text-base/7 font-semibold text-red-600">About Buerligons</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight text-pretty text-gray-900 sm:text-5xl">
                One click CAD that runs entirely in the browser.
              </h1>
              <p className="mt-6 text-xl/8 text-balance text-gray-700">
                Introducing Buerligons, our user-friendly interactive CAD frontend developed with Buerli and ClassCAD.
                Easily create, constrain and modify 3D solids and 2D sketches; manage parts and assemblies.
              </p>
            </div>
            <section className="mt-20 grid grid-cols-1 lg:grid-cols-2 lg:gap-x-8 lg:gap-y-16">
              <div className="lg:pr-8">
                <h2 className="text-2xl font-semibold tracking-tight text-pretty text-gray-900">
                  CAD editing for designers
                </h2>
                <p className="mt-6 text-base/7 text-gray-600">
                  Buerligons allows you to create and edit 3D models directly in your browser, without the need for any
                  installation. It is a powerful tool for engineers, designers, and anyone who needs to create 3D models
                  quickly and easily. With Buerligons, you can create complex models in minutes, and share them with
                  colleagues and clients with just a few clicks.
                </p>
                <p className="mt-8 text-base/7 text-gray-600">
                  NURBS based CAD makes it easy to create smooth and accurate curves and surfaces. It also supports a
                  wide range of parametric features, which allow you to create models that can be easily modified. This
                  makes Buerligons an ideal tool for creating 3D models for a wide range of applications, including
                  product design, architecture, and engineering.
                </p>
              </div>
              <div className="pt-16 lg:row-span-2 lg:-mr-16 xl:mr-auto">
                <div className="-mx-8 grid grid-cols-2 gap-4 sm:-mx-16 sm:grid-cols-4 lg:mx-0 lg:grid-cols-2 lg:gap-4 xl:gap-8">
                  <div className="aspect-square overflow-hidden rounded-xl shadow-xl outline-1 -outline-offset-1 outline-black/10">
                    <img alt="" src="10.jpg" className="block size-full object-cover" />
                  </div>
                  <div className="-mt-8 aspect-square overflow-hidden rounded-xl shadow-xl outline-1 -outline-offset-1 outline-black/10 lg:-mt-40">
                    <img alt="" src="4.jpg" className="block size-full object-cover" />
                  </div>
                  <div className="aspect-square overflow-hidden rounded-xl shadow-xl outline-1 -outline-offset-1 outline-black/10">
                    <img alt="" src="8.jpg" className="block size-full object-cover" />
                  </div>
                  <div className="-mt-8 aspect-square overflow-hidden rounded-xl shadow-xl outline-1 -outline-offset-1 outline-black/10 lg:-mt-40">
                    <img alt="" src="6.jpg" className="block size-full object-cover" />
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </Section>

      <Section id="features">
        <div className="bg-white pt-24 sm:pt-32">
          <div className="mx-auto">
            <p className="text-base/7 font-semibold text-red-600">Features</p>
            <div className="mx-auto max-w-2xl lg:mx-0">
              <h2 className="text-4xl font-semibold tracking-tight text-pretty text-gray-900 sm:text-5xl">
                Packed with features
              </h2>
              <p className="mt-6 text-lg/8 text-gray-600">
                Buerligons has been designed to be easy to use, with a simple and intuitive interface. It is also packed
                with features that make it a powerful tool for creating 3D models.
              </p>
            </div>
            <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
              <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
                {features.map(feature => (
                  <div key={feature.name} className="flex flex-col">
                    <dt className="text-base/7 font-semibold text-gray-900">
                      <div className="mb-6 flex size-10 items-center justify-center rounded-lg bg-red-600">
                        <feature.icon aria-hidden="true" className="size-6 text-white" />
                      </div>
                      {feature.name}
                    </dt>
                    <dd className="mt-1 flex flex-auto flex-col text-base/7 text-gray-600">
                      <p className="flex-auto">{feature.description}</p>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </Section>

      <Section id="pricing">
        <Pricing />
      </Section>

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
