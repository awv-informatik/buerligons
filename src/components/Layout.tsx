import React from 'react'
import styled, { css } from 'styled-components'
import 'antd/dist/antd.css'

export const Hero = styled.div`
  height: 100%;
  width: 100%;
  background-color: #fff;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
`

export const Spacer = styled.div`
  flex: 1;
`

export const Header = styled.header`
  z-index: 1000;
  background: white;
  background: linear-gradient(0deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.975) 75%);
  position: sticky;
  top: 0px;
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
    background: linear-gradient(0deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.975) 50%);
  }
`

export const Footer = styled.footer`
  z-index: 1000;
  background: white;
  background: linear-gradient(0deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.975) 75%);
  position: sticky;
  top: 0;
  bottom: 0;
  display: flex;
  min-height: 100px;
  width: 100%;
  align-items: center;
  overflow: hidden;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 20px;
  padding: 0 100px;
  @media (max-width: 991px) {
    max-width: 100%;
    padding: 0 20px;
    background: linear-gradient(0deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.975) 50%);
  }
`

export const Link = styled.a`
  color: #000;
  text-decoration: none;
  font:
    400 15px/1.3em Inter,
    sans-serif;
  margin: auto 0;
`

export const Caption = styled.h2<{ light?: boolean; floating?: boolean; right?: boolean }>`
  position: ${props => (props.floating ? 'absolute' : 'relative')};
  color: #000;
  text-align: ${props => (props.right ? 'right' : 'left')};
  letter-spacing: -0.03em;
  text-shadow:
    0 0 1.5em white,
    0 0 1.5em white;
  font:
    600 90px/0.9em Inter,
    sans-serif;
  @media (max-width: 991px) {
    max-width: 100%;
    font-size: 40px;
    line-height: 40px;
  }
  ${props =>
    props.light &&
    css`
      font-weight: 400;
    `}
`

export const Video = styled.video`
  flex: 1;
  min-height: 200px;
  margin: 100px 0 15px 100px;
  object-fit: contain;
  @media (max-width: 991px) {
    margin: 100px 0 0 0;
    height: calc(50vh - 150px);
    object-fit: cover;
  }
`

export const Description = styled.p`
  color: #000;
  font:
    400 15px/1.3em Inter,
    sans-serif;
  width: 350px;
  margin-top: 15px;
  margin-bottom: 15px;
  text-align: justify;
  text-indent: 50px;
  @media (max-width: 991px) {
    text-indent: 0;
  }
`

export const ProductWrapper = styled.div`
  height: auto;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  gap: 40px;
  padding: 0 0 0 100px;
  padding-bottom: 120px;
  @media (max-width: 991px) {
    padding-left: 0px;
  }
  @media (max-width: 500px) {
    max-width: 100%;
    padding-left: 20px;
    display: none;
  }
`

export const ButtonGroup = styled.div`
  display: flex;
  height: 40px;
  gap: 20px;
  margin-top: 15px;
  @media (max-width: 600px) {
    flex-direction: column;
    gap: 10px;
  }
`

export const Button = styled.button`
  word-wrap: nowrap;
  white-space: nowrap;
  border-radius: 5px;
  background-color: black;
  padding: 11px 25px;
  color: white;
  min-width: 140px;
  font:
    400 15px Inter,
    sans-serif;
  box-shadow:
    0 3px 6px -4px #0000001f,
    0 6px 16px #00000014,
    0 9px 28px 8px #0000000d;
  border: none;
  cursor: pointer;
  @media (max-width: 991px) {
    padding: 11px 20px;
  }
`

export const Main = styled.main`
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

export const Section = styled.div`
  position: relative;
  display: flex;
  width: 100%;
  overflow: hidden;
  justify-content: flex-start;
  flex: 1;
  flex-wrap: wrap;
  height: auto;
  padding-bottom: 120px;
  font:
    400 15px/1.3em Inter,
    sans-serif;
  @media (max-width: 991px) {
    max-width: 100%;
  }
`

export const Sidebar = styled.aside`
  display: flex;
  width: 10px;
  height: 10px;
  flex: 1;
  flex-basis: 64px;
`

export const Content = styled.section`
  position: relative;
  height: 100%;
  display: flex;
  min-width: 240px;
  flex-direction: column;
  overflow: hidden;
  width: 1024px;
  padding: 0 20px 0 20px;
  @media (max-width: 991px) {
    max-width: 100%;
    padding-left: 20px;
  }
  &.margin-top {
    padding-top: 40px;
  }
  & > p {
    text-indent: 50px;
  }
  & p {
    text-align: justify;
  }
`

export const Brand = styled.span`
  display: flex;
  gap: 15px;
  color: #000;
  font:
    400 15px/1.3em Inter,
    sans-serif;
  margin: auto 0;
`

export const Grid = styled.div<{ columns?: number | string; rows?: number; gap?: number | string }>`
  grid-template-columns: ${({ columns = 1 }) =>
    typeof columns === 'number' ? [...new Array(columns)].map(() => '1fr').join(' ') : columns};
  grid-template-rows: ${({ rows = 0 }) =>
    typeof rows === 'number' ? [...new Array(rows)].map(() => 'auto').join(' ') : rows};
  gap: ${({ gap = 1 }) => typeof gap === 'number' ? `${gap}rem` : gap};
  display: grid;
  width: 100%;
  height: 100%;
  padding-top: 25px;
  & > div {
    position: relative;
  }
  @media (max-width: 991px) {
    grid-template-columns: 1fr !important;
  }
}
`

export function Feature({ title, children, icon: Icon }: any) {
  return (
    <Grid columns="1fr 10fr" gap="50px">
      <Icon style={{ position: "relative", fontSize: '50px', marginTop: 0, left: 25 }} />
      <div>
        <h4><b>{title}</b></h4>
        <p style={{ marginBottom: 0 }}>{children}</p>
      </div>
    </Grid>
  )
}
