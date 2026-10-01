import React from 'react'
import * as THREE from 'three'

import { useRCadTheme, useRCadThemeMode, useStage } from '@buerli.io/react-cad'
import { GizmoHelper, GizmoViewcube, GizmoViewport, useBounds } from '@react-three/drei'
import { ThreeEvent, useThree } from '@react-three/fiber'

type ControlsProto = {
  update(): void
  target: THREE.Vector3
}

const tolerance = 1e-6
const upDefault = new THREE.Vector3(0, 0, 1)

const getUpVector = (normal: THREE.Vector3) => {
  // Any edge or corner
  if (Math.abs(Math.abs(normal.x + normal.y + normal.z) - 1) > tolerance) {
    return normal.clone().cross(upDefault).cross(normal).normalize()
  }
  if (Math.abs(normal.y + 1) < tolerance) {
    // Front
    return new THREE.Vector3(0, 0, 1)
  }
  if (Math.abs(normal.y - 1) < tolerance) {
    // Back
    return new THREE.Vector3(0, 0, -1)
  }

  // Top, Bottom, Left, Right
  return new THREE.Vector3(0, 1, 0)
}

// The cube's faces are written with the page's own mono; they are drawn once, so they wait for it.
const FACE_FONT = "600 21px 'JetBrains Mono', 'RCad Mono', ui-monospace, monospace"
const AXIS_FONT = "700 19px 'JetBrains Mono', 'RCad Mono', ui-monospace, monospace"

const useFont = (font: string) => {
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => {
    let live = true
    const done = () => {
      if (live) setReady(true)
    }
    const fonts = (document as any).fonts
    if (!fonts?.load) {
      done()
      return
    }
    // (a face that never comes must not keep the cube away)
    const late = window.setTimeout(done, 1500)
    void (fonts.load(font, 'TOP') as Promise<unknown>).catch(() => undefined).finally(done)
    return () => {
      live = false
      window.clearTimeout(late)
    }
  }, [font])
  return ready
}

// The frame of a drawing, as the family rules one: its border, a shade under the hand.
const cubeColors = {
  light: { stroke: '#c9ccd4', hover: '#e4e7ec' },
  dark: { stroke: '#3a3e46', hover: '#9aa0ab' },
}

/**
 * The view, in the stage's top right corner: a paper cube with the views' names on it, and the
 * part's three axes in the triad's colours. A face, an edge or a corner turns the view to it.
 */
export const ViewCube: React.FC = () => {
  const bounds = useBounds()
  const theme = useRCadTheme()
  const mode = useRCadThemeMode()
  const stage = useStage()
  const fontReady = useFont(FACE_FONT)

  const { camera, invalidate } = useThree()
  const controls = useThree(s => s.controls as unknown as ControlsProto)

  const onClick = React.useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()

    let normal: THREE.Vector3
    if (e.object.position.lengthSq() === 0) {
      normal = e.face?.normal || new THREE.Vector3()
    }
    else {
      normal = e.object.position.clone().normalize()
    }
    const up = getUpVector(normal)
    const target = controls.target.clone()
    const distance = camera.position.distanceTo(target)
    const position = target.clone().addScaledVector(normal, distance)

    bounds?.refresh().moveTo(position).lookAt({ target, up })

    invalidate()

    // Idk why GizmoViewcube's onClick is typed to have to return null...
    return null
  }, [bounds, camera, controls, invalidate])

  // the faces are textures: a new theme, or the face arriving, draws them again
  const key = `${mode}-${fontReady}`

  return (
    <GizmoHelper renderPriority={2} alignment="top-right" margin={[76, 76]}>
      <group scale={0.74}>
        <group scale={2.25} position={[-30, -30, -30]} rotation={[0, 0, 0]}>
          <GizmoViewport
            key={key}
            disabled
            axisScale={[0.8, 0.014, 0.014]}
            axisHeadScale={0.42}
            hideNegativeAxes
            axisColors={[stage.axisX, stage.axisY, stage.axisZ]}
            labelColor={mode === 'dark' ? '#16181d' : '#ffffff'}
            font={AXIS_FONT}
          />
        </group>
        <GizmoViewcube
          key={key}
          font={FACE_FONT}
          faces={['Right', 'Left', 'Back', 'Front', 'Top', 'Bottom']}
          color={theme.chrome}
          textColor={theme.ink2}
          strokeColor={cubeColors[mode].stroke}
          hoverColor={cubeColors[mode].hover}
          opacity={1}
          onClick={onClick}
        />
      </group>
    </GizmoHelper>
  )
}
