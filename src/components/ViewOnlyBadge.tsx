import { Icon } from '@buerli.io/react-cad'
import React from 'react'
import styled from 'styled-components'

/**
 * Small fixed pill shown to a view-only guest, so it's always clear why the
 * editing controls are gone. Rendered only when read-only (the caller gates it).
 * It sits at the head of the stage, under the bar.
 */
export const ViewOnlyBadge: React.FC = () => (
  <Pill role="status">
    <Icon name="eye" size={14} />
    <span>View only</span>
  </Pill>
)

const Pill = styled.div`
  position: fixed;
  top: calc(var(--rcad-bar-h, 48px) + 12px);
  left: 50%;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 7px;
  height: 24px;
  padding: 0 12px 0 10px;
  border-radius: 999px;
  background: var(--rcad-toast-bg);
  box-shadow: var(--rcad-shadow);
  color: var(--rcad-toast-strong);
  font: 600 10.5px/1 var(--rcad-font-mono);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  transform: translateX(-50%);
  pointer-events: none;
  user-select: none;
`
