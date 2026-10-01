import React from 'react'

import { useBuerli } from '@buerli.io/react'

/**
 * The last thing the engine had to say, as one line. Its colour is its kind: red for what went
 * wrong, green for what is done, orange for a warning and for work under way, blue for a note.
 */
export const SimpleMessage: React.FC<{
  errorColor?: string;
  successColor?: string;
  warningColor?: string;
  infoColor?: string;
  style?: React.CSSProperties
}> = ({
  errorColor = 'var(--rcad-accent)',
  successColor = 'var(--rcad-green)',
  warningColor = 'var(--rcad-orange)',
  infoColor = 'var(--rcad-blue)',
  style,
}) => {
  const message = useBuerli(s => s.message)
  const text = message.data?.text
  const msgType = message.data?.type

  const colors = React.useMemo(() =>
    ({ error: errorColor, success: successColor, warning: warningColor, info: infoColor, busy: warningColor }),
    [errorColor, successColor, warningColor, infoColor],
  )

  const color = msgType ? colors[msgType] : infoColor

  return text ? (
    <div className="buerli-simple-message" style={{ color, ...style }}>
      {text}
    </div>
  ) : null
}
