import { Button, Space } from 'antd'
import 'antd/dist/antd.css'
import React from 'react'
import styled from 'styled-components'
import { useIPC } from '../ipc'

export const ChooseCCApp: React.FC = () => {
  const loadClassFile = useIPC(s => s.loadClassFile)

  return (
    <>
      <Logo>buerligons</Logo>
      <Main>
        <Paragraph>
          Before you can start using the pre-compiled <strong>buerligons</strong>, <br />
          we need your CCAPP file downloaded from{' '}
          <a href="https://buerli.io" target="blank">
            buerli.io
          </a>
          .
        </Paragraph>
        <WideButton onClick={loadClassFile}>
          <Space>Select ClassCAD Application File (.ccapp)</Space>
        </WideButton>
      </Main>
    </>
  )
}

const Paragraph = styled.p`
  font-size: 1.2rem;
  text-align: center;
  font-weight: 600;
  color: #565656;
`

const WideButton = styled(Button)`
  cursor: pointer;
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
