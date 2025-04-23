import React from 'react'

export function Section({ wide, children, ...props }) {
  return (
    <div className='overflow-hidden py-24 sm:py-24 flex gap-x-6' {...props}>
      <aside className='w-10 h-10 flex-1' />
      <div className={wide ? "w-8xl" : "w-5xl"}>
        {children}</div>
      <aside className='w-10 h-10 flex-1' />
    </div>
  )
}
