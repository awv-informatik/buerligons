import { Icon, viewpoints } from '@buerli.io/react-cad'
import React from 'react'
import styled from 'styled-components'

/**
 * Notification shown while follow mode is active ("you are looking through
 * <peer>'s camera"). The X returns to the local view — FollowCamera restores
 * the pose that was saved when follow mode was entered.
 * It sits at the foot of the stage, over the status line.
 */
export const FollowBanner: React.FC = () => {
  const follow = viewpoints.useFollow()
  if (!follow) return null
  return (
    <Pill role="status">
      <Icon name="eye" size={14} />
      <span>
        Viewing as <b>{follow.name}</b>
      </span>
      <button
        type="button"
        aria-label="Back to your own view"
        title="Back to your own view"
        onClick={viewpoints.clearFollow}>
        <Icon name="close" size={12} />
      </button>
    </Pill>
  )
}

const Pill = styled.div`
  position: fixed;
  bottom: calc(var(--rcad-status-h, 26px) + 14px);
  left: 50%;
  z-index: 1001;
  display: flex;
  align-items: center;
  gap: 9px;
  height: 32px;
  padding: 0 5px 0 13px;
  border-radius: 999px;
  background: var(--rcad-toast-bg);
  box-shadow: var(--rcad-shadow-lg);
  color: var(--rcad-toast-text);
  font: 500 12px/1 var(--rcad-font-mono);
  transform: translateX(-50%);
  user-select: none;

  b {
    color: var(--rcad-toast-strong);
    font-weight: 600;
  }
  button {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: color-mix(in srgb, var(--rcad-toast-strong) 16%, transparent);
    color: var(--rcad-toast-strong);
    cursor: pointer;
  }
  button:hover {
    background: color-mix(in srgb, var(--rcad-toast-strong) 28%, transparent);
  }
  button:focus-visible {
    outline: 2px solid var(--rcad-accent-line);
    outline-offset: 2px;
  }
`
