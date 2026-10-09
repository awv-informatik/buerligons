import * as styled from 'styled-components'

// What the page under the app is, where the app is the whole page: its ground, its face, its bars.
export const Global: any = styled.createGlobalStyle<{ background: string; text: string; scrollbarThumb: string; scrollbarBorder: string }>`
  * {
    box-sizing: border-box;
  }

  html,
  body,
  #root {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    background-color: ${p => p.background};
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    -khtml-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    overflow: hidden;
  }

  #root {
    overflow: auto;
  }

  body {
    position: fixed;
    overscroll-behavior-y: none;
    font-family: 'JetBrains Mono', 'RCad Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace !important;
    color: ${p => p.text};
    -webkit-font-smoothing: antialiased;
  }

  ::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: ${p => p.scrollbarThumb};
    background-clip: padding-box;
    border: 3px solid ${p => p.scrollbarBorder};
    border-radius: 6px;
  }
`
