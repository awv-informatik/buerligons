import React from 'react'

import { useBuerli } from '@buerli.io/react'

export const SimpleMessage: React.FC<{
  errorColor?: string;
  successColor?: string;
  warningColor?: string;
  infoColor?: string;
  style?: React.CSSProperties
}> = ({ errorColor = '#ff4d4f', successColor = '#52c41a', warningColor = '#faad14', infoColor = '#1890ff', style }) => {
  const message = useBuerli(s => s.message)
  const text = message.data?.text
  const msgType = message.data?.type

  const colors = React.useMemo(() =>
    ({ error: errorColor, success: successColor, warning: warningColor, info: infoColor, busy: infoColor }),
    [errorColor, successColor, warningColor, infoColor],
  )

  const color = msgType ? colors[msgType] : infoColor

  return text ? (
    <div className="buerli-simple-message" style={{ color }}>
      {text}
    </div>
  ) : null
}
