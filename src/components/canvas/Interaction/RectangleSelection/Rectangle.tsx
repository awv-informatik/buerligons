import * as THREE from 'three'
import React from 'react'

import { useThree } from '@react-three/fiber'

export type RectangleRefType = {
  clickPos: THREE.Vector2
  curPos: THREE.Vector2
  update: () => void
}

export const Rectangle = React.forwardRef<RectangleRefType, { enabled: boolean }>(
  ({ enabled }, ref) => {
    const gl = useThree(s => s.gl)

    const divRef = React.useRef<HTMLDivElement>(document.createElement('div'))

    const update = React.useCallback(() => {
      const minX = Math.min(rectangleRef.current.clickPos.x, rectangleRef.current.curPos.x)
      const maxX = Math.max(rectangleRef.current.clickPos.x, rectangleRef.current.curPos.x)
      const minY = Math.min(rectangleRef.current.clickPos.y, rectangleRef.current.curPos.y)
      const maxY = Math.max(rectangleRef.current.clickPos.y, rectangleRef.current.curPos.y)
      
      divRef.current.style.left = `${minX}px`
      divRef.current.style.top = `${minY}px`
      divRef.current.style.width = `${maxX - minX}px`
      divRef.current.style.height = `${maxY - minY}px`
    }, [])
  
    React.useEffect(() => {
      if (!enabled) {
        return
      }

      divRef.current.style.position = 'fixed'
      divRef.current.style.pointerEvents = 'none'
      divRef.current.style.border = '1px solid rgb(128, 128, 128)'
      divRef.current.style.background = 'rgba(217, 217, 217, 0.3)'

      update()

      const element = divRef.current
      gl.domElement.parentElement?.appendChild(element)

      return () => {
        element.parentElement?.removeChild(element)
      }
    }, [gl, update, enabled])
    
    const rectangleRef = React.useRef<RectangleRefType>({
      clickPos: new THREE.Vector2(),
      curPos: new THREE.Vector2(),
      update,
    })
    React.useImperativeHandle(ref, () => rectangleRef.current, [])
  
    return null
  }
)

Rectangle.displayName = 'SelectionRectangle'
