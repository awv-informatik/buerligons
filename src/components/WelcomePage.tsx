import 'antd/dist/antd.css'

import React from 'react'
import styled from 'styled-components'
import { Button, Space, Modal, Typography } from 'antd'

import { ccAPI } from '@buerli.io/classcad'
import { Readfile } from '@buerli.io/react-cad'
import { AppstoreOutlined, FileOutlined } from '@ant-design/icons'

import pckg from '../../package.json'


const buerliVersion = pckg.dependencies['@buerli.io/react-cad']

const { Text, Title, Paragraph, Link } = Typography

const CreateNew: React.FC = () => {
  const createPart = React.useCallback(async () => {
    const newDrawingId = await ccAPI.base.createCCDrawing()
    newDrawingId && (await ccAPI.feature.newPart(newDrawingId, 'Part').catch(console.info))
  }, [])

  const createAssembly = React.useCallback(async () => {
    const newDrawingId = await ccAPI.base.createCCDrawing()
    newDrawingId && (await ccAPI.assemblyBuilder.createRootAssembly(newDrawingId, 'New Assembly').catch(console.info))
  }, [])

  return (
    <div style={{ display: 'block', height: '3em' }}>
      <CreateNewDiv>
        <span style={{ height: '1em !important', lineHeight: '1em' }}>
          Create New ...
        </span>
          <CreateNewDivOptions>
            <NestedButton
              style={{ width: '50%' }}
              type="primary"
              icon={<FileOutlined />}
              maincolor="rgb(32, 128, 255)"
              onClick={createPart}>
              <span style={{ height: '1em !important', lineHeight: '1em' }}>
                Part
              </span>
            </NestedButton>
            <NestedButton
              style={{ width: '50%' }}
              type="primary"
              icon={<AppstoreOutlined />}
              maincolor="rgb(40, 148, 255)"
              onClick={createAssembly}>
              <span style={{ height: '1em !important', lineHeight: '1em' }}>
                Assembly
              </span>
            </NestedButton>
          </CreateNewDivOptions>
      </CreateNewDiv>
    </div>
  )
}

const InfoItem: React.FC<{ children: React.ReactNode; caption: string }> = ({ caption, children }) => {
  const ref = React.useRef<HTMLElement>(null!)

  const [isOpen, setIsOpen] = React.useState<boolean>(false)
  const onClick = React.useCallback(() => {
    // unfocus the button to prevent weird highlighting
    ref.current.blur()
    setIsOpen(true)
  }, [])
  const onCancel = React.useCallback(() => setIsOpen(false), [])

  return (
    <div style={{ marginRight: '1.5em' }}>
      <InfoButton ref={ref} type="link" onClick={onClick}>
        {caption}
      </InfoButton>
      <Modal title={caption} footer={null} open={isOpen} onCancel={onCancel}>
        {children}
      </Modal>
    </div>
  )
}

const Info: React.FC = () => {
  return (
    <Footer>
      <div style={{ display: 'flex' }}>
        <InfoItem caption="AWV-Informatik">
          <Title level={5}>About</Title>
          <Paragraph>
            AWV Informatik AG is a <Text strong>spin-off company of the University of Applied Sciences </Text>
            &quot;Interstaatliche Hochschule für Technik Buchs&quot;, short: NTB. Based on this heritage,
            the relationship to NTB is very strong and the cooperation between the two partners has always been intense and prolific.
            The first developments, that finally led to the core product <Text strong>ClassCAD</Text>, were already made
            <Text strong> around 1995</Text>, during several research projects at the
            <Text strong> NTB institute for engineering informatics</Text>. Since the year 2000 AWV Informatik AG has overtaken
            and advanced development of the ClassCAD software for <Text strong>CAD/CAM specific solutions and applications</Text>.
          </Paragraph>
          <Link style={{ textAnchor: 'end' }} href="https://awv-informatik.ch/" target="_blank">awv-informatik.ch</Link>
        </InfoItem>
        <InfoItem caption="buerli">
          <Title level={5}>About</Title>
          <Paragraph>
            Buerli is a powerful tool for creating custom cloud CAD applications.
            While developers primarily handle the customization process, we also cater to designers who can actively participate
            in the creation of 3D parts and assemblies using our Buerligons systems.
            It is worth noting that the majority of Buerli application teams consist of both developers and designers,
            fostering collaboration and synergy between these roles.
          </Paragraph>
          <Paragraph>
            Buerli offers seamless integration between interactive CAD modeling and programming.
            With our APIs, web developers can program CAD models interactively, just like designers do.
            This allows designers and programmers to work collaboratively and efficiently,
            with the ability to reconfigure models within the browser using the API.
          </Paragraph>
          <Paragraph><Text mark>{`Buerli version: ${buerliVersion}`}</Text></Paragraph>
          <Link href="https://buerli.io/" target="_blank">buerli.io</Link>
        </InfoItem>
        <InfoItem caption="ClassCAD">
          <Title level={5}>TBD</Title>
          <Paragraph>TBD</Paragraph>
          <Paragraph><Text mark>{`ClassCAD version: TBD`}</Text></Paragraph>
          <Paragraph><Text mark>{`Runs on: TBD`}</Text></Paragraph>
        </InfoItem>
      </div>
    </Footer>
  )
}

export const WelcomePage: React.FC = () => {
  const rfRef = React.useRef<HTMLInputElement>()

  const openFile = React.useCallback(() => {
    rfRef.current && rfRef.current.click()
  }, [])

  return (
    <>
      <Logo>buerligons</Logo>
      <Main>
        <CreateNew />
        <WideButton onClick={openFile}>
          <Space>Open File</Space>
        </WideButton>
        <Readfile ref={rfRef} singleDrawingApp />
      </Main>
      <Info />
    </>
  )
}

const WideButton = styled(Button)`
  width: 12em;
  height: 3em !important;
`

const CreateNewDiv = styled.div`
  width: 12em;
  height: 3em !important;
  line-height: 1em;
  padding-top: 1em;
  position: relative;
  color: white;
  background-color: rgb(24, 144, 255);
  border: 0px;
  border-radius: 2px;
  text-align: center;
  transition: all 0.3s;
  transition-delay: 0.3s;
  &:hover {
    padding-top: 0.4em;
    background-color: rgb(64, 169, 255);
    transition-delay: 0.0s;
    .create-new-div-options {
      visibility: visible;
      opacity: 1.0;
    }
  }
`

const CreateNewDivOptions = styled.div.attrs({ className: 'create-new-div-options' })`
  display: flex;
  width: 100%;
  position: absolute;
  bottom: 0em;
  visibility: hidden;
  opacity: 0.0;
  transition: visibility 0.3s step-end, opacity 0.3s 0.3s;
`

const NestedButton = styled(Button)<{ maincolor: string | number }>`
  height: 1.6em !important;
  line-height: 1.2em;
  padding: 0px;
  font-size: 12px;
  background-color: ${props => props.maincolor};
  border-top-left-radius: 0px;
  border-top-right-radius: 0px;
  border-color: ${props => props.maincolor};
`

const InfoButton = styled(Button)`
  padding: 0px;
  font-weight: 600;
  color: #565656;
  &:hover {
    color: #000000;
    -webkit-text-stroke-width: 0.5px;
    -webkit-text-stroke-color: #000000;
  }
  &:focus {
    color: #000000;
    -webkit-text-stroke-width: 0.5px;
    -webkit-text-stroke-color: #000000;
  }
`

const Logo = styled.div`
  position: absolute;
  top: 2rem;
  left: 3rem;
  font-weight: 800;
  font-size: 32px;
  color: #565656;
`

const Footer = styled.footer`
  position: absolute;
  bottom: 0.5rem;
  left: 3rem;
  font-weight: 600;
`

const Main = styled.div`
  display: grid;
  width: 100%;
  height: 100%;
  justify-items: center;
  align-content: center;
  gap: 16px;

  background: -webkit-radial-gradient(
      center,
      circle,
      rgba(255, 255, 255, 0.35),
      rgba(255, 255, 255, 0) 20%,
      rgba(255, 255, 255, 0) 21%
    ),
    -webkit-radial-gradient(center, circle, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0) 20%, rgba(0, 0, 0, 0) 21%),
    -webkit-radial-gradient(center, circle farthest-corner, #f5f5f5, #eaeaea);
  background-size: 10px 10px, 10px 10px, 100% 100%;
  background-position: 1px 1px, 0px 0px, center center;
`
