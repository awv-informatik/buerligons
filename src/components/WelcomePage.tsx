import React from 'react'
import { ccAPI } from '@buerli.io/classcad'
import { Readfile } from '@buerli.io/react-cad'
import { Dropdown } from 'antd'
import 'antd/dist/antd.css'
import { BorderOutlined, BuildOutlined, FileAddOutlined, GiftOutlined } from '@ant-design/icons'
import { FiDisc, FiGitMerge, FiLayers, FiZap, FiPackage } from 'react-icons/fi'
import DemoPart from '../resources/as1_ac_214.stp?url'
import {
  Hero,
  Header,
  Brand,
  Link,
  Spacer,
  Main,
  Content,
  Sidebar,
  Caption,
  Video,
  Description,
  Button,
  ButtonGroup,
  Footer,
  ProductWrapper,
  Section,
  Grid,
  Feature,
} from './Layout'

export function WelcomePage() {
  const rfRef = React.useRef<HTMLInputElement>(null!)

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
          await ccAPI.baseModeler.load(newDrawingId, content, type as never).catch(console.info)
        }
      }
    }
    run()
  }, [])

  const socialLinks = [
    { name: 'Discord', url: 'https://discord.gg/MEbR7xyPMS' },
    { name: 'Twitter', url: 'https://twitter.com/buerli_io' },
    { name: 'Github', url: 'https://github.com/awv-informatik' },
  ]
  const productLinks = [
    { name: 'Buerli', url: 'https://buerli.io', highlight: false },
    { name: 'Buerligons', url: '#', highlight: true },
    { name: 'ClassCAD', url: 'http://classcad.ch', highlight: false },
  ]

  const createNewProps = {
    items: [
      { label: 'Part', key: 'Part', icon: <BorderOutlined /> },
      { label: 'Assembly', key: 'Assembly', icon: <BuildOutlined /> },
    ],
    onClick: (e: { key: string }) => {
      if (e.key === 'Part') createPart()
      else createAssembly()
    },
  }

  const openProps = {
    items: [
      { label: 'Demo', key: 'Demo', icon: <GiftOutlined /> },
      { label: 'File ...', key: 'File', icon: <FileAddOutlined /> },
    ],
    onClick: async (e: { key: string }) => {
      if (e.key === 'Demo') {
        const newDrawingId = await ccAPI.base.createCCDrawing()
        if (newDrawingId) {
          const type = DemoPart.substring(DemoPart.lastIndexOf('.') + 1, DemoPart.length)
          const content = await (await fetch(DemoPart)).arrayBuffer()
          await ccAPI.baseModeler.load(newDrawingId, content, type as never).catch(console.info)
        }
      } else rfRef.current.click()
    },
  }

  return (
    <>
      <Hero>
        <Header>
          <Brand>
            <img style={{ position: 'relative', top: -2.5 }} height="26" src="favicon.svg" alt="AWV Informatik AG" />
            <Link href="https://awv-informatik.ch/">
              AWV —<br /> Informatik AG
            </Link>
          </Brand>
          <Spacer />
          {/*<Brand style={{ textAlign: 'right' }}>© 2024</Brand>
          <Spacer />*/}
          {socialLinks.map(({ name, url }) => (
            <Link key={name} href={url}>
              {name}
              <br />
              &nbsp;
            </Link>
          ))}
        </Header>
        <Main>
          <Sidebar />
          <Content>
            <Caption floating>
              BUERLI <br /> <span style={{ paddingLeft: '1.3em' }}>GONS</span> <br />{' '}
              <span style={{ fontWeight: 400 }}>CLOUD</span>
              <span style={{ position: 'relative', display: 'inline-block', top: '0.3em', fontWeight: 200 }}>+</span>
              <span style={{ fontWeight: 400 }}>CAD</span>
            </Caption>
            <Video autoPlay muted loop>
              <source src="1728647677004558.mp4" type="video/mp4" />
            </Video>
            <ProductWrapper>
              <Description>
                Introducing Buerligons, our user-friendly interactive, nurbs-based CAD system that runs anywhere. Easily
                create, constrain and modify 3D solids and 2D sketches; manage parts and assemblies.
              </Description>
              <ButtonGroup>
                <Dropdown menu={createNewProps}>
                  <Button>Create New ...</Button>
                </Dropdown>
                <Dropdown menu={openProps}>
                  <Button>Open ...</Button>
                </Dropdown>
                <Readfile ref={rfRef} singleDrawingApp />
              </ButtonGroup>
            </ProductWrapper>
          </Content>
          <Sidebar />
        </Main>
      </Hero>
      <Footer>
        {productLinks.map(({ name, url, highlight }) => (
          <Link key={name} href={url}>
            {highlight ? <i>{name}</i> : name}
          </Link>
        ))}
        <Spacer />+
      </Footer>
      <Section>
        <Sidebar />
        <Content className="margin-top">
          <Caption right>
            PACKED <br />
            <span style={{ fontWeight: 400 }}>WITH</span>
            <span style={{ position: 'relative', display: 'inline-block', top: '0.3em', fontWeight: 200 }}>+</span>
            <span style={{ fontWeight: 400 }}>FEATURES</span>
          </Caption>
          <Grid columns={2} rows={4}>
            <Feature icon={FiDisc} title="Non-manifold solid kernel">
              A NURBS solid modeling kernel includes a powerful set of construction, modification, and evaluation tools
              for curves, surfaces, trimmed surfaces and polygonal solids. It supports topologically based operations
              such as booleans, fillets, offsets, tessellations, deformable modeling, and much more. Note today we use
              only a fraction of the kernel functionality within our Buerli.
            </Feature>
            <Feature icon={FiGitMerge} title="Parts">
              Effortlessly design 3D solids by combining parametric sketching with extruding and revolving techniques.
              Model objects using fundamental shapes—such as boxes, cylinders, cones, and spheres—and refine them
              through Boolean operations, slicing, and patterning tools for precise positioning and manipulation.
            </Feature>
            <Feature icon={FiLayers} title="STEP support">
              Import of Step models (AP203, AP214, AP242). Assembly structures are supported for standard and enterprise
              plans, while solid modeling imports Step flattened. Other formats like SAT or IGES are available on
              request.
            </Feature>
            <Feature icon={FiLayers} title="Assemblies">
              Our software enables the creation and precise positioning of part or assembly template instances within a
              3D scene, using either 3D constraints or the movement gizmo. Standard 3D constraints—including slider,
              revolute, planar, and parallel—can be applied directly to coordinate systems within parts. Users can also
              seamlessly toggle between assembly mode and part modeling by simply double-clicking on parts in the
              assembly tree.
            </Feature>
            <Feature icon={FiZap} title="WASM or WS">
              Buerligons is WASM compatible and can be run self-contained in any browser or web-based application, on
              the desktop, native and mobile. It can also connect to its kernel via remote web-sockets, which enables
              more features, like state storage and undo-redo.
            </Feature>
            <Feature icon={FiPackage} title="Open source">
              We have open sourced Buerligons so that it can either be used as a standalone application or integrated
              into other applications, or even be customized. The source code is available on GitHub.
            </Feature>
          </Grid>
        </Content>
        <Sidebar />
      </Section>
    </>
  )
}
