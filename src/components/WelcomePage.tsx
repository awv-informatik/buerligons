import React from 'react'
import { ccAPI } from '@buerli.io/classcad'
import { Readfile } from '@buerli.io/react-cad'
import styled from 'styled-components'
import { Dropdown, MenuProps } from 'antd'
import 'antd/dist/antd.css'
import { AppstoreOutlined, FileOutlined } from '@ant-design/icons'

export function WelcomePage() {
  const rfRef = React.useRef<HTMLInputElement>()

  const createPart = React.useCallback(async () => {
    const newDrawingId = await ccAPI.base.createCCDrawing()
    newDrawingId && (await ccAPI.feature.newPart(newDrawingId, 'Part').catch(console.info))
  }, [])

  const createAssembly = React.useCallback(async () => {
    const newDrawingId = await ccAPI.base.createCCDrawing()
    newDrawingId && (await ccAPI.assemblyBuilder.createRootAssembly(newDrawingId, 'New Assembly').catch(console.info))
  }, [])

  const openFile = React.useCallback(() => {
    rfRef.current && rfRef.current.click()
  }, [])

  const onClick = React.useCallback(
    (e: { key: string }) => {
      if (e.key === 'Part') {
        createPart()
      } else {
        createAssembly()
      }
    },
    [createPart, createAssembly],
  )

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
    { name: 'Buerli', url: 'https://buerli.io/' },
    { name: 'ClassCAD', url: 'http://classcad.ch/' },
  ]

  const menuItems: MenuProps['items'] = [
    { label: 'Part', key: 'Part', icon: <FileOutlined /> },
    { label: 'Assembly', key: 'Assembly', icon: <AppstoreOutlined /> },
  ]

  const menuProps = { items: menuItems, onClick }

  return (
    <AppWrapper>
      <HeaderWrapper>
        <CompanyName>
          <img style={{ position: 'relative', top: -2.5 }} height="26" src="favicon.svg" alt="AWV Informatik AG" />
          <SocialLink href="https://awv-informatik.ch/">
            AWV —<br /> Informatik AG
          </SocialLink>
        </CompanyName>
        <Spacer />
        <Spacer />
        {socialLinks.map(({ name, url }) => (
          <SocialLink key={name} href={url}>
            {name}<br />&nbsp;
          </SocialLink>
        ))}
      </HeaderWrapper>
      <MainWrapper>
        <Sidebar />
        <ContentArea>
          <ProductTitle>
            BUERLI <br /> <span style={{ paddingLeft: "1.3em" }}>GONS</span> <br />{' '}
            <span style={{ fontWeight: 400 }}>CLOUD</span>
            <span style={{ position: 'relative', display: 'inline-block', top: "0.3em", fontWeight: 200 }}>+</span>
            <span style={{ fontWeight: 400 }}>CAD</span>
          </ProductTitle>
          <ProductVideo autoPlay muted loop>
            <source src="1728647677004558.mp4" type="video/mp4" />
          </ProductVideo>
          <ProductWrapper>
            <ProductDescription>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Introducing Buerligons, our user-friendly
              interactive, nurbs-based <i>CAD system</i> that runs anywhere. Easily create, constrain and modify 3D
              solids and 2D sketches; manage parts and assemblies.
            </ProductDescription>
            <ButtonGroup>
              <Dropdown menu={menuProps}>
                <ActionButton>Create New ...</ActionButton>
              </Dropdown>
              <ActionButton onClick={openFile}>Open Part</ActionButton>
              <Readfile ref={rfRef} singleDrawingApp />
            </ButtonGroup>
          </ProductWrapper>
        </ContentArea>
        <Sidebar />
      </MainWrapper>
      <Footer>
        <FooterLeft>
          {productLinks.map(({ name, url }) => (
            <SocialLink key={name} href={url}>
              &nbsp;
              <br />
              {name}
            </SocialLink>
          ))}
        </FooterLeft>
        <FooterRight>
          <CompanyName style={{ textAlign: 'right' }}>
            © 2024
            <br />
            All rights reserved
          </CompanyName>
        </FooterRight>
      </Footer>
    </AppWrapper>
  )
}

const Spacer = styled.div`
  flex: 1;
`

const HeaderWrapper = styled.header`
  display: flex;
  min-height: 120px;
  width: 100%;
  overflow: hidden;
  padding: 0 100px;
  gap: 20px;
  @media (max-width: 991px) {
    max-width: 100%;
    padding: 0 20px;
    gap: 10px;
  }
`

const SocialLink = styled.a`
  color: #000;
  text-decoration: none;
  font:
    400 14px/1.3em Inter,
    sans-serif;
  margin: auto 0;
`

const Footer = styled.footer`
  display: flex;
  flex-direction: row;
  min-height: 120px;
  width: 100%;
  align-items: center;
  overflow: hidden;
  justify-content: flex-end;
  flex-wrap: wrap;
  @media (max-width: 991px) {
    max-width: 100%;
    padding: 0 20px;
  }
`

const FooterRight = styled.div`
  flex: 1;
  display: flex;
  min-height: 100px;
  align-items: center;
  gap: 20px;
  overflow: hidden;
  justify-content: flex-end;
  padding-right: 100px;
  @media (max-width: 991px) {
    max-width: 100%;
    padding: 0;
  }
`

const FooterLeft = styled.div`
  flex: 1;
  display: flex;
  min-height: 100px;
  align-items: center;
  gap: 20px;
  overflow: hidden;
  justify-content: flex-start;

  padding-left: 100px;
  @media (max-width: 991px) {
    max-width: 100%;
    padding: 0;
  }
`

const ProductTitle = styled.h2`
  position: absolute;
  color: #000;
  letter-spacing: -0.03em;
  text-shadow:
    0 0 1em white,
    0 0 1em white;
  font:
    600 90px/85px Inter,
    sans-serif;
  @media (max-width: 991px) {
    max-width: 100%;
    font-size: 40px;
    line-height: 40px;
  }
`

const ProductVideo = styled.video`
  flex: 1;
  min-height: 200px;  
  margin: 100px 0 0 100px;
  object-fit: contain;
  @media (max-width: 991px) {
    margin: 100px 0 0 0;
    height: calc(50vh - 150px);
    object-fit: cover;
  }
`

const ProductDescription = styled.p`
  color: #000;
  font:
    400 14px/1.3em Inter,
    sans-serif;
  width: 350px;
  margin-top: 15px;
  text-align: justify;
`

const ProductWrapper = styled.div`
  height: auto;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  gap: 40px;
  padding: 0 0 0 100px;
  @media (max-width: 991px) {
    padding-left: 0px;
  }
  @media (max-width: 500px) {
    max-width: 100%;
    padding-left: 20px;
    display: none;
  }
`

const ButtonGroup = styled.div`
  display: flex;
  height: 40px;
  gap: 10px;
  margin-top: 15px;
  @media (max-width: 600px) {
    flex-direction: column;
  }
`

const ActionButton = styled.button`
  word-wrap: nowrap;
  white-space: nowrap;
  border-radius: 5px;
  background-color: black;
  padding: 11px 25px;
  color: white;
  min-width: 140px;
  font:
    400 14px Inter,
    sans-serif;
  border: none;
  cursor: pointer;
  @media (max-width: 991px) {
    padding: 11px 20px;
  }
`

const MainWrapper = styled.main`
  display: flex;
  width: 100%;
  overflow: hidden;
  justify-content: flex-start;
  flex: 1;
  flex-wrap: wrap;
  height: 100%;
  @media (max-width: 991px) {
    max-width: 100%;
  }
`

const Sidebar = styled.aside`
  display: flex;
  width: 10px;
  height: 10px;
  flex: 1;
  flex-basis: 64px;
`

const ContentArea = styled.section`
  height: 100%;
  display: flex;
  min-width: 240px;
  flex-direction: column;
  overflow: hidden;
  width: 1024px;
  padding: 0 20px 0 60px;
  @media (max-width: 991px) {
    max-width: 100%;
    padding-left: 20px;
  }
`

const AppWrapper = styled.div`
  height: 100%;
  background-color: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  justify-content: flex-start;
`

const CompanyName = styled.span`
  display: flex;
  gap: 15px;
  color: #000;
  font:
    400 14px/1.3em Inter,
    sans-serif;
  margin: auto 0;
`
