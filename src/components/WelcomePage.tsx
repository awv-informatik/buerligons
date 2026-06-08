import { AppstoreOutlined, FileOutlined, BulbOutlined, BulbFilled } from '@ant-design/icons'
import { createApi, BuerliCadFacade } from '@buerli.io/classcad'
import { Readfile, useRCadThemeMode, setRCadThemeMode } from '@buerli.io/react-cad'
import { Button, Dropdown, Space, MenuProps, Tooltip } from 'antd'
import 'antd/dist/antd.css'
import React from 'react'
import styled from 'styled-components'

import { SimpleMessage } from './SimpleMessage'

const welcomeColors = {
  light: {
    logoText: '#565656',
    dotLight: 'rgba(255, 255, 255, 0.35)',
    dotDark: 'rgba(0, 0, 0, 0.2)',
    gradientInner: '#f5f5f5',
    gradientOuter: '#eaeaea',
  },
  dark: {
    logoText: '#c0c0c0',
    dotLight: 'rgba(255, 255, 255, 0.05)',
    dotDark: 'rgba(0, 0, 0, 0.4)',
    gradientInner: '#242424',
    gradientOuter: '#1a1a1a',
  },
}

export const WelcomePage: React.FC = () => {
  const rfRef = React.useRef<HTMLInputElement>()
  const mode = useRCadThemeMode()
  const colors = welcomeColors[mode]

  const createPart = React.useCallback(async () => {
    const newDrawingId = await BuerliCadFacade.utils.connect()
    newDrawingId && (await createApi(newDrawingId).v1.part.create({ name: 'Part' }).catch(console.info))
  }, [])

  const createAssembly = React.useCallback(async () => {
    const newDrawingId = await BuerliCadFacade.utils.connect()
    newDrawingId &&
      (await createApi(newDrawingId).v1.assembly.create({ name: 'Assembly' }).catch(console.info))
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

  const menuItems: MenuProps['items'] = [
    { label: 'Part', key: 'Part', icon: <FileOutlined /> },
    { label: 'Assembly', key: 'Assembly', icon: <AppstoreOutlined /> },
  ]

  const menuProps = { items: menuItems, onClick }

  return (
    <>
      <Logo $color={colors.logoText}>buerligons</Logo>
      <ThemeToggleWrap>
        <Tooltip title={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
          <Button
            shape="circle"
            onClick={() => setRCadThemeMode(mode === 'light' ? 'dark' : 'light')}
            icon={mode === 'light' ? <BulbOutlined /> : <BulbFilled />}
          />
        </Tooltip>
      </ThemeToggleWrap>
      <Main $dotLight={colors.dotLight} $dotDark={colors.dotDark} $gradientInner={colors.gradientInner} $gradientOuter={colors.gradientOuter}>
        <Dropdown menu={menuProps}>
          <WideButton type="primary">
            <Space>Create New ...</Space>
          </WideButton>
        </Dropdown>
        <WideButtonSecondary $dark={mode === 'dark'} onClick={openFile}>
          <Space>Open File</Space>
        </WideButtonSecondary>
        <MessageSpace>
          <SimpleMessage />
        </MessageSpace>
        <Readfile ref={rfRef} singleDrawingApp />
      </Main>
    </>
  )
}

const WideButton = styled(Button)`
  width: 12em;
  height: 3em !important;
`

const WideButtonSecondary = styled(WideButton)<{ $dark: boolean }>`
  &&& {
    background-color: ${p => (p.$dark ? '#3a3a3a' : '#fff')} !important;
    border-color: ${p => (p.$dark ? '#555' : '#d9d9d9')} !important;
    color: ${p => (p.$dark ? '#e0e0e0' : 'rgba(0, 0, 0, 0.85)')} !important;
  }
`

const MessageSpace = styled.div`
  position: relative;
  width: 60em;
  height: 0px;
  .buerli-simple-message {
    position: absolute;
    width: 100%;
    height: auto;
    text-align: center;
    word-break: break-word;
    font-weight: 500;
  }
`

const Logo = styled.div<{ $color: string }>`
  position: absolute;
  top: 2rem;
  left: 3rem;
  font-weight: 800;
  font-size: 32px;
  color: ${p => p.$color};
`

const ThemeToggleWrap = styled.div`
  position: absolute;
  top: 2rem;
  right: 3rem;
`

const Main = styled.div<{ $dotLight: string; $dotDark: string; $gradientInner: string; $gradientOuter: string }>`
  display: grid;
  width: 100%;
  height: 100%;
  justify-items: center;
  align-content: center;
  gap: 16px;

  background:
    radial-gradient(
      circle at center,
      ${p => p.$dotLight},
      rgba(255, 255, 255, 0) 20%,
      rgba(255, 255, 255, 0) 21%
    ),
    radial-gradient(circle at center, ${p => p.$dotDark}, rgba(0, 0, 0, 0) 20%, rgba(0, 0, 0, 0) 21%),
    radial-gradient(circle farthest-corner at center, ${p => p.$gradientInner}, ${p => p.$gradientOuter});
  background-size:
    10px 10px,
    10px 10px,
    100% 100%;
  background-position:
    1px 1px,
    0px 0px,
    center center;
`
