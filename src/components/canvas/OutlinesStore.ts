
import * as THREE from 'three'
import create from 'zustand'

import { ObjectID } from '@buerli.io/core'

type OutlinedMeshes = { [key: number]: THREE.Object3D[]}

export const useOutlinesStore = create<{
  outlinedMeshes: { [key: string]: OutlinedMeshes }
  setOutlinedMeshes: (group: string, id: ObjectID, outlinedMeshes: THREE.Object3D[]) => void
  removeMesh: (group: string, id: ObjectID) => void
}>((set, get) => ({
  outlinedMeshes: {},
  setOutlinedMeshes: (group: string, id: ObjectID, outlinedMeshes_: THREE.Object3D[]) =>
    set(state => ({ outlinedMeshes: { ...state.outlinedMeshes, [group]: { ...state.outlinedMeshes[group], [id]: outlinedMeshes_} } })),
  removeMesh: (group: string, id: ObjectID) =>
    set(state => {
      const outlinedMeshes_ = { ...state.outlinedMeshes[group] }
      delete outlinedMeshes_[id]
      return { outlinedMeshes: { ...state.outlinedMeshes, [group]: outlinedMeshes_ } }
    }),
}))
