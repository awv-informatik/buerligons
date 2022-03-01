import { AppstoreOutlined, FileOutlined } from '@ant-design/icons'
import { ccAPI } from '@buerli.io/classcad'
import { Readfile } from '@buerli.io/react-cad'
import { Button, Dropdown, Menu, Space } from 'antd'
import 'antd/dist/antd.css'
import React from 'react'
import styled from 'styled-components'

export const WelcomePage: React.FC = () => {
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

  const menu = (
    <Menu onClick={() => null}>
      <Menu.Item key="Part" icon={<FileOutlined />} onClick={createPart}>
        Part
      </Menu.Item>
      <Menu.Item key="Assembly" icon={<AppstoreOutlined />} onClick={createAssembly}>
        Assembly
      </Menu.Item>
    </Menu>
  )

  return (
    <>
      <Logo>buerligons</Logo>
      <Main>
        <Dropdown overlay={menu}>
          <WideButton type="primary">
            <Space>Create New ...</Space>
          </WideButton>
        </Dropdown>
        <WideButton onClick={openFile}>
          <Space>Open File</Space>
        </WideButton>
        <Readfile ref={rfRef} singleDrawingApp />
      </Main>
    </>
  )
}

const WideButton = styled(Button)`
  width: 12em;
  height: 3em !important;
`

const Logo = styled.div`
  position: absolute;
  top: 2rem;
  left: 3rem;
  font-weight: 800;
  font-size: 32px;
  color: #565656;
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
