import * as THREE from 'three'
import React from 'react'

import { useFrame, useThree } from '@react-three/fiber'


export const Rectangle = React.forwardRef<{ clickPos: THREE.Vector2; curPos: THREE.Vector2 }, { enabled: boolean }>(
  ({ enabled }, ref) => {
    const gl = useThree(s => s.gl)

    const divRef = React.useRef<HTMLDivElement>(document.createElement('div'))
    const bbRef = React.useRef<{ clickPos: THREE.Vector2; curPos: THREE.Vector2 }>({ clickPos: new THREE.Vector2(), curPos: new THREE.Vector2() })
    React.useImperativeHandle(ref, () => bbRef.current, [])
  
    React.useEffect(() => {
      if (!enabled) {
        return
      }

      const element = divRef.current

      const minX = Math.min(bbRef.current.clickPos.x, bbRef.current.curPos.x)
      const maxX = Math.max(bbRef.current.clickPos.x, bbRef.current.curPos.x)
      const minY = Math.min(bbRef.current.clickPos.y, bbRef.current.curPos.y)
      const maxY = Math.max(bbRef.current.clickPos.y, bbRef.current.curPos.y)

      divRef.current.style.position = 'fixed'
      divRef.current.style.pointerEvents = 'none'
      divRef.current.style.border = '1px solid rgb(128, 128, 128)'
      divRef.current.style.background = 'rgba(217, 217, 217, 0.3)'
      divRef.current.style.left = `${minX}px`
      divRef.current.style.top = `${minY}px`
      divRef.current.style.width = `${maxX - minX}px`
      divRef.current.style.height = `${maxY - minY}px`
      
      gl.domElement.parentElement?.appendChild(element)

      return () => {
        element.parentElement?.removeChild(element)
      }
    }, [gl, enabled])

    useFrame(() => {
      if (!enabled)  {
        return
      }

      const minX = Math.min(bbRef.current.clickPos.x, bbRef.current.curPos.x)
      const maxX = Math.max(bbRef.current.clickPos.x, bbRef.current.curPos.x)
      const minY = Math.min(bbRef.current.clickPos.y, bbRef.current.curPos.y)
      const maxY = Math.max(bbRef.current.clickPos.y, bbRef.current.curPos.y)
      
      divRef.current.style.left = `${minX}px`
      divRef.current.style.top = `${minY}px`
      divRef.current.style.width = `${maxX - minX}px`
      divRef.current.style.height = `${maxY - minY}px`
    })
  
    return null
  }
)

Rectangle.displayName = 'SelectionRectangle'
